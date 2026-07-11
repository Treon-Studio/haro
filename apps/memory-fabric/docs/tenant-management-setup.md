# Tenant Management System — Setup Guide

## Architecture

```
CF Workers (haro-web) ──► VPS Proxy (:8771) ──► Neon DB
     │                        │
     │  signup.ts             │  TenantManager (psycopg2)
     │  dashboard/*           │  /api/tenants/* endpoints
     │                        │  /api/tool suspended check
     │                        │
     └────────────────────────┘
     Management API Key (Bearer)
```

## 1. Database Migration

File: `scripts/migrations/003-tenants.sql`

Creates:

- `tenant_status` enum (`active`, `suspended`, `deleting`, `deleted`)
- `tenant_plan` enum (`free`, `starter`, `pro`, `enterprise`)
- `audit_action` enum (`provisioned`, `suspended`, `reactivated`, `deletion_scheduled`, `deleted`, `plan_changed`, `settings_updated`, `admin_action`)
- `tenants` table — core tenant record with quotas, usage counters, vault/gbrain paths
- `tenant_audit_log` table — immutable action log with `ip_address`, `performed_by`, `metadata`
- `tenant_resource_snapshots` table — usage snapshots for billing
- 7 indexes (unique slug, status/plan lookups, audit log tenant/action/timestamp)
- GIN index `idx_tenants_search` for full-text search on name/slug
- `update_updated_at_column()` trigger function

**Run:**

```bash
source /etc/memory-fabric-mcp/env
psql "$NEON_DATABASE_URL" -f apps/website/scripts/migrations/003-tenants.sql
```

## 2. Environment Variables

Add to `/etc/memory-fabric-mcp/env`:

```env
NEON_DATABASE_URL=postgresql://neondb_owner:...@ep-...pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
MANAGEMENT_API_KEY=<generated-key>
```

Also set `MANAGEMENT_API_KEY` as wrangler secret on haro-web:

```bash
echo '<key>' | wrangler secret put MANAGEMENT_API_KEY
```

And in `apps/website/.env.local`:

```env
MANAGEMENT_API_KEY=<key>
NEON_DATABASE_URL=<url>
```

## 3. TenantManager Class

File: `src/memory_fabric/tenant_manager.py`

Key methods:

| Method | Description |
|--------|-------------|
| `provision(slug, name, ...)` | Creates vault dir, gbrain env file, DB record, audit log entry |
| `get_tenant(slug)` | Returns full tenant record with quotas & usage |
| `list_tenants(...)` | Paginated listing with status/plan/search/date filters |
| `update_status(slug, new_status, ...)` | State machine with allowed transitions, writes audit log |
| `suspend/reactivate/schedule_delete(slug, ...)` | Convenience wrappers |
| `get_stats(slug)` | Usage vs quota with percentage |
| `get_audit_log(tenant_id, action, limit)` | Immutable action history |
| `close()` | Cleanup DB connection |

State machine:

```
active ──► suspended
active ──► deleting
suspended ──► active
suspended ──► deleting
deleting ──► (terminal, cron only moves to deleted)
deleted ──► (terminal)
```

Dependencies: `psycopg2-binary` (installed in `/opt/memory-fabric-mcp-venv/`).

## 4. Proxy API Endpoints

File: `src/memory_fabric/proxy_api.py`

FastAPI app on `:8771` with CORS enabled.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | No | Backend health check |
| `PUT` | `/api/tenants/provision` | Bearer | Provision new tenant (201) |
| `GET` | `/api/tenants` | Bearer | List tenants with pagination/filters |
| `GET` | `/api/tenants/{slug}` | Bearer | Get tenant detail |
| `GET` | `/api/tenants/{slug}/stats` | Bearer | Usage stats with limits |
| `GET` | `/api/tenants/{slug}/audit-log` | Bearer | Per-tenant audit log |
| `GET` | `/api/tenants/audit-log` | Bearer | Global audit log (query: `tenant_id`, `action`, `limit`) |
| `POST` | `/api/tenants/{slug}/suspend` | Bearer | Suspend tenant |
| `POST` | `/api/tenants/{slug}/reactivate` | Bearer | Reactivate tenant |
| `POST` | `/api/tenants/{slug}/schedule-delete` | Bearer | Schedule deletion |
| `POST` | `/api/tool` | Optional | MCP tool proxy + suspended tenant check |

**Route ordering is critical** — `{slug}/stats` and `{slug}/audit-log` must be declared BEFORE `/{slug}` to avoid slug capturing "stats" or "audit-log" as tenant IDs.

Suspended tenant check on `/api/tool` uses a 5-minute TTL cache. Returns 403 with `TENANT_UNAVAILABLE` when tenant is suspended, deleting, or deleted.

**Start:**

```bash
source /etc/memory-fabric-mcp/env
cd apps/memory-fabric
nohup /opt/memory-fabric-mcp-venv/bin/python -m uvicorn memory_fabric.proxy_api:app \
  --host 127.0.0.1 --port 8771 --workers 1 > /var/log/proxy-api.log 2>&1 &
```

## 5. Signup Integration

File: `apps/website/src/pages/api/auth/signup.ts`

After `signUpProgram` succeeds, calls `PUT /api/tenants/provision` non-blocking via `Effect.tap`:

```typescript
.pipe(
  Effect.tap((data) =>
    Effect.tryPromise(() =>
      fetch(`${MANAGEMENT_API_URL}/api/tenants/provision`, {
        method: 'PUT',
        headers: { ... },
        body: JSON.stringify({
          slug: data.user.id,
          name: data.user.full_name || data.user.email,
          company_id: data.user.id, // fallback — TAuthDto has no company field
          created_by: data.user.id,
          plan: 'free',
        }),
      }).catch(() => {}) // fire-and-forget
    )
  )
)
```

This is fire-and-forget — signup succeeds regardless of provisioning result.

## 6. Admin Dashboard

Files:

- `src/pages/dashboard/admin/tenants.astro` — Astro page with auth gate (`DASHBOARD_TOKEN`)
- `src/api/tenants.ts` — API proxy client (list, get, suspend, reactivate, delete, stats)
- `blocks/dashboard/admin/tenant-list.tsx` — React table with search, status/plan filters, pagination, action buttons
- `blocks/dashboard/admin/tenant-detail.tsx` — React detail modal with usage bars, confirm suspend/delete

Dashboard nav link added to sidebar in `src/pages/dashboard/index.astro`.

## 7. Cleanup Cron

Files:

- `scripts/tenant-cleanup.py` — Python script using `_NeonLikeDB`, deletes tenants with `deleted_at < now() - 30 days` + removes vault dirs and env files
- `deploy/tenant-cleanup.service` — systemd service unit
- `deploy/tenant-cleanup.timer` — systemd timer (daily, `OnCalendar=daily`)

**Install:**

```bash
cp deploy/tenant-cleanup.service deploy/tenant-cleanup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now tenant-cleanup.timer
```

## 8. E2E Test

```bash
API="http://127.0.0.1:8771"
KEY="<management-api-key>"

# Provision
curl -s -X PUT "$API/api/tenants/provision" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"slug":"test-tenant","name":"Test","plan":"starter"}'

# List
curl -s "$API/api/tenants?limit=5" -H "Authorization: Bearer $KEY"

# Get
curl -s "$API/api/tenants/test-tenant" -H "Authorization: Bearer $KEY"

# Stats
curl -s "$API/api/tenants/test-tenant/stats" -H "Authorization: Bearer $KEY"

# Suspend
curl -s -X POST "$API/api/tenants/test-tenant/suspend" -H "Authorization: Bearer $KEY"

# Reactivate
curl -s -X POST "$API/api/tenants/test-tenant/reactivate" -H "Authorization: Bearer $KEY"

# Schedule delete
curl -s -X POST "$API/api/tenants/test-tenant/schedule-delete" -H "Authorization: Bearer $KEY"

# Audit log
curl -s "$API/api/tenants/test-tenant/audit-log" -H "Authorization: Bearer $KEY"

# Auth guard (should return 401)
curl -s -X PUT "$API/api/tenants/provision" -d '{"slug":"x"}'

# Suspended check
curl -s -X POST "$API/api/tool" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"tool":"fabric_health","args":{"tenant":"test-tenant"}}'
```

Run unit tests:

```bash
/opt/memory-fabric-mcp-venv/bin/python -m pytest apps/memory-fabric/tests/ -v -q
```

## 9. Files Reference

| Path | Purpose |
|------|---------|
| `apps/website/scripts/migrations/003-tenants.sql` | DB schema migration |
| `apps/memory-fabric/src/memory_fabric/tenant_manager.py` | Core `TenantManager` class (353 lines) |
| `apps/memory-fabric/src/memory_fabric/proxy_api.py` | FastAPI proxy with 8 tenant endpoints |
| `apps/memory-fabric/tests/test_tenant_manager.py` | 24 unit tests |
| `apps/memory-fabric/tests/test_proxy_api_tenants.py` | 4 API tests |
| `apps/memory-fabric/pyproject.toml` | Python deps (psycopg2-binary) |
| `apps/memory-fabric/scripts/tenant-cleanup.py` | Daily cleanup script |
| `apps/memory-fabric/deploy/tenant-cleanup.{service,timer}` | systemd units |
| `apps/website/src/pages/dashboard/admin/tenants.astro` | Admin page |
| `apps/website/blocks/dashboard/admin/tenant-list.tsx` | Tenant table component |
| `apps/website/blocks/dashboard/admin/tenant-detail.tsx` | Detail modal component |
| `apps/website/src/api/tenants.ts` | Dashboard API client |
| `apps/website/src/pages/api/auth/signup.ts` | Signup → provision integration |
| `apps/website/.env.local` | Local env vars |
| `/etc/memory-fabric-mcp/env` | VPS env vars |
