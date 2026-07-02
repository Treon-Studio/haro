<purpose>
This file defines the strict architectural rules for the backend (`apps/api`), which uses Hono, Cloudflare Workers, and Drizzle ORM.
</purpose>

<cloudflare_workers_rules>
- **No Node.js APIs**: Cloudflare Workers run on V8 isolates, not Node.js. Do not use `fs`, `path`, or other Node-only built-ins.
- **Environment Bindings**: Always access environment variables and bindings (D1, KV) via the Hono Context (`c.env`), NEVER via global `process.env`.
- **Statelessness**: Never use global or module-level variables to store request state. Isolates are reused across requests, leading to data leaks.
</cloudflare_workers_rules>

<drizzle_d1_rules>
- **D1 Driver**: Use `drizzle-orm/d1` for database connections. 
- **SQLite Dialect**: D1 is based on SQLite. Optimize queries for SQLite (no Postgres-specific features).
- **Workspace Scoping**: EVERY query (Select, Update, Delete) MUST be filtered by `workspaceId`.
</drizzle_d1_rules>

<hono_routing_rules>
- **No Heavy Controllers**: Avoid MVC-style class controllers. Use `app.route()` to modularize endpoints functionally.
- **Middleware Order**: Enforce `auth() → workspaceScope() → featureGate() → rbac()`.
- **Pagination Required**: Every endpoint returning a data list MUST implement pagination (e.g., returning `{ data, total, page, limit, totalPages }`). Do not return unbounded arrays.
</hono_routing_rules>
