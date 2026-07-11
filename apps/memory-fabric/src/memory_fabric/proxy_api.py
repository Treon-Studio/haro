"""REST API proxy for CF Workers — wraps MCP tools in simple JSON endpoint."""

import json
import logging
import os
import traceback

import httpx
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logger = logging.getLogger(__name__)

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


def run():
    port = int(os.environ.get("PROXY_PORT", "8771"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level=os.environ.get("LOG_LEVEL", "INFO").lower())
