# Haro Monorepo

**Haro** is the AI ecosystem by Treon Studio — a collection of products and services for
conversational AI, mental wellness, voice assistance, and LLM tooling.

## Projects

| Path | Package | Description |
|------|---------|-------------|
| `apps/website` | `@treonstudio/website` | **Tenang** — AI mental wellness web app (Astro 5 + React 19, Cloudflare Workers) |
| `apps/haro-voice` | — | **Ara** — Python voice assistant (openWakeWord, MiniMax STT/TTS, OpenRouter LLM, FastAPI) |
| `apps/memory-fabric` | — | Python MCP server for mem0 (memory), gbrain (knowledge graph), vault (file storage), tenant management, usage counters, quota enforcement, resource snapshots |
| `apps/haro-gateway` | `@treonstudio/gateway` | AI proxy gateway — routes to 250+ LLMs with fallbacks, caching, guardrails (based on Portkey AI Gateway) |
| `apps/mcp` | `@treonstudio/mcp` | "OKF" MCP Server for knowledge graph navigation |
| `packages/core` | `@treonstudio/bungas-core` | Shared React 19 UI primitives (shadcn), hooks, utils |
| `packages/ts-config` | `@treonstudio/ts-config` | Shared TypeScript configurations |

## Quick Start

```bash
# Install dependencies (website/gateway)
pnpm install

# Run website locally
pnpm dev

# Build website
pnpm build

# Check types & lint
pnpm check
pnpm lint

# Run tests
pnpm test
```

## Deployed Services

| Service | URL | Description |
|---------|-----|-------------|
| Tenang website | [haro-web.treonstudio.workers.dev](https://haro-web.treonstudio.workers.dev) | Astro 5 marketing site + admin dashboard (Cloudflare Workers) |
| Memory Fabric proxy | [haro-proxy.treonstudio.com](https://haro-proxy.treonstudio.com) | REST API for MCP tools + tenant management (Caddy → systemd, port 8771) |
| Admin dashboard | [haro-web.treonstudio.workers.dev/dashboard/admin/tenants](https://haro-web.treonstudio.workers.dev/dashboard/admin/tenants) | Tenant management UI with memory browser, knowledge graph, vault, activity log |
| API health check | [haro-proxy.treonstudio.com/api/health](https://haro-proxy.treonstudio.com/api/health) | Backend health endpoint |
| GitHub | [github.com/Treon-Studio/haro](https://github.com/Treon-Studio/haro) | Source code monorepo |

## Connecting to Services

### Website (Tenang)

Open [haro-web.treonstudio.workers.dev](https://haro-web.treonstudio.workers.dev) in a browser. Sign in via Supabase auth (email/password or OAuth). The admin dashboard is at [/dashboard/admin/tenants](https://haro-web.treonstudio.workers.dev/dashboard/admin/tenants).

### Memory Fabric API

All REST endpoints are behind `haro-proxy.treonstudio.com`. Authenticate with `MANAGEMENT_API_KEY`:

```bash
export MF_KEY="your-management-api-key"

# Health check
curl https://haro-proxy.treonstudio.com/api/health

# List tenants
curl -H "Authorization: Bearer $MF_KEY" \
  https://haro-proxy.treonstudio.com/api/tenants

# Provision a new tenant
curl -X PUT https://haro-proxy.treonstudio.com/api/tenants/provision \
  -H "Authorization: Bearer $MF_KEY" \
  -H "Content-Type: application/json" \
  -d '{"slug":"my-tenant","name":"My Tenant"}'

# Get tenant stats (usage vs quota)
curl -H "Authorization: Bearer $MF_KEY" \
  https://haro-proxy.treonstudio.com/api/tenants/my-tenant/stats

# View audit log
curl -H "Authorization: Bearer $MF_KEY" \
  https://haro-proxy.treonstudio.com/api/tenants/audit-log

# Suspend tenant
curl -X POST https://haro-proxy.treonstudio.com/api/tenants/my-tenant/suspend \
  -H "Authorization: Bearer $MF_KEY"
```

### MCP Client (Python)

```python
from memory_fabric.client import MemoryFabricClient

client = MemoryFabricClient(
    base_url="https://haro-proxy.treonstudio.com",
    api_key="your-management-api-key"
)

# List tenants
tenants = await client.list_tenants()

# Search memories
memories = await client.search_memories(
    tenant_slug="my-tenant",
    query="meeting notes"
)

# Upload file to vault
await client.upload_vault_file(
    tenant_slug="my-tenant",
    file_path="/reports/q1.pdf",
    content=b"..."
)

# Query knowledge graph
result = await client.query_gbrain(
    tenant_slug="my-tenant",
    query="company policy on leave"
)
```

### MCP Client (Claude Desktop / Cursor)

Add to your MCP client config:

```json
{
  "mcpServers": {
    "memory-fabric": {
      "command": "python",
      "args": ["-m", "memory_fabric.server"],
      "env": {
        "MEM0_API_KEY": "...",
        "GBRAIN_API_KEY": "...",
        "VAULT_PATH": "/srv/vault-write",
        "NEON_DATABASE_URL": "..."
      }
    }
  }
}
```



- `apps/website/` — [Tenang website](apps/website/README.md)
- `apps/haro-voice/` — [Ara voice assistant](apps/haro-voice/README.md)
- `apps/memory-fabric/` — [Memory Fabric MCP server](apps/memory-fabric/README.md)
- `apps/haro-gateway/` — [AI gateway](apps/haro-gateway/README.md)
- `apps/mcp/` — [OKF MCP server](apps/mcp/README.md)
- `packages/core/` — [UI component library](packages/core/README.md)
- `packages/ts-config/` — [Shared TS configs](packages/ts-config/README.md)

## License

MIT — see [LICENSE.md](LICENSE.md).
