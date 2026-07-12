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
| Memory Fabric proxy | `haro-proxy.treonstudio.com` | REST API for MCP tools + tenant management (Caddy → systemd, port 8771) |
| Admin dashboard | `/dashboard/admin/tenants` | Tenant management UI with memory browser, knowledge graph, vault, activity log |

## Per-Project Docs

- `apps/website/` — [Tenang website](apps/website/README.md)
- `apps/haro-voice/` — [Ara voice assistant](apps/haro-voice/README.md)
- `apps/memory-fabric/` — [Memory Fabric MCP server](apps/memory-fabric/README.md)
- `apps/haro-gateway/` — [AI gateway](apps/haro-gateway/README.md)
- `apps/mcp/` — [OKF MCP server](apps/mcp/README.md)
- `packages/core/` — [UI component library](packages/core/README.md)
- `packages/ts-config/` — [Shared TS configs](packages/ts-config/README.md)

## License

MIT — see [LICENSE.md](LICENSE.md).
