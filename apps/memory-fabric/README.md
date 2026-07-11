# Haro Memory Fabric

MCP server providing mem0 (conversational memory), gbrain (knowledge graph),
vault (file storage), and **tenant management** tools for the Haro AI ecosystem.

## Dev

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
python -m memory_fabric.server
```

## Deploy

```bash
cp deploy/memory-fabric-mcp.service /etc/systemd/system/
cp deploy/env /etc/memory-fabric-mcp/env
systemctl daemon-reload
systemctl enable --now memory-fabric-mcp
```

## API Proxy

The REST API proxy runs on port `8771` — serves MCP tools and tenant management endpoints behind Caddy (`haro-proxy.treonstudio.com`).

```bash
source /etc/memory-fabric-mcp/env
nohup /opt/memory-fabric-mcp-venv/bin/python -m uvicorn \
  memory_fabric.proxy_api:app --host 127.0.0.1 --port 8771 --workers 1 \
  > /var/log/proxy-api.log 2>&1 &
```

## Tenant Management

Full CRUD for multi-tenant provisioning with per-tenant vault directories and gbrain env files.

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | No | Backend health check |
| `PUT` | `/api/tenants/provision` | Bearer | Provision new tenant |
| `GET` | `/api/tenants` | Bearer | List tenants (paginated, filterable) |
| `GET` | `/api/tenants/{slug}` | Bearer | Get tenant detail |
| `GET` | `/api/tenants/{slug}/stats` | Bearer | Usage vs quota stats |
| `GET` | `/api/tenants/{slug}/audit-log` | Bearer | Per-tenant audit log |
| `GET` | `/api/tenants/audit-log` | Bearer | Global audit log |
| `POST` | `/api/tenants/{slug}/suspend` | Bearer | Suspend tenant |
| `POST` | `/api/tenants/{slug}/reactivate` | Bearer | Reactivate tenant |
| `POST` | `/api/tenants/{slug}/schedule-delete` | Bearer | Schedule deletion |

Auth: `Authorization: Bearer <MANAGEMENT_API_KEY>`.

### Daily Cleanup Cron

Removes soft-deleted tenants (30 days after `deleted_at`), vault dirs, and env files:

```bash
cp deploy/tenant-cleanup.{service,timer} /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now tenant-cleanup.timer
```

### Tests

```bash
/opt/memory-fabric-mcp-venv/bin/python -m pytest tests/ -v -q
```

### Database

Migration file: `../website/scripts/migrations/003-tenants.sql`

```bash
psql "$NEON_DATABASE_URL" -f ../website/scripts/migrations/003-tenants.sql
```

### Setup Docs

See [`docs/tenant-management-setup.md`](docs/tenant-management-setup.md) for full E2E test commands, architecture diagram, and file reference.
