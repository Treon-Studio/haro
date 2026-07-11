import json
import logging
import os
import shlex
import subprocess
from pathlib import Path

import httpx
import uvicorn
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

MEM0_API = os.environ.get("MEM0_API_URL", "http://127.0.0.1:7000")
GBRAIN_BIN = os.environ.get("GBRAIN_BIN", "/root/.bun/bin/gbrain")
VAULT_ROOT = Path(os.environ.get("VAULT_ROOT", "/srv/vault-write"))

mcp = FastMCP(
    "memory-fabric-mcp",
    host=os.environ.get("BIND_HOST", "127.0.0.1"),
    port=int(os.environ.get("BIND_PORT", "8770")),
    log_level=os.environ.get("LOG_LEVEL", "INFO"),
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=False,
    ),
)

# ---------------------------------------------------------------------------
#  mem0 tools
# ---------------------------------------------------------------------------

def _mem0_headers():
    return {"Content-Type": "application/json"}


@mcp.tool(description="""Store a memory in the mem0 memory layer.

Memories are stored as conversations (message pairs) and embedded for semantic
retrieval. At least one of user_id, agent_id, or run_id is required to scope
the memory.

Args:
  messages: List of {"role": "user"|"assistant", "content": "..."} dicts.
  user_id: Scoping identifier (e.g. "tenant-test001_user123").
  agent_id: Scoping identifier for a specific agent.
  run_id: Scoping identifier for a specific run/session.
  metadata: Optional dict of metadata to attach.

Returns:
  The mem0 response including the stored memory id.""")
def memory_store(messages: list, user_id: str | None = None,
                 agent_id: str | None = None, run_id: str | None = None,
                 metadata: dict | None = None) -> str:
    body = {"messages": messages}
    if user_id: body["user_id"] = user_id
    if agent_id: body["agent_id"] = agent_id
    if run_id: body["run_id"] = run_id
    if metadata: body["metadata"] = metadata
    try:
        resp = httpx.post(f"{MEM0_API}/memories", json=body, headers=_mem0_headers(), timeout=120)
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        logger.exception("memory_store failed")
        return json.dumps({"error": str(e)})


@mcp.tool(description="""Search memories by semantic query.

Args:
  query: Natural-language search query.
  user_id: Optional scope filter (passed as filter to mem0).
  agent_id: Optional scope filter (passed as filter to mem0).
  run_id: Optional scope filter (passed as filter to mem0).
  filters: Optional dict of additional filters.

Returns:
  Ranked list of matching memories with scores.""")
def memory_search(query: str, user_id: str | None = None,
                  agent_id: str | None = None, run_id: str | None = None,
                  filters: dict | None = None) -> str:
    body = {"query": query}
    scope = {}
    if user_id: scope["user_id"] = user_id
    if agent_id: scope["agent_id"] = agent_id
    if run_id: scope["run_id"] = run_id
    if filters: scope.update(filters)
    if scope:
        body["filters"] = scope
    try:
        resp = httpx.post(f"{MEM0_API}/search", json=body, headers=_mem0_headers(), timeout=30)
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        logger.exception("memory_search failed")
        return json.dumps({"error": str(e)})


@mcp.tool(description="""List all memories for a given scope.

Args:
  user_id: Scope filter (required unless agent_id or run_id provided).
  agent_id: Scope filter.
  run_id: Scope filter.

Returns:
  List of all memories matching the scope.""")
def memory_list(user_id: str | None = None,
                agent_id: str | None = None,
                run_id: str | None = None) -> str:
    params = {}
    if user_id: params["user_id"] = user_id
    if agent_id: params["agent_id"] = agent_id
    if run_id: params["run_id"] = run_id
    try:
        resp = httpx.get(f"{MEM0_API}/memories", params=params, headers=_mem0_headers(), timeout=30)
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        logger.exception("memory_list failed")
        return json.dumps({"error": str(e)})


@mcp.tool(description="""Get a single memory by its id.

Args:
  memory_id: The memory id returned by memory_store or memory_list.

Returns:
  The full memory record.""")
def memory_get(memory_id: str) -> str:
    try:
        resp = httpx.get(f"{MEM0_API}/memories/{memory_id}", headers=_mem0_headers(), timeout=30)
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        logger.exception("memory_get failed")
        return json.dumps({"error": str(e)})


@mcp.tool(description="""Delete a memory by its id.

Args:
  memory_id: The memory id to delete.

Returns:
  Confirmation message.""")
def memory_delete(memory_id: str) -> str:
    try:
        resp = httpx.delete(f"{MEM0_API}/memories/{memory_id}", headers=_mem0_headers(), timeout=30)
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        logger.exception("memory_delete failed")
        return json.dumps({"error": str(e)})


# ---------------------------------------------------------------------------
#  gbrain tools
# ---------------------------------------------------------------------------

def _gbrain_env(tenant: str | None = None):
    env = os.environ.copy()
    if tenant:
        env_file = f"/srv/memory-fabric/env/{tenant}.env"
        if Path(env_file).exists():
            with open(env_file) as f:
                for line in f:
                    line = line.strip()
                    if "=" in line and not line.startswith("#"):
                        k, v = line.split("=", 1)
                        env[k] = v
    return env


def _run_gbrain(args: list[str], tenant: str | None = None) -> str:
    cmd = [GBRAIN_BIN] + args
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30,
                                env=_gbrain_env(tenant))
        if result.returncode != 0:
            return json.dumps({"error": result.stderr.strip()})
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        return json.dumps({"error": "gbrain command timed out"})
    except Exception as e:
        logger.exception("gbrain command failed")
        return json.dumps({"error": str(e)})


@mcp.tool(description="""Write or update a page in the gbrain knowledge graph.

Pages are markdown documents stored in the brain database. The slug is the
unique identifier used for retrieval.

Args:
  slug: Unique page identifier (e.g. "people/john-doe").
  content: Markdown content of the page.
  tenant: Optional tenant name (e.g. "tenant-test001"). If omitted, uses
    the default gbrain database.

Returns:
  Confirmation with the page slug.""")
def gbrain_put(slug: str, content: str, tenant: str | None = None) -> str:
    try:
        proc = subprocess.Popen(
            [GBRAIN_BIN, "put", slug],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=_gbrain_env(tenant),
        )
        stdout, stderr = proc.communicate(input=content, timeout=30)
        if proc.returncode != 0:
            return json.dumps({"error": stderr.strip()})
        return json.dumps({"ok": True, "slug": slug, "detail": stdout.strip()})
    except subprocess.TimeoutExpired:
        return json.dumps({"error": "gbrain put timed out"})
    except Exception as e:
        logger.exception("gbrain_put failed")
        return json.dumps({"error": str(e)})


@mcp.tool(description="""Read a page from the gbrain knowledge graph by slug.

Args:
  slug: The page slug to retrieve.
  tenant: Optional tenant name.

Returns:
  The page content as markdown.""")
def gbrain_get(slug: str, tenant: str | None = None) -> str:
    return _run_gbrain(["get", slug], tenant)


@mcp.tool(description="""Keyword-search pages in the gbrain knowledge graph.

Args:
  query: Search query (keyword, tsvector-based).
  tenant: Optional tenant name.

Returns:
  List of matching pages with snippets.""")
def gbrain_search(query: str, tenant: str | None = None) -> str:
    return _run_gbrain(["search", query], tenant)


@mcp.tool(description="""Hybrid semantic search across the gbrain knowledge graph.

Combines keyword and vector search with RRF fusion. Use this for natural
language questions.

Args:
  question: Natural language question to answer from the brain.
  tenant: Optional tenant name.

Returns:
  Ranked list of relevant pages with scores.""")
def gbrain_query(question: str, tenant: str | None = None) -> str:
    return _run_gbrain(["query", question], tenant)


@mcp.tool(description="""List pages in the gbrain knowledge graph.

Args:
  type_filter: Optional page type to filter by (e.g. "person", "concept").
  tag: Optional tag to filter by.
  limit: Maximum number of results (default 20).
  tenant: Optional tenant name.

Returns:
  List of pages matching the filters.""")
def gbrain_list(type_filter: str | None = None, tag: str | None = None,
                limit: int = 20, tenant: str | None = None) -> str:
    args = ["list", "-n", str(limit)]
    if type_filter:
        args.extend(["--type", type_filter])
    if tag:
        args.extend(["--tag", tag])
    return _run_gbrain(args, tenant)


@mcp.tool(description="""Get gbrain health and statistics.

Args:
  tenant: Optional tenant name.

Returns:
  JSON with health status and index stats.""")
def gbrain_stats(tenant: str | None = None) -> str:
    result = _run_gbrain(["doctor", "--json"], tenant)
    try:
        data = json.loads(result)
        return json.dumps(data, indent=2)
    except (json.JSONDecodeError, TypeError):
        return result


# ---------------------------------------------------------------------------
#  vault tools
# ---------------------------------------------------------------------------

def _vault_path(tenant: str) -> Path:
    return VAULT_ROOT / tenant


@mcp.tool(description="""Read a file from the tenant's vault.

Files are stored on disk under /srv/vault-write/{tenant}/ and are
bi-directionally synced with CouchDB via LiveSync.

Args:
  path: Relative file path within the vault (e.g. "notes/my-note.md").
  tenant: Tenant name (e.g. "tenant-test001" or "treonstudio").

Returns:
  The file content as text.""")
def vault_read(path: str, tenant: str) -> str:
    full = _vault_path(tenant) / path
    if not full.exists():
        return json.dumps({"error": f"File not found: {path}"})
    if not full.is_file():
        return json.dumps({"error": f"Not a file: {path}"})
    try:
        return full.read_text()
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool(description="""Write content to a file in the tenant's vault.

The file is created or overwritten on disk, then automatically synced to
CouchDB by LiveSync.

Args:
  path: Relative file path within the vault (e.g. "notes/my-note.md").
  content: Text content to write.
  tenant: Tenant name (e.g. "tenant-test001" or "treonstudio").

Returns:
  Confirmation with the file path.""")
def vault_write(path: str, content: str, tenant: str) -> str:
    full = _vault_path(tenant) / path
    try:
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_text(content)
        return json.dumps({"ok": True, "path": str(full)})
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool(description="""List files and directories in a vault path.

Args:
  path: Directory path within the vault (default "." for root).
  tenant: Tenant name.

Returns:
  List of entries with type (file/dir) and size.""")
def vault_list(path: str = ".", tenant: str = "") -> str:
    full = _vault_path(tenant) / path
    if not full.exists():
        return json.dumps({"error": f"Path not found: {path}"})
    if not full.is_dir():
        return json.dumps({"error": f"Not a directory: {path}"})
    try:
        entries = []
        for entry in sorted(full.iterdir()):
            info = {"name": entry.name, "type": "dir" if entry.is_dir() else "file"}
            if entry.is_file():
                info["size"] = entry.stat().st_size
            entries.append(info)
        return json.dumps(entries, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


# ---------------------------------------------------------------------------
#  health
# ---------------------------------------------------------------------------

@mcp.tool(description="""Check connectivity to all memory fabric backends.

Pings mem0, tries a quick gbrain doctor, and checks vault root accessibility.

Returns:
  JSON with per-service status.""")
def fabric_health() -> str:
    results = {}
    try:
        r = httpx.get(f"{MEM0_API}/health", timeout=5)
        results["mem0"] = "ok" if r.status_code == 200 else f"http_{r.status_code}"
    except Exception as e:
        results["mem0"] = f"error: {e}"

    try:
        r = _run_gbrain(["doctor", "--json"])
        data = json.loads(r)
        results["gbrain"] = "ok" if isinstance(data, dict) else r[:100]
    except Exception as e:
        results["gbrain"] = f"error: {e}"

    vaults = {}
    for d in VAULT_ROOT.iterdir():
        if d.is_dir():
            try:
                test_file = d / ".mcp-health"
                test_file.touch()
                test_file.unlink()
                vaults[d.name] = "ok"
            except Exception as e:
                vaults[d.name] = f"error: {e}"
    results["vault"] = vaults
    return json.dumps(results, indent=2)


def main():
    logger.info(
        "memory-fabric-mcp starting — mem0=%s gbrain=%s vault=%s bind=%s:%s",
        MEM0_API, GBRAIN_BIN, VAULT_ROOT,
        os.environ.get("BIND_HOST", "127.0.0.1"),
        os.environ.get("BIND_PORT", "8770"),
    )
    uvicorn.run(
        mcp.streamable_http_app(),
        host=os.environ.get("BIND_HOST", "127.0.0.1"),
        port=int(os.environ.get("BIND_PORT", "8770")),
        log_level=os.environ.get("LOG_LEVEL", "INFO").lower(),
    )


if __name__ == "__main__":
    main()
