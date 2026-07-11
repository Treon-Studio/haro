"""REST API proxy for CF Workers — wraps MCP tools in simple JSON endpoint."""

import json
import logging
import os
import traceback
from time import time

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from memory_fabric.tenant_manager import TenantManager, ProvisioningError

logger = logging.getLogger(__name__)

_tenant_status_cache: dict[str, str] = {}
_tenant_cache_ttl: dict[str, float] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes

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

    fn = _resolve_fn(req.tool)
    if fn is None:
        return {"error": f"Unknown tool: {req.tool}"}
    try:
        result = await fn(**req.args) if __import__("inspect").iscoroutinefunction(fn) else fn(**req.args)
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
