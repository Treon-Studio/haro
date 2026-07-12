"""REST API proxy for CF Workers — wraps MCP tools in simple JSON endpoint."""

import json
import logging
import os
import traceback
from datetime import datetime, timezone
from pathlib import Path
from time import time
from urllib.parse import unquote

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from memory_fabric.tenant_manager import TenantManager, ProvisioningError

logger = logging.getLogger(__name__)

_tenant_status_cache: dict[str, str] = {}
_tenant_cache_ttl: dict[str, float] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes

_TOOL_RESOURCE_MAP = {
    "memory_store": ("memories", 1),
    "memory_delete": ("memories", -1),
    "vault_write": ("vault_bytes", None),
    "vault_delete": ("vault_bytes", None),
    "gbrain_put": ("gbrain_pages", 1),
    "gbrain_delete": ("gbrain_pages", -1),
}

_QUOTA_RESOURCE_MAP = {
    "memory_store": ("usage_memories", "quota_max_memories"),
    "gbrain_put": ("usage_gbrain_pages", "quota_max_gbrain_pages"),
    "vault_write": ("usage_vault_bytes", "quota_max_vault_bytes"),
}

app = FastAPI(title="memory-fabric-proxy")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class ToolRequest(BaseModel):
    tool: str
    args: dict = {}


def _resolve_fn(tool_name: str):
    import memory_fabric.server as srv
    fn = getattr(srv, tool_name, None)
    if fn is None or not callable(fn):
        return None
    return fn


def check_quota(tenant: str, tool: str) -> None:
    """Raise HTTPException if tenant has exceeded quota for this tool."""
    quota_key = _QUOTA_RESOURCE_MAP.get(tool)
    if not quota_key:
        return
    usage_col, quota_col = quota_key
    tm = get_tenant_manager()
    t = tm.get_tenant(tenant)
    if not t:
        return
    usage = t.get(usage_col, 0)
    quota = t.get(quota_col, 0)
    if quota > 0 and usage >= quota:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "QUOTA_EXCEEDED",
                "message": f"Tenant '{tenant}' has exceeded {usage_col.replace('_', ' ')} quota ({usage}/{quota})",
            },
        )


@app.post("/api/tool")
async def call_tool(req: ToolRequest):
    args = req.args if isinstance(req.args, dict) else {}
    tenant = args.get("tenant") or args.get("user_id", "").split("_")[0]

    if tenant:
        tm = get_tenant_manager()
        cached = _tenant_status_cache.get(tenant)
        if cached is None or (tenant in _tenant_cache_ttl and time() - _tenant_cache_ttl[tenant] > CACHE_TTL_SECONDS):
            t = tm.get_tenant(tenant)
            cached = t["status"] if t else "active"
            _tenant_status_cache[tenant] = cached
            _tenant_cache_ttl[tenant] = time()

        if cached in ("suspended", "deleting", "deleted"):
            return JSONResponse(
                {
                    "error": {
                        "code": "TENANT_UNAVAILABLE",
                        "message": f"Tenant '{tenant}' is {cached}. Contact support for assistance.",
                    }
                },
                status_code=403,
            )

    if tenant:
        try:
            check_quota(tenant, req.tool)
        except HTTPException as e:
            return JSONResponse(
                {"error": {"code": "QUOTA_EXCEEDED", "message": e.detail["message"]}},
                status_code=403,
            )

    fn = _resolve_fn(req.tool)
    if fn is None:
        return {"error": f"Unknown tool: {req.tool}"}
    try:
        result = await fn(**req.args) if __import__("inspect").iscoroutinefunction(fn) else fn(**req.args)

        # Increment usage counter after successful tool call
        if tenant and req.tool in _TOOL_RESOURCE_MAP:
            resource, amount = _TOOL_RESOURCE_MAP[req.tool]
            if amount is not None:
                try:
                    tm = get_tenant_manager()
                    tm.increment_usage(tenant, resource, amount)
                except Exception:
                    logger.warning("Failed to increment usage for %s/%s", tenant, resource)

        return {"result": result}
    except Exception as e:
        logger.error("Tool %s failed: %s\n%s", req.tool, e, traceback.format_exc())
        return {"error": str(e)}


@app.get("/api/health")
async def health():
    import memory_fabric.server as srv
    results = {}
    errors = []
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{srv.MEM0_API}/api/v1/memories/", params={"user_id": "__health__"}, headers=srv._mem0_headers(), timeout=5)
        results["mem0"] = "ok" if r.status_code in (200, 404) else "degraded"
    except Exception as e:
        results["mem0"] = f"error: {e}"
        errors.append(f"mem0: {e}")
    try:
        srv._run_gbrain(["stats"], "__health__")
        results["gbrain"] = "ok"
    except Exception as e:
        results["gbrain"] = f"error: {e}"
        errors.append(f"gbrain: {e}")
    results["vault"] = "ok"
    return {"status": "ok" if not errors else "degraded", "backends": results, "errors": errors}


# Tenant manager singleton
tenant_manager: TenantManager | None = None


def get_tenant_manager() -> TenantManager:
    global tenant_manager
    if tenant_manager is None:
        tenant_manager = TenantManager(
            neon_url=os.environ.get("NEON_DATABASE_URL", ""),
            vault_root=os.environ.get("VAULT_ROOT", "/srv/vault-write"),
            gbrain_env_dir=os.environ.get("GBRAIN_ENV_DIR", "/srv/memory-fabric/env"),
            management_api_key=os.environ.get("MANAGEMENT_API_KEY", ""),
        )
    return tenant_manager


def require_auth(request: Request) -> None:
    api_key = os.environ.get("MANAGEMENT_API_KEY", "")
    if not api_key:
        return
    auth = request.headers.get("Authorization", "")
    if auth != f"Bearer {api_key}":
        raise HTTPException(status_code=401, detail="Unauthorized")


def format_tenant_error(exc: ProvisioningError) -> dict:
    return {
        "success": False,
        "error": {
            "code": exc.code,
            "message": exc.message,
            "details": exc.details,
        },
    }


@app.put("/api/tenants/provision")
async def provision_tenant(request: Request):
    require_auth(request)
    body = await request.json()
    tm = get_tenant_manager()
    try:
        result = tm.provision(
            slug=body["slug"],
            name=body["name"],
            company_id=body.get("company_id"),
            created_by=body.get("created_by"),
            plan=body.get("plan", "free"),
            description=body.get("description", ""),
            ip_address=request.client.host if request.client else None,
        )
        return JSONResponse({"success": True, "data": result}, status_code=201)
    except ProvisioningError as e:
        status = 409 if e.code == "TENANT_SLUG_EXISTS" else 422 if e.code == "VALIDATION_ERROR" else 500
        return JSONResponse(format_tenant_error(e), status_code=status)
    except Exception as e:
        return JSONResponse(
            {"success": False, "error": {"code": "INTERNAL_ERROR", "message": str(e)}},
            status_code=500,
        )


@app.get("/api/tenants")
async def list_tenants(request: Request):
    require_auth(request)
    tm = get_tenant_manager()
    try:
        page = int(request.query_params.get("page", 1))
        per_page = int(request.query_params.get("per_page", 20))
        sort = request.query_params.get("sort", "created_at")
        order = request.query_params.get("order", "desc")
        status = request.query_params.get("status")
        plan = request.query_params.get("plan")
        search = request.query_params.get("search")
        created_after = request.query_params.get("created_after")
        created_before = request.query_params.get("created_before")

        rows, total = tm.list_tenants(
            page=page, per_page=per_page, sort=sort, order=order,
            status=status, plan=plan, search=search,
            created_after=created_after, created_before=created_before,
        )
        total_pages = max(1, (total + per_page - 1) // per_page)
        return JSONResponse({
            "success": True,
            "data": rows,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1,
            },
        })
    except Exception as e:
        return JSONResponse(
            {"success": False, "error": {"code": "INTERNAL_ERROR", "message": str(e)}},
            status_code=500,
        )


@app.get("/api/tenants/audit-log")
async def audit_log(request: Request):
    require_auth(request)
    tm = get_tenant_manager()
    tenant_id = request.query_params.get("tenant_id")
    action = request.query_params.get("action")
    limit = int(request.query_params.get("limit", 50))
    rows = tm.get_audit_log(tenant_id=tenant_id, action=action, limit=limit)
    return JSONResponse({"success": True, "data": rows})


@app.get("/api/tenants/{slug}/stats")
async def get_tenant_stats(slug: str, request: Request):
    require_auth(request)
    tm = get_tenant_manager()
    stats = tm.get_stats(slug)
    if not stats:
        return JSONResponse(
            {"success": False, "error": {"code": "NOT_FOUND", "message": f"Tenant '{slug}' not found"}},
            status_code=404,
        )
    return JSONResponse({"success": True, "data": stats})


@app.get("/api/tenants/{slug}/audit-log")
async def tenant_audit_log(slug: str, request: Request):
    require_auth(request)
    tm = get_tenant_manager()
    action = request.query_params.get("action")
    limit = int(request.query_params.get("limit", 50))
    rows = tm.get_audit_log(tenant_id=slug, action=action, limit=limit)
    return JSONResponse({"success": True, "data": rows})


@app.get("/api/tenants/{slug}")
async def get_tenant(slug: str, request: Request):
    require_auth(request)
    tm = get_tenant_manager()
    tenant = tm.get_tenant(slug)
    if not tenant:
        return JSONResponse(
            {"success": False, "error": {"code": "NOT_FOUND", "message": f"Tenant '{slug}' not found"}},
            status_code=404,
        )
    return JSONResponse({"success": True, "data": tenant})


@app.post("/api/tenants/{slug}/suspend")
async def suspend_tenant(slug: str, request: Request):
    require_auth(request)
    body = await request.json() if request.headers.get("content-type") == "application/json" else {}
    tm = get_tenant_manager()
    try:
        result = tm.update_status(slug, "suspended", performed_by=body.get("performed_by"), reason=body.get("reason", ""), ip_address=request.client.host if request.client else None)
        return JSONResponse({"success": True, "data": result})
    except ProvisioningError as e:
        return JSONResponse(format_tenant_error(e), status_code=404 if e.code == "NOT_FOUND" else 400)


@app.post("/api/tenants/{slug}/reactivate")
async def reactivate_tenant(slug: str, request: Request):
    require_auth(request)
    body = await request.json() if request.headers.get("content-type") == "application/json" else {}
    tm = get_tenant_manager()
    try:
        result = tm.update_status(slug, "active", performed_by=body.get("performed_by"), reason=body.get("reason", ""), ip_address=request.client.host if request.client else None)
        return JSONResponse({"success": True, "data": result})
    except ProvisioningError as e:
        return JSONResponse(format_tenant_error(e), status_code=404 if e.code == "NOT_FOUND" else 400)


@app.post("/api/tenants/{slug}/schedule-delete")
async def schedule_delete(slug: str, request: Request):
    require_auth(request)
    body = await request.json() if request.headers.get("content-type") == "application/json" else {}
    tm = get_tenant_manager()
    try:
        result = tm.update_status(slug, "deleting", performed_by=body.get("performed_by"), reason=body.get("reason", ""), ip_address=request.client.host if request.client else None)
        return JSONResponse({"success": True, "data": result})
    except ProvisioningError as e:
        return JSONResponse(format_tenant_error(e), status_code=404 if e.code == "NOT_FOUND" else 400)


# ── WebDAV ──────────────────────────────────────────────────────────────


def _webdav_path(tenant: str, path: str) -> Path:
    """Resolve WebDAV path, prevent traversal."""
    base = Path(os.environ.get("VAULT_ROOT", "/srv/vault-write")) / tenant
    clean = unquote(path.lstrip("/"))
    full = (base / clean).resolve()
    if not str(full).startswith(str(base.resolve())):
        raise HTTPException(status_code=403, detail="Forbidden")
    return full


def _webdav_auth(request: Request) -> None:
    api_key = os.environ.get("MANAGEMENT_API_KEY", "")
    if not api_key:
        return
    auth = request.headers.get("Authorization", "")
    if auth != f"Bearer {api_key}":
        raise HTTPException(status_code=401, detail="Unauthorized")


def _webdav_xml_multistatus(responses: list[tuple[str, int, dict]]) -> str:
    parts = ['<?xml version="1.0" encoding="utf-8"?><D:multistatus xmlns:D="DAV:">']
    for href, status_code, props in responses:
        parts.append(f"<D:response><D:href>{href}</D:href><D:status>HTTP/1.1 {status_code}</D:status>")
        if props:
            parts.append("<D:propstat><D:prop>")
            for k, v in props.items():
                parts.append(f"<D:{k}>{v}</D:{k}>")
            parts.append("</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat>")
        parts.append("</D:response>")
    parts.append("</D:multistatus>")
    return "".join(parts)


@app.api_route("/vault/{tenant}/{path:path}", methods=["GET", "PUT", "DELETE", "PROPFIND", "MKCOL", "MOVE", "COPY"])
async def webdav_handler(tenant: str, path: str, request: Request):
    _webdav_auth(request)
    base = Path(os.environ.get("VAULT_ROOT", "/srv/vault-write")) / tenant
    target = _webdav_path(tenant, path)

    if request.method == "PROPFIND":
        depth = request.headers.get("Depth", "1")
        paths = [target]
        if depth != "0" and target.is_dir():
            paths = [target] + sorted(target.iterdir(), key=lambda p: (not p.is_dir(), p.name))
        responses = []
        for p in paths:
            rel = f"/vault/{tenant}/{p.relative_to(base)}"
            if p.is_dir():
                rel += "/"
            is_dir = p.is_dir()
            size = p.stat().st_size if p.is_file() else 0
            mtime = datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")
            props = {
                "displayname": p.name,
                "resourcetype": "<D:collection/>" if is_dir else "",
                "getcontentlength": str(size),
                "getlastmodified": mtime,
                "creationdate": mtime,
            }
            responses.append((rel, 200, props))
        xml = _webdav_xml_multistatus(responses)
        return Response(content=xml, media_type="application/xml; charset=utf-8", headers={"DAV": "1"})

    if request.method == "GET":
        if not target.exists():
            raise HTTPException(status_code=404, detail="Not found")
        if target.is_dir():
            items = []
            for p in sorted(target.iterdir()):
                name = p.name + "/" if p.is_dir() else p.name
                items.append(f'<li><a href="{name}">{name}</a></li>')
            html = f"<html><body><h1>Index of /vault/{tenant}/{path}</h1><ul>{''.join(items)}</ul></body></html>"
            return Response(content=html, media_type="text/html")
        return Response(content=target.read_bytes(), media_type="application/octet-stream")

    if request.method == "PUT":
        body = await request.body()
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
        return Response(status_code=201)

    if request.method == "DELETE":
        if target.exists():
            if target.is_dir():
                import shutil
                shutil.rmtree(target)
            else:
                target.unlink()
        return Response(status_code=204)

    if request.method == "MKCOL":
        target.mkdir(parents=True, exist_ok=True)
        return Response(status_code=201)

    if request.method == "MOVE":
        dest = request.headers.get("Destination", "")
        if not dest:
            raise HTTPException(status_code=400, detail="Destination header required")
        dest_path = _webdav_path(tenant, dest.replace(f"/vault/{tenant}/", ""))
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        target.rename(dest_path)
        return Response(status_code=204)

    raise HTTPException(status_code=405, detail="Method not allowed")


def run():
    port = int(os.environ.get("PROXY_PORT", "8771"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level=os.environ.get("LOG_LEVEL", "INFO").lower())

from datetime import datetime as _datetime

class _CustomEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, _datetime):
            return obj.isoformat()
        try:
            return super().default(obj)
        except TypeError:
            return str(obj)

if __name__ == "__main__":
    run()
