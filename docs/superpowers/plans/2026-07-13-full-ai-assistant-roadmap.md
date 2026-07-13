# Full AI Assistant — Roadmap & Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> See `docs/superpowers/specs/2026-07-13-full-ai-assistant-design.md` for the full analysis, findings, and architecture rationale behind every task below — this doc is the "what to do", the spec is the "why".

**Goal:** Turn five isolated apps (website, haro-gateway, memory-fabric, mcp/OKF, haro-voice) into one coherent AI assistant — shared identity, server-side tool execution, real memory recall, consistent safety guardrails, reachable from web chat and voice alike.

**Architecture:** Fix identity/tenant fragmentation and a live auth hole first (Hotfix + Phase 0, including per-tenant service tokens replacing the shared `MANAGEMENT_API_KEY` for tenant-scoped calls). Then move tool execution server-side, drop BYOK, and route chat through `haro-gateway` via a Haro-managed fallback config (Phase 1) before wiring real memory/knowledge-graph tools and migrating conversation history to Neon (Phase 2) and safety guardrails with auto-appended resource messages + silent escalation (Phase 3). Build the agent loop as a portable in-process module inside `apps/website`, and only extract it into a dedicated `apps/assistant-orchestrator` service (Phase 4) once `haro-voice` becomes a second real caller (Phase 5, pairing-code device auth, shared Neon conversation history, local-LLM fallback for resilience). MCP-facing unification (Phase 6) and hardening (Phase 7) come last.

**Tech Stack:** Astro 5 + React 19 (website), Hono (gateway, mcp), Python/FastAPI (memory-fabric), Python (haro-voice), Neon PostgreSQL (conversation history + tenants, replacing Cloudflare KV for conversations), Cloudflare Workers/KV (short-lived caches only), JWT-based per-tenant service tokens (`jose` on TS side, `pyjwt` on Python side)

---

## Global Constraints

- All memory-fabric tool calls go through `POST /api/tool {tool, args}` in `proxy_api.py` — never call `memory_fabric.server` functions directly from another app.
- Reuse `MemoryFabricService` pattern (`apps/mcp/src/services/memory-fabric-service.ts`) wherever a new TS client needs to hit `/api/tool` — don't reinvent it.
- Gateway handlers (`chatCompletionsHandler.ts`, `messagesHandler.ts`) are pass-through and should stay that way — tool execution belongs in the caller, not the gateway.
- Every new/changed endpoint that touches tenant data must derive tenant identity from a trusted server-side source (session, service credential) — never trust a client-supplied `tenant` field again (that's exactly the Hotfix bug).
- Follow existing repo conventions: Astro API routes in `apps/website/src/pages/api/`, domain logic in `apps/website/src/domain/`, systemd services in `apps/memory-fabric/deploy/`.
- **Task-number note for the shared `.superpowers/sdd/progress.md` ledger:** this repo's ledger already reuses numbers like `Task 1.1`/`2.1`/`3.1` across unrelated older plans (`2026-07-11-tenant-management.md`, `2026-07-12-memory-fabric-phase2.md`), and this plan's Phase 1-7 task numbers (`1.1`-`7.4`) also collide by number with those older, already-completed entries. When resuming execution of *this* plan from the ledger, match on the commit range and description text, not the bare `Task N.M` label — the label alone is not unique across plans in this repo's history.

---

## Execution Order & Parallelism

Every task below (26 total, Task 0.0 through 7.4) has an explicit **Depends on:** line. This section is the bird's-eye summary — use it to pick what to dispatch next without re-deriving the graph from 26 individual lines. `[DONE]` = already implemented and committed; do not re-dispatch (see each task's own note for commit range).

**Status as of 2026-07-13:** `[DONE]` 0.0, 0.1, 0.2, 0.3, 1.1, 3.1. Next unblocked: 0.4 (Track A), 1.2 (Track B), 2.4 (Track D, independent). Everything else pending.

Independent tracks that can be worked **in parallel** (no cross-track dependency until they converge at Task 4.1):

| Track | Sequence | Converges at |
|---|---|---|
| **A — Identity foundation** | 0.0 [DONE] → 0.4 · 0.1 [DONE] (independent) · 0.2 ∥ 0.3 → 0.4 | feeds Track D and Task 4.1 |
| **B — Gateway routing + loop** | 1.1 → 1.2 → 1.3 | feeds Track D, Track E, Task 4.1 |
| **C — Safety plugin** | 3.1 (fully independent, start any time) | feeds Track E |
| **D — Memory wiring** | (needs Track A's 0.3+0.4, Track B's 1.2) → 2.1 → 2.2 → 2.3 · 2.4 independent, run any time | feeds Task 4.1 |
| **E — Safety wiring** | (needs Track B's 1.2, Track C's 3.1) → 3.2 | feeds Task 4.1 |

**Gate — Task 4.1** requires ALL of: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 0.4 complete. This is the single biggest join point in the plan — nothing in Phase 5/6/7 (except the few explicitly marked independent below) can start before it.

After Task 4.1 (orchestrator exists):

| Track | Sequence |
|---|---|
| **F — Voice** | 5.1 (can actually start early, parallel with B-E — only needs Track A's 0.2/0.3) → 5.2 (needs 4.1+5.1) → 5.3, 5.5 (parallel, both need 5.2) · 5.4 needs 2.4+4.1+5.1 |
| **G — MCP** | 6.1 (needs 4.1) · 6.2 (needs 2.2+1.3 — can actually start right after Track B/D, doesn't need to wait for Phase 4/5 despite living in "Phase 6") |
| **H — Hardening** | 7.1 (independent, any time after Track D lands) · 7.2, 7.3, 7.4 (all need 4.1; 7.3 also needs 0.4) |

**Practical dispatch order for a fresh controller agent:** Track A (0.2, 0.3, then 0.4) and Track B (1.1→1.2→1.3) can be dispatched immediately and in parallel with each other; Track C (3.1) and Task 5.1 can also start immediately, independently of everything else. Track D and Track E each wait on one item from Track A/B/C. Once Track D and Track E both reach their last task (2.3 and 3.2), Task 4.1 is unblocked. Track F/G/H mostly wait on Task 4.1, except 6.2 and 7.1 which can jump ahead once Track D finishes.

---

## Hotfix (do first, independent of all phases below)

### Task 0.0: Authenticate `/api/tool` and lock down CORS

**Depends on:** none — first task, no prerequisites. **Status: already complete** (commits `efec1a3..037bfef`, see `.superpowers/sdd/progress.md`) — kept here for context only, do not re-dispatch.

**Files:**
- Modify: `apps/memory-fabric/src/memory_fabric/proxy_api.py`

**Interfaces:**
- Consumes: existing `require_auth(request)` helper (already used by all `/api/tenants/*` routes)
- Produces: `/api/tool` now requires `Authorization: Bearer <MANAGEMENT_API_KEY>`; CORS no longer wildcard

**Why now:** confirmed in code — `call_tool()` at `proxy_api.py:82` is the only mutating/reading endpoint in the file without `require_auth()`, and it accepts a client-supplied `tenant` field. This is a live cross-tenant data exposure, independent of the rest of the roadmap.

- [ ] **Step 1: Add auth check to `call_tool`**

```python
# apps/memory-fabric/src/memory_fabric/proxy_api.py
@app.post("/api/tool")
async def call_tool(req: ToolRequest, request: Request):
    require_auth(request)
    args = req.args if isinstance(req.args, dict) else {}
    ...
```

(Note: `call_tool` needs `request: Request` added to its signature to access headers — it doesn't currently take one.)

- [ ] **Step 2: Restrict CORS to known callers**

```python
# apps/memory-fabric/src/memory_fabric/proxy_api.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("PROXY_ALLOWED_ORIGINS", "").split(",") or [],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Add `PROXY_ALLOWED_ORIGINS` to `apps/memory-fabric/deploy/env.example` and `/etc/memory-fabric-mcp/env` (comma-separated list; empty = no browser origins allowed, server-to-server only).

- [ ] **Step 3: Update existing callers to send the auth header**

Check `apps/mcp/src/services/memory-fabric-service.ts` — it already supports `config.apiKey` → `Authorization: Bearer` (see constructor), so confirm whatever instantiates `MemoryFabricService` in `apps/mcp` passes a real key. Grep other callers of `/api/tool` (dashboard `callMemoryTool` in `apps/website/src/lib/memory-fabric.ts` per `docs/superpowers/plans/2026-07-12-memory-fabric-phase2.md`) and confirm they send `MANAGEMENT_API_KEY` too.

- [ ] **Step 4: Test**

```bash
cd /root/go-workspace/haro/apps/memory-fabric
# Unauthenticated request must now be rejected
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:8771/api/tool \
  -H "Content-Type: application/json" -d '{"tool":"memory_search","args":{"tenant":"any"}}'
# Expected: 401

# Authenticated request still works
curl -s -X POST http://127.0.0.1:8771/api/tool \
  -H "Authorization: Bearer $MANAGEMENT_API_KEY" -H "Content-Type: application/json" \
  -d '{"tool":"memory_search","args":{"tenant":"default","query":""}}'
# Expected: 200 with a result
```

- [ ] **Step 5: Commit**

```bash
cd /root/go-workspace/haro
git add apps/memory-fabric/src/memory_fabric/proxy_api.py apps/memory-fabric/deploy/env.example
git commit -m "fix: require auth and restrict CORS on /api/tool endpoint"
```

---

## Phase 0 — Identity & Tenant Foundation

**Goal:** one trustworthy tenant/identity signal every downstream service can rely on. See spec §2.1 for the four currently-disconnected schemes.

### Task 0.1: Fix signup-time tenant provisioning

**Depends on:** none — independent of Task 0.0 (calls `/api/tenants/provision`, not `/api/tool`; unaffected by 0.0's changes). **Status: already complete** (commits `037bfef..94be3d7`) — kept here for context only, do not re-dispatch.

**Decision (confirmed with user 2026-07-13):** investigation found `signup.ts` never has a real `company.id` for non-invited signups — `POST /api/companies` is a separate, later, authenticated endpoint; only invitation-based signups have a real company at signup time (via the accepted invitation). Resolution: provision a **personal tenant** using `user.id` at signup for the common (non-invited) case — this is intentional, not a fallback bug. For invitation-based signups, use the invitation's real `company_id` instead.

**Files:**
- Modify: `apps/website/src/pages/api/auth/signup.ts`

**Interfaces:**
- Consumes: `data.user.id` (personal tenant case) or the accepted invitation's `company_id` (invited-signup case) — determine which path via whether `invitationToken` was present/consumed in `signUpProgram`'s result
- Produces: synchronous, verified `PUT /api/tenants/provision` call — signup fails loudly if provisioning fails, instead of logging and continuing

- [ ] **Step 1:** Confirm whether `signUpProgram`'s returned DTO (`TAuthDto`) exposes enough to distinguish "invited into an existing company" vs "organic signup" (e.g. does it carry the invitation's `company_id` anywhere after `acceptInvitation`?). If not, extend the DTO/program minimally so `signup.ts` can tell the two cases apart without re-querying.
- [ ] **Step 2:** For the invited case, call `provisionTenant` with the invitation's real `company_id` (skip provisioning entirely if that tenant/company was already provisioned by the inviter — check before creating a duplicate). For the organic case, call `provisionTenant` with `company.id = user.id` (personal tenant) — this keeps today's `user.id` value but now as a deliberate personal-tenant identifier, not a mislabeled "company" fallback.
- [ ] **Step 3:** Make the provisioning call block signup completion; surface a clear error to the user if it fails (currently fire-and-forget, errors only logged at lines 34-43).
- [ ] **Step 4:** Add/update `apps/website/src/pages/api/__tests__/` coverage for: organic signup → personal tenant provisioned; invited signup → joins inviter's company tenant (no duplicate provisioning); provisioning failure → signup fails loudly.
- [ ] **Step 5:** Test manually — sign up a new (non-invited) user, confirm a `tenants` row exists via `GET /api/tenants/:slug`; sign up via an invitation, confirm the invited user's tenant matches the inviter's company tenant, not a new one.
- [ ] **Step 6:** Commit.

### Task 0.2: Thread tenant identity through the website session

**Depends on:** none (independent of 0.0/0.1). Parallelizable with Task 0.3 — coordinate on field names (`tenantSlug`, `companyId`) since 0.3's type must match what this task's resolver actually returns. **Status: already complete** (commit `0c55e27`) — kept here for context only, do not re-dispatch.

**Files:**
- Modify: `apps/website/src/lib/auth/session.ts`, `apps/website/src/middleware/auth.ts`
- Modify: `apps/website/src/pages/dashboard/index.astro`, `apps/website/src/pages/api/memories.ts`, `apps/website/src/pages/api/gbrain.ts`, `apps/website/src/pages/api/vault.ts`

**Interfaces:**
- Consumes: `company_memberships` lookup by `userId`
- Produces: `context.locals.session` gains a resolved `tenantSlug` (and `companyId`); all tenant-scoped API routes derive tenant from `locals.session`, not client query params

- [x] **Step 1:** Resolution strategy (decided — implement as-is, no further decision needed): resolve `tenantSlug` **server-side from `company_memberships` on each request**, not embedded in the `tenang-session` JWT. Rationale: session JWTs already exist and are small; a per-request DB lookup is simpler to keep correct (no stale tenant on JWT until re-login) and there's no measured load concern forcing the cheaper-but-staler JWT-embed alternative — revisit only if profiling later shows this lookup is a real bottleneck.
- [x] **Step 2:** Add a small resolver (e.g. `getTenantForSession(session)`) in `src/lib/auth/` that looks up the user's active `company_memberships` row and returns the linked tenant slug.
- [x] **Step 3:** Replace `const tenant = "default"` in `dashboard/index.astro` and the `?tenant=` query-param reads in `api/memories.ts`/`api/gbrain.ts`/`api/vault.ts` with calls to this resolver via `locals.session`.
- [x] **Step 4:** Test — log in as two different users/companies, confirm each only sees their own tenant's memories/gbrain/vault via the dashboard.
- [x] **Step 5:** Commit.

### Task 0.3: Define the shared identity contract

**Depends on:** none (independent of 0.0/0.1). Parallelizable with Task 0.2 — see 0.2's note on coordinating field names. **Status: already complete** (commit `0747f71`) — kept here for context only, do not re-dispatch.

**Files:**
- Create: `apps/website/src/shared/types/identity.ts` (or extend `src/shared/types/`)

**Interfaces:**
- Produces: `{ userId: string, tenantSlug: string, companyId?: string, role: string }` type, used by Task 0.2's resolver and by Phase 1+ tool-calling code

- [x] **Step 1:** Define the type and a short doc comment on where it's populated from (session + `company_memberships`).
- [x] **Step 2:** Commit.

### Task 0.4: Per-tenant service token (replaces shared `MANAGEMENT_API_KEY` for tenant-scoped calls)

**Depends on:** Task 0.0 (modifies the `require_auth` usage in `call_tool` that 0.0 added), Task 0.3 (the identity contract's `tenantSlug` field is what gets minted into tokens).

**Decision (confirmed with user 2026-07-13):** service-to-service auth between callers (website's assistant loop now, the orchestrator from Phase 4 onward) and memory-fabric/gateway uses **short-lived per-tenant signed tokens**, not the single shared `MANAGEMENT_API_KEY` Task 0.0 used. This also closes the ⚠️ finding from Task 0.0's review that was explicitly deferred here: `call_tool` still trusts a client-supplied `tenant` field in the request body — with this task, tenant identity comes from the verified token instead.

**Design:**
- A minting caller (website's assistant module in Phase 1-3; the orchestrator from Phase 4 on) signs a short-lived JWT (~5 min TTL) with claims `{tenantSlug, iss, aud: "memory-fabric", exp}`, using a symmetric secret (`SERVICE_JWT_SECRET`) shared only between trusted backend services — never sent to a browser.
- `apps/website` already depends on `jose` for its own session JWTs (`src/lib/auth/session.ts`) — reuse the same library for minting, don't add a new one.
- `apps/memory-fabric` has no JWT library yet (`pyproject.toml` currently lists only `mcp`, `httpx`, `uvicorn`, `psycopg2-binary`) — add `pyjwt`.
- `apps/haro-gateway/plugins/default/jwt.ts` already implements JWT verification as a guardrail plugin — read it first for a verification-logic reference, even though this task's verification happens in memory-fabric (Python), not the gateway.

**Files:**
- Modify: `apps/memory-fabric/src/memory_fabric/proxy_api.py` — replace `require_auth`'s use in `call_tool` (added in Task 0.0) with a new `require_tenant_auth(request) -> str` that verifies the JWT and returns the verified `tenantSlug`
- Modify: `apps/memory-fabric/pyproject.toml` — add `pyjwt`
- Create: `apps/website/src/lib/auth/service-token.ts` (or similar) — `mintServiceToken(tenantSlug: string): Promise<string>`, used by Task 2.1's memory-fabric client
- Modify: `apps/memory-fabric/deploy/env.example`, `/etc/memory-fabric-mcp/env` — add `SERVICE_JWT_SECRET`

**Interfaces:**
- Produces: `mintServiceToken(tenantSlug)` (TS, website/future-orchestrator side) and `require_tenant_auth(request) -> tenant_slug` (Python, memory-fabric side)
- Consumes: Task 0.3's identity contract (the caller must already know the verified `tenantSlug` before minting — this task doesn't determine identity, it propagates an already-trusted one)

- [ ] **Step 1:** Add `pyjwt` to `memory-fabric`'s dependencies; add `SERVICE_JWT_SECRET` to env config (generate and document a dev-environment value in `env.example`, never commit a real secret).
- [ ] **Step 2:** Implement `require_tenant_auth(request)` in `proxy_api.py`: extract `Authorization: Bearer <token>`, verify signature + `exp` + `aud == "memory-fabric"`, return the `tenantSlug` claim (raise 401 on any failure — invalid signature, expired, wrong audience).
- [ ] **Step 3:** Update `call_tool` to use `require_tenant_auth` instead of `require_auth`, and use the **verified token's tenant**, not `args.get("tenant")`, for the tenant-status/quota/usage-accounting logic added in earlier work. If `args` also contains a `tenant`/`user_id`-derived value used for the actual tool call semantics (e.g., which mem0 namespace to write to), reject the call (403) if it doesn't match the token's tenant — don't silently prefer one over the other.
- [ ] **Step 4:** Keep `require_auth`/`MANAGEMENT_API_KEY` in place for the existing `/api/tenants/*` admin routes (those are called by website's admin/super-admin flows on behalf of the platform, not a specific tenant — a shared operator secret remains appropriate there). This task narrows scope to `/api/tool` only.
- [ ] **Step 5:** Implement `mintServiceToken` on the website side; update Task 2.1's memory-fabric client to call it per-request instead of sending a static `MANAGEMENT_API_KEY`.
- [ ] **Step 6:** Update existing callers that currently send `MANAGEMENT_API_KEY` to `/api/tool` (per Task 0.0's review: `apps/mcp/src/services/memory-fabric-service.ts`, `apps/website/src/lib/memory-fabric.ts`) to mint/send a tenant-scoped token instead — these calls are already tenant-scoped in practice (they always operate on behalf of one tenant), so this is a mechanical swap, not a redesign.
- [ ] **Step 7:** Test: a token minted for tenant A must be rejected (or scoped only to A) when used to access tenant B's data — write this as an explicit regression test, mirroring Task 0.0's `test_call_tool_requires_auth` pattern in `apps/memory-fabric/tests/test_proxy_api_tenants.py`.
- [ ] **Step 8:** Commit.

---

## Phase 1 — Server-Side Tool Execution + Route Chat Through the Gateway

**Goal:** stop executing tools in the browser, stop bypassing `haro-gateway`. Infrastructure-only — no new user-facing capability yet. See spec §2.3, §2.5.

### Task 1.1: Reroute `api/chat.ts` through `haro-gateway`

**Depends on:** none from Phase 0 — this task's routing change (chat.ts → gateway via `x-haro-config-id`) doesn't touch tenant-scoped auth, so it has no hard dependency on Task 0.0-0.4 and could in principle be worked in parallel with Phase 0. Sequenced first in Phase 1 by convention, not by a technical requirement. **Status: already complete** (commits `5d73a2b..f3bdbda`) — kept here for context only, do not re-dispatch.

**Files:**
- Modify: `apps/website/src/pages/api/chat.ts`
- Modify: `apps/website/blocks/chat/components/SettingsDialog.tsx` — delete the entire "Providers" BYOK tab (lines ~207+, per the `apiKeys`/`saveApiKey`/`PROVIDERS` UI found there)
- Modify: `apps/website/blocks/chat/config/providers.ts` — remove/repurpose `loadApiKey`/`saveApiKey` (client-key storage no longer used); keep the `PROVIDERS` model-name/compatibility map only if still needed for display (e.g. a model picker), not for routing
- Create (ops, not app code): a `gateway_configs` row (via the gateway admin API/UI — `apps/haro-gateway/src/handlers/adminConfigsHandler.ts`) defining the fallback chain the assistant uses
- Reference (do not modify): `apps/haro-gateway/src/handlers/chatCompletionsHandler.ts`, `apps/haro-gateway/src/middlewares/configResolver/index.ts`, `apps/haro-gateway/src/config/virtualKeyResolver.ts`, `apps/haro-gateway/src/config/configPresetResolver.ts`

**Decision (confirmed with user 2026-07-13): remove BYOK entirely, move to full Haro-managed routing.** Today `chat.ts` accepts a client-supplied `apiKey` (`SettingsDialog.tsx`'s "Providers" tab: "Keys are stored locally in your browser and sent with each request — they are never saved on our server") and picks a provider client-side via `PROVIDERS[providerId]`. This is being removed in favor of one Haro-managed routing path through the gateway.

**Resolved architecture (from reading `virtualKeyResolver.ts`/`configResolver/index.ts` directly):** the gateway has two distinct, composable mechanisms, not one:
- `x-haro-virtual-key` header → `resolveVirtualKey()` → a **single** `{provider, apiKey, rateLimitRpm}` (one credential, rate-limited per slug). This is for credential/rate-limit selection, not fallback.
- `x-haro-config-id` header → `resolveConfigPreset()` → an arbitrary JSON `config` blob from `gateway_configs`, set as the `HEADER_KEYS.CONFIG` header that `chatCompletionsHandler.ts`'s underlying Portkey-derived request logic already understands (targets/strategy/hooks — this is what `handlerUtils.ts:568-627`'s `beforeRequestHooks`/`afterRequestHooks` merging operates on). **This is where multi-provider fallback belongs.**

So: `chat.ts` sends `x-haro-config-id` pointing at one Haro-managed config with a `targets`/`strategy: fallback` list across providers (this is the gateway's actual value-add), and does not need `x-haro-virtual-key` at all for this path unless per-tenant rate-limiting is also wanted (optional — can be added later without changing this task's shape). The client only sends `model` (or a Haro-internal model alias), never a provider or key.

- [x] **Step 1:** Read `apps/haro-gateway/src/handlers/adminConfigsHandler.ts` and `apps/haro-gateway/src/config/types.ts`'s `ConfigPresetRecord` to confirm the exact JSON shape `gateway_configs.config` expects (Portkey-style `{strategy: {mode: "fallback"}, targets: [{provider, api_key or virtual_key, ...}, ...]}` is the expected shape for this gateway fork — verify against an existing row if one exists, or against `adminConfigsHandler.ts`'s validation logic if not).
- [x] **Step 2:** Create one `gateway_configs` row (e.g. slug `haro-assistant-default`) encoding the provider fallback chain Haro wants for the assistant (e.g. primary + 1-2 fallbacks) via the admin API/UI. Store server-side provider credentials as gateway virtual keys referenced by that config's targets (not raw keys in the config blob, if the config schema supports virtual-key references — check Step 1's findings).
- [x] **Step 3:** Implement the reroute: `chat.ts` calls `${GATEWAY_URL}/v1/chat/completions` with header `x-haro-config-id: haro-assistant-default`, no `Authorization`/provider key from the client — the gateway resolves credentials server-side.
- [x] **Step 4:** Remove the BYOK code paths: delete `clientApiKey` handling in `chat.ts`, delete the "Providers" tab in `SettingsDialog.tsx`, delete `loadApiKey`/`saveApiKey` from `blocks/chat/config/providers.ts`.
- [x] **Step 5:** Preserve existing behavior for image attachments (`contentBlocks` handling, `chat.ts` current lines ~44-53) and the `tools`/`tool_choice` block for `webSearch` — confirm the gateway passes both through unchanged (already verified in the design spec: `chatCompletionsHandler.ts` is pass-through).
- [x] **Step 6:** Test — existing behavior parity: send a normal chat message and a message with an image attachment, confirm streamed response is identical in shape to pre-change behavior. Add/update tests in `apps/website/src/pages/api/__tests__/` mocking the gateway endpoint instead of the provider endpoint. Add a test confirming no `apiKey`/`clientApiKey` field is read from the request body anymore.
- [x] **Step 7:** Commit (note: the `gateway_configs` row from Step 2 is operational/data setup, not code — document the exact config JSON used in the commit message or a short ops note, since it can't be captured by a code diff alone).

### Task 1.2: Build the portable tool-calling loop module

**Depends on:** Task 1.1 (needs the gateway-routing shape 1.1 established — `x-haro-config-id`, request/response format — as what `runAssistantTurn`'s `gatewayClient` dep wraps).

**Files:**
- Create: `apps/website/src/domain/assistant/` (e.g. `assistant.programs.ts` exporting `runAssistantTurn`) — follow this repo's existing domain-module convention (`*.programs.ts`, `*.types.ts`, `*.errors.ts` per `domain/safety`, `domain/companies`) rather than a bespoke shape
- Modify: `apps/website/src/pages/api/chat.ts` — call `runAssistantTurn` instead of inlining the completion+tool-loop logic

**Interfaces:**
- `runAssistantTurn(input: { messages, tenantSlug, userId, tools }, deps: { gatewayClient, toolExecutors }) → AsyncIterable<TurnEvent>` (exact shape TBD by implementer — the constraint that matters is that it takes its dependencies as parameters, not module-level imports of Astro/Cloudflare-specific globals, so Phase 4 can lift it into a standalone service unchanged)

**Why this task exists on its own:** this is the single highest-leverage structural decision in the whole roadmap (see spec §4) — get the module boundary right now, before Phase 2/3 add more tools/hooks to it, so Phase 4's later extraction is a move, not a rewrite.

- [ ] **Step 1:** Define the loop: call gateway → if response has `tool_calls`, execute each via an injected `toolExecutors` map → feed results back to gateway → repeat until a final (non-tool-call) response, or a max-turns guard trips.
- [ ] **Step 2:** No tool executors yet in this task except `web_search`/`image_generation` (moved from Task 1.3) — Phase 2 adds memory/gbrain/vault executors to the same map without changing the loop itself.
- [ ] **Step 3:** Unit-test the loop with fake gateway/tool-executor deps (no real network calls) — this is what makes the "portable module" claim verifiable, not just aspirational.
- [ ] **Step 4:** Commit.

### Task 1.3: Move `web_search`/`image_generation` execution server-side

**Depends on:** Task 1.2 (adds executors into the tool-executor map 1.2 defines), Task 1.1 (relies on BYOK already being fully removed — see Step 1's note).

**Files:**
- Modify: `apps/website/blocks/chat/hooks/useChat.ts` — delete `executeWebSearch` (~line 142) and `executeImageGeneration` (~line 181), and the client-side `onToolCall` dispatch that calls them (~line 619)
- Modify: `apps/website/src/domain/assistant/` — add these two as the first entries in the loop's tool-executor map (Task 1.2)

**Interfaces:**
- Consumes: same providers previously called from the browser (DuckDuckGo for search, OpenRouter images API for generation) — keep the same providers, only move the call site server-side; swapping providers is out of scope for this task
- Produces: identical tool-result shape the frontend already expects (`role: 'tool'` message content) so `useChat.ts`'s rendering logic doesn't need to change, only the execution site

- [ ] **Step 1:** Port `executeWebSearch`/`executeImageGeneration` logic server-side into the Task 1.2 tool-executor map, using a server-held API key (env var, e.g. `OPENROUTER_IMAGE_API_KEY`) — never sent to the client. This is now unconditional: Task 1.1 already removed all client-side/BYOK key handling, so there is no remaining "client-facing key" case to check for here.
- [ ] **Step 2:** Delete `executeWebSearch`/`executeImageGeneration` and the client-side `onToolCall` dispatch from `useChat.ts` (Task 1.1 already removed the Settings "Providers" tab that used to hold these keys — this step is purely the tool-execution code, not UI).
- [ ] **Step 3:** Test — trigger a web-search and an image-generation tool call in the chat UI, confirm results render correctly with execution now happening server-side (check server logs / network tab to confirm the browser makes no direct call to DuckDuckGo or the image provider).
- [ ] **Step 4:** Commit.

**Phase 1 verification:** open the chat UI in a browser, open DevTools → Network, send a message that triggers `web_search`. Confirm zero requests leave the browser for an LLM provider, DuckDuckGo, or an image API — everything goes to `/api/chat` only.

---

## Phase 2 — Wire Real Memory, Knowledge Graph & Vault Into Chat

**Goal:** assistant actually recalls and writes memory. See spec §2.4, §2.9.

### Task 2.1: TS memory-fabric client for the assistant loop

**Depends on:** Task 0.3 (identity contract), Task 0.4 (`mintServiceToken` — this client is Task 0.4's first real caller, per that task's own Step 5).

**Files:**
- Create: `apps/website/src/domain/assistant/memory-fabric-client.ts` (or extend `apps/website/src/lib/memory-fabric.ts`, which already exists per `docs/superpowers/plans/2026-07-12-memory-fabric-phase2.md` — check it first and extend rather than duplicate)

**Interfaces:**
- Mirrors `apps/mcp/src/services/memory-fabric-service.ts`'s `proxy()` method — `POST {MEMORY_FABRIC_URL}/api/tool {tool, args}`
- **Must** send `Authorization: Bearer <token>` where `<token>` is minted by Task 0.4's `mintServiceToken(tenantSlug)` — **not** a static `MANAGEMENT_API_KEY`. Task 0.0's Hotfix used the shared key as an interim measure; Task 0.4 superseded it with per-tenant tokens specifically for `/api/tool`, and this client is the first real caller of that mechanism.

- [ ] **Step 1:** Check whether `apps/website/src/lib/memory-fabric.ts` already exists (per `docs/superpowers/plans/2026-07-12-memory-fabric-phase2.md`, it should, as `callMemoryTool`). If it exists, extend it to mint and send a per-tenant token (Task 0.4) instead of its current static-key header — reuse and modify, don't duplicate.
- [ ] **Step 2:** The `tenantSlug` passed to `mintServiceToken` must come from the Phase 0 identity contract (Task 0.3's type), resolved server-side from the caller's session/request — never a client-supplied query param.
- [ ] **Step 3:** Test: a call using an expired or wrong-tenant token is rejected by memory-fabric (integration-level assertion against Task 0.4's `require_tenant_auth`, or a mocked-response unit test if a live memory-fabric instance isn't available in the test environment).
- [ ] **Step 4:** Commit.

### Task 2.2: Add memory/gbrain/vault tools to the assistant loop + recall/write logic

**Depends on:** Task 1.2 (tool-executor map to extend), Task 2.1 (memory-fabric client the new tool executors call).

**Files:**
- Modify: `apps/website/src/domain/assistant/` (Phase 1's `runAssistantTurn` and its tool-executor map)

**Interfaces:**
- New tool schemas: `memory_search`/`memory_store` (mem0), `gbrain_get`/`gbrain_put` (knowledge graph) — mirror the parameter shapes already defined in `apps/mcp/src/mcp/tools.ts` (lines ~91-190: `memory_store`, `memory_search`, `gbrain_put`, `gbrain_get` schemas) rather than inventing new ones, so the schema registry (Phase 6) doesn't have two competing definitions from day one

- [ ] **Step 1:** Before the first gateway call each turn, call `memory_search` (via Task 2.1's client) with the current user message as query; inject top-k results into the system/context message.
- [ ] **Step 2:** Register `memory_store`, `gbrain_get`, `gbrain_put` as tools the LLM can call mid-turn (LLM-decided writes) — do not also add a separate heuristic-based auto-write in this task; pick one mechanism (LLM tool-call-decided) to avoid double-writing memory, and only add a heuristic later if the LLM-decided approach proves insufficient in practice.
- [ ] **Step 3:** Test with fake `memory-fabric` responses (extend Task 1.2's fake-deps unit tests) — assert recall injection happens before the first call, and a `memory_store` tool call reaches the client with the right tenant.
- [ ] **Step 4:** Commit.

### Task 2.3: Replace localStorage memory sidebar with real data

**Depends on:** Task 2.2 (the sidebar needs real `memory_store` writes happening to have anything real to display).

**Files:**
- Modify: `apps/website/blocks/chat/hooks/useMemories.ts` — replace `localStorage` (key `tenang:memories`) reads/writes with `fetch('/api/memories?...')`

**Interfaces:**
- Consumes: existing `GET /api/memories` route (already correct, currently only used by `blocks/dashboard/memory-graph.tsx` per the design spec)

- [ ] **Step 1:** Replace the sidebar's data source; keep the existing UI/rendering, only swap where the data comes from.
- [ ] **Step 2:** Migration UX (decided): show a brief, one-time in-UI notice ("Memori tersimpan sebelumnya hanya lokal di browser ini dan tidak otomatis tersinkron — mulai sekarang memori baru tersimpan permanen") the first time the sidebar loads post-migration, then never again (e.g. a `localStorage` flag to suppress repeat display — this one narrow, non-sensitive UI-state flag is fine to keep in `localStorage`; it's not the memory data itself). Do not attempt to migrate old localStorage entries into mem0 — they were never structured for it.
- [ ] **Step 3:** Test — verify sidebar reflects entries created via Task 2.2's `memory_store` calls, not stale localStorage data.
- [ ] **Step 4:** Commit.

### Task 2.4: Conversation-history storage — migrate to Neon

**Depends on:** none technically (schema/migration work is independent of Tasks 2.1-2.3) — can be worked in parallel with the rest of Phase 2. Task 5.4 (voice) depends on this task.

**Decision (confirmed with user 2026-07-13):** migrate conversation history from Cloudflare KV to Neon. This also binds Phase 5 (voice history shares this same store — see Task 5.4).

**Files:**
- Create: `apps/website/scripts/migrations/004-conversations.sql`
- Modify: `apps/website/src/pages/api/conversations.ts`, `apps/website/src/pages/api/conversations/[id].ts` — replace KV reads/writes with Neon queries
- Reference: `apps/website/scripts/migrations/003-tenants.sql` for this repo's migration-file and constraint-naming conventions

**Schema (design, following the `003-tenants.sql` conventions — enum types, `chk_` constraints, `TIMESTAMPTZ` audit columns):**

```sql
CREATE TYPE conversation_channel AS ENUM ('web', 'voice');

CREATE TABLE conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug   TEXT NOT NULL REFERENCES tenants(slug),
  user_id       UUID REFERENCES auth.users(id),
  company_id    UUID REFERENCES companies(id) ON DELETE SET NULL,
  channel       conversation_channel NOT NULL DEFAULT 'web',
  title         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conversations_user_id ON conversations(user_id, updated_at DESC);
CREATE INDEX idx_conversations_tenant_slug ON conversations(tenant_slug);

CREATE TABLE conversation_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user','assistant','tool','system')),
  content          TEXT NOT NULL,
  tool_calls       JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conversation_messages_conversation_id ON conversation_messages(conversation_id, created_at);
```

The `channel` column and `user_id`-keyed index are what let Task 5.4 (voice) write into and read from the *same* table as the website, satisfying the "shared conversation stream" design (see Task 5.4).

- [ ] **Step 1:** Write the migration file (`004-conversations.sql`) using the schema above as the starting point — adjust only if investigation of `003-tenants.sql`/`companies`/`auth.users` reveals a type mismatch (e.g. if `tenants.slug` isn't actually usable as a FK target — confirm its exact column definition first).
- [ ] **Step 2:** Port `pages/api/conversations.ts` (list/create) and `conversations/[id].ts` (get/append) from KV operations to Neon queries preserving the existing route contracts (same request/response JSON shapes) so `useChat.ts` and other callers don't need to change.
- [ ] **Step 3:** Write a one-time backfill note (not necessarily code — KV conversation data is ephemeral chat history, likely acceptable to not migrate old conversations; confirm this assumption with the user if any long-term KV data is known to exist worth preserving, otherwise proceed with a clean cutover).
- [ ] **Step 4:** Test — create a conversation, append messages, fetch it back, confirm parity with the old KV-backed route's behavior via the existing route tests (`apps/website/src/pages/api/__tests__/`, adapt from KV mocks to Neon mocks).
- [ ] **Step 5:** Commit.

**Phase 2 verification:** ask the assistant something that references an earlier turn in the same or a prior conversation; confirm correct recall. Check `GET /api/memories` directly (not just the UI) to confirm a new entry was actually written to mem0, not just rendered from a stale cache.

---

## Phase 3 — Safety Guardrails on the Live Chat Path

**Goal:** crisis-flagging logic runs automatically on every real conversation, not just via manual admin tooling. See spec §2.7, §2.8.

### Task 3.1: Gateway-level risk-detection plugin

**Depends on:** none — pure `haro-gateway` plugin work, independent of website/Phase 0-2 changes. Can be worked any time, in parallel with Phase 1/2. **Status: already complete** (commits `d424d13..a889606`) — kept here for context only, do not re-dispatch.

**Files:**
- Create: `apps/haro-gateway/plugins/haro-safety/` (new plugin directory, sibling to `plugins/default`) — `manifest.json` + a handler file, following the exact shape of `plugins/default/regexMatch.ts` (a `PluginHandler` returning `{error, verdict, data}`) and `plugins/default/manifest.json`'s function-declaration format
- Reference: `apps/haro-gateway/src/middlewares/hooks/index.ts` (`HookSpan`), `apps/haro-gateway/src/handlers/handlerUtils.ts:568-627` (confirms hooks can be attached at the config/virtual-key level and get merged into every request through `currentInheritedConfig` — so this does NOT require the caller to specify hooks per-request)

**Interfaces:**
- A `beforeRequestHook`/`afterRequestHook` guardrail function, attached to the virtual key or config preset the assistant loop uses, so it runs on every request through that key without website/voice needing to opt in per-call

- [x] **Step 1:** Decide the detection mechanism for v1: start with a keyword/regex list (reuse `plugins/default/regexMatch.ts` directly with a configured pattern, rather than writing a new plugin, if a single regex is sufficient for launch) vs. a dedicated small plugin that can grow more nuanced logic later. Prefer reusing `regexMatch` via config first — only build a bespoke plugin if regex genuinely can't express the check.
- [x] **Step 2:** If reusing `regexMatch`: attach it via the config preset (`configPresetResolver.ts`) used by the assistant's virtual key, with `onFailure` producing a `GuardrailCheckResult` the caller can read. If building bespoke: scaffold `manifest.json` + handler following `plugins/default`'s exact structure, register it in the plugin loader (check `apps/haro-gateway/plugins/index.ts` or equivalent for how `plugins/default` gets registered, and mirror that for the new plugin id).
- [x] **Step 3:** Test using the existing pattern in `plugins/default/default.test.ts` as a reference for how gateway plugin tests are structured in this repo.
- [x] **Step 4:** Commit.

### Task 3.2: Wire detected risk to the safety domain

**Depends on:** Task 1.2 (assistant loop to wire the check into), Task 3.1 (the hook whose verdict this task reads must exist first).

**Files:**
- Modify: `apps/website/src/domain/assistant/` (Phase 1's loop) — read the gateway's hook result from the response, call `flagRiskProgram` when triggered
- Reference: `apps/website/src/domain/safety/safety.programs.ts` (`flagRiskProgram`, `getEscalationCasesProgram` — reuse as-is, do not reimplement)

**Decision (confirmed with user 2026-07-13):** on a positive risk verdict, the conversation continues to receive the LLM's normal response, with an additional auto-appended safety-resource message (e.g. a crisis-line/hotline pointer relevant to the product's Indonesian mental-wellness context); the escalation case is created silently in the background — no separate "you have been flagged" UI, no blocking/withholding of the normal response.

- [ ] **Step 1:** After the gateway call returns, check for the Task 3.1 hook's verdict in the response/hook-result metadata.
- [ ] **Step 2:** On a positive verdict, call `flagRiskProgram` with the Phase 0 identity (`userId`, `companyId`) so it lands in the same case list `getEscalationCasesProgram`/the super-admin UI already reads. This call must not block or delay the user-facing response — fire it without making the user wait on its result (but do not silently swallow its failure either; log/alert if it fails, since a silently-dropped escalation defeats the safety purpose).
- [ ] **Step 3:** Append a fixed, pre-written safety-resource message (content to be provided/approved by the user — do not invent crisis-line copy or phone numbers) to the assistant's response before it's returned to the client, alongside (not replacing) the LLM's normal reply.
- [ ] **Step 4:** Define the exact resource message content as a named constant (e.g. `SAFETY_RESOURCE_MESSAGE_ID`) sourced from a config/i18n file, not inlined as a magic string in the loop — this content will need review/updates independent of code changes.
- [ ] **Step 5:** Test — feed a known risk-pattern message through the loop with fake deps, assert (a) `flagRiskProgram` is called with the right identity, (b) the resource message is appended to the response, (c) the underlying LLM response itself is still present and unmodified.
- [ ] **Step 6:** Commit.

**Phase 3 verification:** send a message matching the configured risk pattern through the live chat; confirm a case appears at `GET /api/super-admin/risk/cases` with the correct user/company attribution.

---

## Phase 4 — Orchestrator Extraction Decision Point

**Goal:** decide whether/when to extract the Phase 1-3 module into a standalone service. See spec §4 for the full option analysis (A/B/C) and decision.

**Decision already made in the spec:** keep the loop embedded in `apps/website` through Phases 1-3; extract into `apps/assistant-orchestrator` (Hono/TS, own Cloudflare Worker) at the start of Phase 5, when `haro-voice` becomes the second caller. Revisit only if a third caller or a hard scaling/latency wall appears before then.

### Task 4.1: Confirm and execute the extraction (gate, not a normal task)

**Depends on:** all of Phase 1-3 (Tasks 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2) — this task moves the fully-assembled `apps/website/src/domain/assistant/` module, so everything that was added to it must exist first. Also depends on Task 0.4 (the auth mechanism it reuses).

**Auth note:** the service-to-service auth question (spec §6.5) is already resolved and built in Task 0.4 (per-tenant JWTs minted via `mintServiceToken`). This task does not design new auth — the orchestrator becomes a second minter/holder of `SERVICE_JWT_SECRET`, reusing Task 0.4's mechanism unchanged. If website's assistant module (Task 1.2) already used `mintServiceToken` internally, the only change here is *where* that minting call happens (inside the orchestrator process instead of inside an Astro API route), not *how*.

- [ ] **Step 1:** When Phase 5 is about to start, re-confirm with the user that keeping the orchestrator embedded-until-now decision still holds (circumstances may have changed since 2026-07-13).
- [ ] **Step 2:** Scaffold `apps/assistant-orchestrator` (new Hono app, follow `apps/mcp`'s `wrangler`/Cloudflare Worker setup as the closest existing template in this repo) and move `apps/website/src/domain/assistant/` into it essentially unchanged (this is the payoff of Task 1.2's portability constraint).
- [ ] **Step 3:** Wrap the moved module with a thin HTTP API (e.g. `POST /turn`), authenticated by a caller credential distinct from the tenant-scoped `SERVICE_JWT_SECRET` tokens it mints downstream (e.g. website/voice authenticate to the orchestrator using their own existing session/device credentials from Phase 0/Task 5.1 — the orchestrator then mints fresh per-tenant tokens itself for its own calls to memory-fabric/gateway; don't conflate "caller→orchestrator" auth with "orchestrator→memory-fabric" auth, they are different trust boundaries).
- [ ] **Step 4:** Move `SERVICE_JWT_SECRET` access (env var) to the orchestrator's deployment config; the website no longer needs it directly once `chat.ts` stops minting tokens itself.
- [ ] **Step 5:** Update `apps/website/src/pages/api/chat.ts` to call the new service instead of importing the module directly.
- [ ] **Step 6:** Commit.

---

## Phase 5 — Bring `haro-voice` (Ara) Onto the Shared Brain

**Goal:** replace Ara's silo with calls into the Phase 4 orchestrator. See spec §2.6.

**Decision (confirmed with user 2026-07-13):** Ara keeps a **local LLM fallback** for resilience when the orchestrator is unreachable (Task 5.3) — this phase is not descoped to identity/persistence only; the migration proceeds in full, with the local path kept deliberately as a fallback, not the primary path.

### Task 5.1: Voice → tenant identity resolution via pairing code

**Depends on:** Task 0.2/0.3 (identity contract, and an authenticated website session to generate a pairing code from) — does NOT depend on Task 4.1 (the pairing mechanism itself doesn't call the orchestrator), so it can be worked in parallel with Task 4.1 if useful.

**Decision (confirmed with user 2026-07-13):** pairing-code flow — user sees a short code on the website dashboard, enters/speaks it to the Ara device once during setup, device exchanges it for a long-lived device token.

**Files:**
- Create: `apps/website/src/pages/api/voice/pairing.ts` (or under `domain/voice-pairing/` following the repo's domain-module convention) — `POST /api/voice/pairing/start` (authenticated website session → generates a short code, e.g. 6-digit, TTL ~10 min, tied to the logged-in user's `tenantSlug`/`userId`), `POST /api/voice/pairing/claim` (device → code → issues a long-lived device token)
- Modify: `apps/haro-voice/backend/main.py` — add a pairing/setup flow (HTTP endpoint or CLI prompt during first boot) that calls `claim` and persists the returned device token
- Modify: `apps/haro-voice/config/` (check existing config file shape first) — store the device token + resolved `tenantSlug`/`userId` here, read at startup

**Interfaces:**
- Pairing code: short-lived, single-use, generated server-side (Neon-backed or KV, TTL-based — reuse whatever short-lived-code pattern already exists in this repo, e.g. check `domain/invitations` for a similar token-with-TTL pattern before inventing a new one)
- Device token: long-lived (no fixed expiry, or long expiry with a documented rotation/revocation path — e.g. a `voice_devices` table with `id, tenant_slug, user_id, token_hash, created_at, revoked_at`, so a lost/compromised device can be revoked from the dashboard)

- [ ] **Step 1:** Check `domain/invitations` for an existing short-lived-token pattern (`hashToken`, TTL handling) to reuse for the pairing code, rather than inventing a new one.
- [ ] **Step 2:** Implement `pairing/start` (website, authenticated) and `pairing/claim` (device-facing, unauthenticated except by the code itself) endpoints.
- [ ] **Step 3:** Add a `voice_devices` table (migration, following `003-tenants.sql` conventions) to persist device→tenant mapping and support revocation.
- [ ] **Step 4:** Implement the Ara-side pairing flow in `main.py` (or a small `pairing.py`) — on first boot with no stored token, prompt for/fetch a code and call `claim`; on subsequent boots, load the stored token directly.
- [ ] **Step 5:** Add a simple revoke path (dashboard button or admin endpoint) — even a minimal one, since a device token is a standing credential.
- [ ] **Step 6:** Test — pairing flow end-to-end with a mocked device HTTP client; expired/reused code is rejected; revoked device token is rejected on the next orchestrator call.
- [ ] **Step 7:** Commit.

### Task 5.2: Replace `agent_router.py`'s regex routing with an orchestrator call

**Depends on:** Task 4.1 (orchestrator's `/turn` endpoint must exist), Task 5.1 (identity to pass in the call).

**Files:**
- Modify: `apps/haro-voice/backend/pipeline.py` — replace `router.route(user_text, conversation_history)` (currently calling `AgentRouter`) with a call to the Phase 4 orchestrator's `/turn` endpoint, passing the STT transcript, `conversation_history`, and Task 5.1's identity
- Decide fate of: `apps/haro-voice/backend/agent_router.py`, `apps/haro-voice/backend/agents/general_agent.py` — likely deleted once the orchestrator handles general conversation; `smart_home_agent.py`/`calendar_agent.py` fate depends on Task 5.5

- [ ] **Step 1:** Add an HTTP client call from `pipeline.py` to the orchestrator (Python `httpx`, matching the style already used in `llm.py`).
- [ ] **Step 2:** Remove `agent_router.py`'s regex dispatch from the main pipeline path; keep the file only if Task 5.5 decides device-control intents still need local pre-routing before the orchestrator call (e.g. to avoid a network round-trip for "turn off the lights").
- [ ] **Step 3:** Test — with a mocked orchestrator endpoint, confirm `pipeline.py` sends the right payload and handles the response the same way it previously handled `router.route()`'s return shape.
- [ ] **Step 4:** Commit.

### Task 5.3: Keep `llm.py` as a local fallback path, orchestrator as primary

**Depends on:** Task 5.2 (wraps the orchestrator call site 5.2 creates with a fallback branch).

**Decision (confirmed with user 2026-07-13):** keep a local LLM fallback for resilience — `llm.py` is narrowed to a fallback path, not deleted, and not the primary path.

**Files:**
- Modify: `apps/haro-voice/backend/pipeline.py` — try the orchestrator call (Task 5.2) first; on network error/timeout (not on a normal error response — only on unreachability), fall back to calling `llm.chat_stream` directly
- Modify: `apps/haro-voice/backend/llm.py` — keep as-is functionally (hardcoded `OPENROUTER_URL`/`FREE_MODELS` is acceptable for a fallback path; this is not the file to route through the gateway, since its entire purpose is to work when the rest of the stack is unreachable), but note clearly in a comment that this is now the fallback path, not primary

**Interfaces:**
- `pipeline.py`'s call site: `try: result = await call_orchestrator(...) except (httpx.ConnectError, httpx.TimeoutException): result = await local_fallback(...)` — narrow the exception scope to actual connectivity failures, not all exceptions, so a real orchestrator-side error (e.g. a 500 from a bug) doesn't get silently masked by falling back instead of surfacing

- [ ] **Step 1:** Grep all callers of `llm.chat_stream` in `apps/haro-voice/backend/agents/*.py` (currently `general_agent.py`, `calendar_agent.py`, `smart_home_agent.py`) — these become dead code once Task 5.2's orchestrator call is primary; only the new fallback call site in `pipeline.py` should call `llm.chat_stream` going forward.
- [ ] **Step 2:** Remove the now-dead direct calls from the individual agent files (their logic is superseded by the orchestrator call, except whatever Task 5.5 decides stays local for device control).
- [ ] **Step 3:** Implement the fallback branch in `pipeline.py` per the Interfaces note above; when the fallback path is used, notify the user in-conversation that they're in a degraded/offline mode (e.g. a short spoken note) so the UX difference isn't silent — memory/tool access are unavailable in this mode by definition.
- [ ] **Step 4:** Preserve the Indonesian "Ara" persona/system-prompt behavior in both paths — move it into the orchestrator's system prompt for the primary path (per Task 5.2), keep `llm.py`'s existing `SYSTEM_PROMPT` for the fallback path (they can differ slightly, but both should sound like "Ara").
- [ ] **Step 5:** Test — simulate orchestrator unreachability (mocked `ConnectError`), confirm fallback engages and responds; simulate a normal orchestrator error response (e.g. 500), confirm it does NOT silently fall back (surfaces as an error instead, per the narrowed exception handling).
- [ ] **Step 6:** Commit.

### Task 5.4: Persist conversation history in the shared Neon store

**Depends on:** Task 2.4 (the Neon `conversations`/`conversation_messages` tables must exist), Task 4.1 (routes through the orchestrator per Step 1), Task 5.1 (identity to key conversations by).

**Decision (confirmed with user 2026-07-13):** Ara's conversation history uses the **same** `conversations`/`conversation_messages` tables Task 2.4 created for the website, with `channel = 'voice'` and the same `user_id` — giving cross-channel continuity, which directly serves the roadmap's "unified assistant" goal.

**Files:**
- Modify: `apps/haro-voice/backend/pipeline.py` — replace the module-level `conversation_history: list[dict]` (currently capped at `MAX_HISTORY * 2 = 20` entries, reset on restart) with reads/writes to the Task 2.4 Neon tables
- New: a small Neon client for `haro-voice` (Python) — check whether `psycopg2-binary` (already a `memory-fabric` dependency) is worth adding to `haro-voice`'s `requirements.txt` directly, or whether voice should instead call a website/orchestrator API endpoint that wraps the Neon access (preferred: keep DB credentials out of the voice device/backend entirely, call through the orchestrator's `/turn` response or a small `/history` endpoint instead of connecting to Neon directly from a device-adjacent process)

- [ ] **Step 1:** Prefer routing history reads/writes through the orchestrator (which already talks to Neon-backed conversation storage on the website's behalf via Task 2.4) rather than giving `haro-voice` direct DB credentials — this keeps the device-adjacent backend's credential footprint minimal, consistent with Task 5.1's device-token (not DB-credential) design.
- [ ] **Step 2:** On each turn, after STT and after the assistant response, call the orchestrator to append both messages to the conversation (`conversation_id` resolved by `user_id` + `channel='voice'`, creating a new conversation row if none is open, following whatever "conversation continuation" window logic Task 2.4's website route already uses for parity).
- [ ] **Step 3:** On pipeline startup, load recent history for the paired user via the same path (replacing the in-process list's role) instead of starting empty.
- [ ] **Step 4:** Test — restart the pipeline process mid-conversation (simulated), confirm history is reloaded from the shared store rather than starting empty; confirm a conversation started on the website and continued via voice shows continuity (same `conversation_id` or at least same `user_id` thread, per Step 2's resolution logic).
- [ ] **Step 5:** Commit.

### Task 5.5: Device-control tool boundary — smart home stays local, calendar becomes an orchestrator tool

**Depends on:** Task 5.2 (`pipeline.py`'s orchestrator integration, which this task's local pre-check hooks into), Task 1.2/2.2 (the tool-registration pattern this task's new `calendar_*` tools follow).

**Decision (technical, resolved by this plan — no product ambiguity):** `smart_home_agent.py` stays voice-local: the orchestrator (a cloud/remote service per Phase 4) has no path to a user's LAN or local device protocols, so this logic cannot move regardless of preference. `calendar_agent.py` has no such constraint and becomes an orchestrator tool — this also means calendar actions become available to the website channel for free once it's a shared tool, not just voice.

**Files:**
- Keep as-is (voice-local): `apps/haro-voice/backend/agents/smart_home_agent.py`
- Migrate: `apps/haro-voice/backend/agents/calendar_agent.py` logic → a new `calendar_*` tool in the orchestrator's tool-executor map (Task 1.2's map, extended)

- [ ] **Step 1:** Keep `smart_home_agent.py`'s logic as a local pre-check in `pipeline.py`: if Task 5.2's intent detection (or a lightweight local keyword check re-added just for this narrow case, distinct from the general-purpose regex router being removed) identifies a device-control request, handle it locally without a round-trip to the orchestrator.
- [ ] **Step 2:** Port `calendar_agent.py`'s logic into orchestrator tool schemas (e.g. `calendar_create_event`, `calendar_list_events` — exact operations per what `calendar_agent.py` currently supports), registered the same way memory/gbrain tools were added in Phase 2.
- [ ] **Step 3:** Delete `calendar_agent.py` once its logic is fully represented as orchestrator tools and `pipeline.py` no longer calls it directly.
- [ ] **Step 4:** Test — a calendar request via voice reaches the new orchestrator tool (mocked); a smart-home request is handled locally without an orchestrator round-trip (assert no HTTP call made for that intent).
- [ ] **Step 5:** Commit.

**Phase 5 verification:** restart the Ara backend process mid-conversation; confirm conversation history survives (read from persistent storage per Task 5.4, not the in-process list). Confirm a voice query answered via the orchestrator reflects the same memory recall a website chat session would (per Phase 2), proving the "shared brain" claim end-to-end.

---

## Phase 6 — MCP-Facing Unification (stretch)

**Goal:** let external MCP clients invoke the whole assistant, not just raw tools, without breaking existing direct tool access. See spec §2.10.

### Task 6.1: Add `ask_haro_assistant` MCP tool

**Depends on:** Task 4.1 (the orchestrator this tool proxies to must exist).

**Files:**
- Modify: `apps/mcp/src/mcp/tools.ts` — add a new tool definition and a case in `executeTool`'s switch (currently handles `okf_*`/`memory_*`/`gbrain_*`/`vault_*`/`fabric_health` at lines ~308-335)
- Modify: `apps/mcp/src/index.ts` — wire a client to the Phase 4 orchestrator (mirror how `MemoryFabricService` is already constructed and passed into `buildServices`)

- [ ] **Step 1:** Add `ask_haro_assistant(query, tenant)` to the tool-definition list and `executeTool`'s switch, proxying to the orchestrator's `/turn` endpoint.
- [ ] **Step 2:** Test following the existing pattern for other tool cases in this file (check for existing tool-execution tests in `apps/mcp`).
- [ ] **Step 3:** Commit.

### Task 6.2: Shared tool-schema registry

**Depends on:** Task 2.2 (memory/gbrain tool schemas must exist to extract), Task 1.3 (`web_search`/`image_generation` schemas). Not dependent on Task 6.1 — can be done in either order relative to it, or in parallel.

**Files:**
- Create: a shared package or module (e.g. `packages/tool-schemas`) defining `memory_*`/`gbrain_*`/`vault_*`/`okf_*`/`web_search`/`image_generation` schemas once
- Modify: `apps/mcp/src/mcp/tools.ts`, `apps/website/src/domain/assistant/` (Phase 1-2's tool executors), `apps/assistant-orchestrator` (if extracted by Phase 4) to import from the shared registry instead of each defining schemas independently (today `api/chat.ts` defines `web_search`/`image_generation` inline, ad hoc, per the design spec's findings)

- [ ] **Step 1:** Extract the tool JSON-schemas already defined in `apps/mcp/src/mcp/tools.ts` (the most complete existing set) into the shared package.
- [ ] **Step 2:** Point `apps/mcp` and the website/orchestrator's tool executors at the shared definitions.
- [ ] **Step 3:** Commit.

**Phase 6 verification:** call `ask_haro_assistant` from an MCP client (Claude Desktop/Cursor), confirm it returns a full assistant response (with memory recall and safety checks applied), not just a raw tool result.

---

## Phase 7 — Hardening & Observability

### Task 7.1: Reconcile quota/billing

**Depends on:** none technically (investigation-and-design task against existing systems) — can be worked any time after Phase 2 lands (memory-fabric usage data needs to exist to reason about in Step 1).

**Files:**
- Reference: `apps/website/src/domain/billing/billing.programs.ts` (`checkAndIncrementQuotaProgram`, `getBillingInfoProgram`), `apps/memory-fabric/src/memory_fabric/tenant_manager.py` (`quota_max_memories`/`usage_memories`, etc.)

- [ ] **Step 1:** Map website billing's quota concepts against memory-fabric's `quota_max_*`/`usage_*` columns — identify where they overlap vs. measure different things (API call volume vs. stored-resource counts, likely) before assuming they need to be unified into one system.
- [ ] **Step 2:** Decide reconciliation approach based on Step 1's findings (single source of truth vs. two systems with a documented relationship) — present to user, this is a business-logic decision.
- [ ] **Step 3:** Implement and commit.

### Task 7.2: End-to-end tracing

**Depends on:** Task 4.1 (orchestrator must exist as one of the three hops being traced).

**Files:**
- Modify: orchestrator, `haro-gateway`, `memory-fabric` — add a shared trace/request-id propagated across all three (check whether `haro-gateway`'s existing `apps/haro-gateway/src/apm/index.ts` already has a request-id concept to extend, before inventing a new one)

- [ ] **Step 1:** Check `apps/haro-gateway/src/apm/index.ts` for an existing trace-id mechanism to extend rather than duplicate.
- [ ] **Step 2:** Propagate a single trace id from the orchestrator through the gateway call and the memory-fabric `/api/tool` call (as a header), and log it at each hop.
- [ ] **Step 3:** Commit.

### Task 7.3: Security review pass

**Depends on:** Task 0.4, Task 4.1 (the new trust boundaries this reviews must be live).

- [ ] **Step 1:** Once Phase 0/4's new trust boundaries (identity contract, service-to-service auth) are live, run this repo's `security-review` skill against the accumulated diff.
- [ ] **Step 2:** Triage and fix findings per that skill's own process.

### Task 7.4: Load-test the orchestrator hop

**Depends on:** Task 4.1 (the hop being measured must exist).

- [ ] **Step 1:** Measure streaming-chat latency before/after Phase 4's extraction (website → orchestrator → gateway vs. the prior in-process call) using a representative test conversation.
- [ ] **Step 2:** If the added hop introduces user-visible latency regression, investigate (colocating orchestrator/gateway, connection reuse, etc.) before considering Phase 4 complete.

---

## Verification Summary

| Phase | Verification |
|---|---|
| Hotfix | `curl` `/api/tool` without `Authorization` → 401 |
| Phase 0 | Two different tenants' users can't see each other's memories/gbrain/vault via the dashboard |
| Phase 1 | No direct browser → LLM-provider/DuckDuckGo requests; all chat traffic flows through gateway |
| Phase 2 | Assistant recalls prior-turn facts; new entries appear via real `/api/memories` |
| Phase 3 | High-risk message → case appears in `/api/super-admin/risk/cases` |
| Phase 4 | `chat.ts` calls the orchestrator service, not an in-process module |
| Phase 5 | Ara process restart mid-conversation → history persists; voice query reflects website-session memory recall |
| Phase 6 | `ask_haro_assistant` MCP tool returns a full assistant response, not a raw tool result |
| Phase 7 | Single trace id visible across orchestrator/gateway/memory-fabric logs for one conversation turn |
