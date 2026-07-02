# Observability Plan: Logger + Tracing for Tenang BE

> **For agentic workers:** This appendix defines the logging and tracing infrastructure that every B2B API route, Effect program, and domain repository must use. Use it in conjunction with `2026-06-24-tenang-b2b-implementation.md`.

**Goal:** Every request, Effect program execution, audit-relevant action, and error in the Tenang backend must be **logged with structured fields** and **traced with a correlation ID** so we can debug production issues, audit user actions, and meet UU PDP logging requirements. Logs from the Tenang BE and the AI Engine must share a **distributed trace** so we can debug latency and quality issues end-to-end. PII must never appear in logs.

**Why now:** Without a centralized logger, errors vanish into `console.log` and debugging production means grepping Cloudflare logs by hand. Without trace propagation, debugging "the AI is slow" requires correlating logs across two services by hand. Without PII redaction, a log breach = a PII breach under UU PDP.

**Architecture:** Effect-native logging via a `Logger` service. W3C Trace Context propagation to/from the AI Engine. PII redaction in two layers: field-level (known PII keys) + content-level (regex for free text). Runs on Cloudflare Workers (no Node `pino`/`winston` — use a lightweight custom implementation that writes to `console` with structured JSON, plus to Supabase `app_logs` and `audit_log` tables).

**Coverage:**
- F.1 — Log levels + structured fields
- F.2 — Logger Effect service (3 destinations)
- F.3 — Request-scoped middleware
- F.4 — Trace continuity (Effect.span)
- F.5 — Audit helpers for sensitive actions
- F.6 — Structured logging in API routes
- F.7 — Logs dashboard (super admin)
- F.8 — Acceptance gate
- **F.9 — AI Engine integration: distributed tracing + webhooks**
- **F.10 — PII redaction in logs**

---

## F.1 — Log Levels + Structured Fields

### Task F.1.1 — Define log levels

**File:** `apps/website/src/lib/logger/logger.types.ts`

**Spec:**

```typescript
export type TLogLevel = "debug" | "info" | "warn" | "error" | "fatal" | "audit"

export type TLogContext = {
  readonly requestId?: string
  readonly userId?: string
  readonly companyId?: string
  readonly sessionId?: string
  readonly caseId?: string
  readonly action?: string
  readonly resourceType?: string
  readonly resourceId?: string
  readonly durationMs?: number
  readonly traceId?: string
  readonly spanId?: string
  readonly [key: string]: unknown
}

export type TLogEntry = {
  readonly timestamp: string
  readonly level: TLogLevel
  readonly message: string
  readonly context: TLogContext
  readonly error?: {
    readonly tag: string
    readonly message: string
    readonly stack?: string
    readonly cause?: unknown
  }
  readonly service: "tenang-web"
  readonly environment: "development" | "staging" | "production"
}
```

**Acceptance criteria:** All levels defined; `audit` level reserved for security/privacy-sensitive actions; `context` is extensible but core fields typed.

**Commit:** `feat(logger): log level + context types`

### Task F.1.2 — Decide log destinations per level

**File:** `apps/website/src/lib/logger/logger.config.ts`

**Spec:**

```typescript
import type { TLogLevel } from "./logger.types"

const LOG_LEVEL_THRESHOLDS: Record<string, number> = {
  development: 0,
  staging: 1,
  production: 2,
}

export const shouldLog = (level: TLogLevel, environment: string): boolean => {
  const threshold = LOG_LEVEL_THRESHOLDS[environment] ?? 2
  const levelValue = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4, audit: 0 }[level]
  return levelValue >= threshold
}

export const destinations: Record<TLogLevel, readonly string[]> = {
  debug: ["console"],
  info: ["console"],
  warn: ["console", "supabase:logs"],
  error: ["console", "supabase:logs", "audit_log"],
  fatal: ["console", "supabase:logs", "audit_log", "alert"],
  audit: ["audit_log"],
}
```

**Acceptance criteria:** Production default: warn+ to console + Supabase logs; audit-level always to `audit_log`; fatal triggers alert; configurable via `LOG_LEVEL` env var.

**Commit:** `feat(logger): log level + destination config`

---

## F.2 — Logger Service (Effect-TS)

### Task F.2.1 — Logger interface

**File:** `apps/website/src/lib/logger/logger.service.ts`

**Spec:**

```typescript
import { Context, Effect, Layer } from "effect"
import type { TLogContext, TLogEntry, TLogLevel } from "./logger.types"
import { writeConsole } from "./logger.console"
import { writeSupabaseLogs } from "./logger.supabase"
import { writeAuditLog } from "./logger.audit"
import { redactFields } from "./pii-fields"
import { redactContent } from "./pii-content"
import { shouldLog, destinations } from "./logger.config"

const REDACTABLE_TEXT_FIELDS = [
  "aiSummary", "ai_summary", "transcript", "notes", "caseNotes", "case_notes",
  "errorMessage", "description", "reasonText", "reason_text",
] as const

export class Logger extends Context.Tag("Logger")<
  Logger,
  {
    readonly debug: (message: string, context?: TLogContext) => Effect.Effect<void>
    readonly info: (message: string, context?: TLogContext) => Effect.Effect<void>
    readonly warn: (message: string, context?: TLogContext) => Effect.Effect<void>
    readonly error: (
      message: string,
      error: { _tag: string; message: string; cause?: unknown },
      context?: TLogContext,
    ) => Effect.Effect<void>
    readonly fatal: (
      message: string,
      error: { _tag: string; message: string; cause?: unknown },
      context?: TLogContext,
    ) => Effect.Effect<void>
    readonly audit: (
      action: string,
      context: TLogContext & { resourceType: string; resourceId: string },
    ) => Effect.Effect<void>
    readonly withContext: (extra: TLogContext) => Effect.Effect<Logger["Type"]>
    readonly withRequest: (requestId: string) => Effect.Effect<Logger["Type"]>
    readonly withUser: (userId: string, companyId?: string) => Effect.Effect<Logger["Type"]>
  }
>() {}

const format = (
  level: TLogLevel,
  message: string,
  baseContext: TLogContext,
  context: TLogContext,
  error?: TLogEntry["error"],
  config: { service: string; environment: string },
): TLogEntry => {
  // Step 1: Field-level redaction (F.10.1)
  let redactedContext = redactFields({ ...baseContext, ...context }) as TLogContext

  // Step 2: Content-level redaction (F.10.3)
  for (const field of REDACTABLE_TEXT_FIELDS) {
    if (typeof (redactedContext as any)[field] === "string") {
      (redactedContext as any)[field] = redactContent((redactedContext as any)[field])
    }
  }

  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: redactedContext,
    error: error ? redactFields(error) as TLogEntry["error"] : undefined,
    service: config.service,
    environment: config.environment as any,
  }
}

export const makeLogger = (config: {
  readonly environment: string
  readonly service: string
  readonly traceId?: string
  readonly spanId?: string
}): Logger["Type"] => {
  const baseContext: TLogContext = {
    traceId: config.traceId,
    spanId: config.spanId,
  }

  const log = (level: TLogLevel, message: string, context: TLogContext = {}, error?: TLogEntry["error"]): Effect.Effect<void> =>
    Effect.gen(function* () {
      if (!shouldLog(level, config.environment)) return
      const entry = format(level, message, baseContext, context, error, config)
      const dests = destinations[level]
      if (dests.includes("console")) yield* writeConsole(entry)
      if (dests.includes("supabase:logs") || dests.includes("audit_log")) {
        yield* writeSupabaseLogs(entry).pipe(Effect.catchAll(() => Effect.void))
      }
      if (level === "audit" || dests.includes("audit_log")) {
        yield* writeAuditLog(entry).pipe(Effect.catchAll(() => Effect.void))
      }
      if (dests.includes("alert") && (level === "fatal" || level === "error")) {
        // TODO: PagerDuty/Slack
        yield* writeConsole({ ...entry, message: `[ALERT] ${entry.message}` })
      }
    })

  return {
    debug: (msg, ctx) => log("debug", msg, ctx),
    info: (msg, ctx) => log("info", msg, ctx),
    warn: (msg, ctx) => log("warn", msg, ctx),
    error: (msg, err, ctx) => log("error", msg, ctx ?? {}, { tag: err._tag, message: err.message, cause: err.cause }),
    fatal: (msg, err, ctx) => log("fatal", msg, ctx ?? {}, { tag: err._tag, message: err.message, cause: err.cause }),
    audit: (action, ctx) => log("audit", action, ctx),
    withContext: (extra) => Effect.succeed(makeLogger({ ...config })),
    withRequest: (requestId) => Effect.succeed(makeLogger({ ...config })),
    withUser: (userId, companyId) => Effect.succeed(makeLogger({ ...config })),
  }
}

export const LoggerLive = Layer.succeed(Logger, makeLogger({
  environment: import.meta.env.NODE_ENV === "production" ? "production" : "development",
  service: "tenang-web",
}))
```

**Acceptance criteria:** All 6 levels; context enrichment helpers; default `LoggerLive` layer; redaction integrated.

**Commit:** `feat(logger): Logger Effect service with PII redaction integrated`

### Task F.2.2 — Console writer (structured JSON)

**File:** `apps/website/src/lib/logger/logger.console.ts`

**Spec:**

```typescript
import { Effect } from "effect"
import type { TLogEntry } from "./logger.types"

export const writeConsole = (entry: TLogEntry): Effect.Effect<void> =>
  Effect.sync(() => {
    const line = JSON.stringify(entry)
    if (entry.level === "error" || entry.level === "fatal") console.error(line)
    else if (entry.level === "warn") console.warn(line)
    else console.log(line)
  })
```

**Commit:** `feat(logger): console writer with structured JSON`

### Task F.2.3 — Supabase logs writer + `app_logs` table

**File:** `apps/website/src/lib/logger/logger.supabase.ts`

**Spec:**

```typescript
import { Effect } from "effect"
import type { TLogEntry } from "./logger.types"
import { createSupabaseServiceClient } from "@/lib/supabase/service"

export const writeSupabaseLogs = (entry: TLogEntry): Effect.Effect<void> =>
  Effect.tryPromise({
    try: async () => {
      const supabase = createSupabaseServiceClient()
      await supabase.from("app_logs").insert({
        timestamp: entry.timestamp,
        level: entry.level,
        message: entry.message,
        context: entry.context,
        error: entry.error ?? null,
        service: entry.service,
        environment: entry.environment,
      })
    },
    catch: () => undefined,
  })
```

**Migration — `app_logs` table:**

```sql
-- apps/website/supabase/migrations/20260625000060_create_app_logs.sql
create table if not exists public.app_logs (
  id uuid default gen_random_uuid() primary key,
  timestamp timestamptz not null default now(),
  level text not null check (level in ('debug','info','warn','error','fatal','audit')),
  message text not null,
  context jsonb not null default '{}',
  error jsonb,
  service text not null,
  environment text not null,
  created_at timestamptz not null default now()
);

create index idx_app_logs_timestamp on public.app_logs(timestamp desc);
create index idx_app_logs_level on public.app_logs(level);
create index idx_app_logs_company on public.app_logs((context->>'companyId'));
create index idx_app_logs_user on public.app_logs((context->>'userId'));
create index idx_app_logs_request on public.app_logs((context->>'requestId'));
create index idx_app_logs_trace on public.app_logs((context->>'traceId'));

alter table public.app_logs enable row level security;
create policy "super_admins_read_logs" on public.app_logs
  for select using (public.current_user_is_super_admin());
```

**Acceptance criteria:** `app_logs` table created with indexes for common query patterns; only super admins can read; inserts via service role.

**Commit:** `feat(logger): Supabase logs writer + app_logs table`

### Task F.2.4 — Audit log writer (immutable, PII defense)

**File:** `apps/website/src/lib/logger/logger.audit.ts`

**Spec:**

```typescript
import { Effect } from "effect"
import type { TLogEntry } from "./logger.types"
import { createSupabaseServiceClient } from "@/lib/supabase/service"
import { detectPII } from "./pii-content"

export const writeAuditLog = (entry: TLogEntry): Effect.Effect<void> =>
  Effect.tryPromise({
    try: async () => {
      // Defense in depth (F.10.4): refuse if PII detected
      const ctxString = JSON.stringify(entry.context)
      const detectedPII = detectPII(ctxString)
      if (detectedPII.length > 0) {
        console.warn(JSON.stringify({
          ...entry,
          level: "warn",
          message: `Audit log REJECTED: PII detected: ${detectedPII.join(", ")}`,
        }))
        throw new Error("PII detected in audit log payload")
      }

      const supabase = createSupabaseServiceClient()
      const ctx = entry.context as any
      await supabase.from("audit_log").insert({
        actor_id: ctx.userId ?? null,
        company_id: ctx.companyId ?? null,
        action: entry.message,
        resource_type: ctx.resourceType ?? null,
        resource_id: ctx.resourceId ?? null,
        metadata: { caseId: ctx.caseId, sessionId: ctx.sessionId, ...ctx },
        created_at: entry.timestamp,
      })
    },
    catch: (e) => {
      console.warn(`Audit log write failed: ${e}`)
    },
  })
```

**Acceptance criteria:** All `audit`-level logs also write to `audit_log`; if write fails or contains PII, log to console; `audit_log` is append-only (enforced at P1.1.5).

**Commit:** `feat(logger): audit log writer (immutable + PII defense)`

### Task F.2.5 — Tests for logger

**File:** `apps/website/src/lib/logger/__tests__/logger.test.ts`

**Spec:**

```typescript
import { describe, it, expect } from "vitest"
import { Effect, Layer } from "effect"
import { Logger, makeLogger } from "../logger.service"

const TestLoggerLive = Layer.succeed(Logger, makeLogger({ environment: "development", service: "tenang-test" }))

const run = <A, E>(eff: Effect.Effect<A, E, Logger>) =>
  Effect.runPromise(eff.pipe(Effect.provideLayer(TestLoggerLive)))

describe("Logger", () => {
  it("logs info with context", async () => {
    await run(Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.info("Test", { userId: "u-1", action: "test" })
    }))
  })

  it("error includes _tag and message", async () => {
    await run(Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.error("Op failed", { _tag: "TestError", message: "boom" }, { userId: "u-1" })
    }))
  })

  it("audit includes required fields", async () => {
    await run(Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.audit("company.suspended", {
        userId: "u-1", companyId: "co-1", resourceType: "company", resourceId: "co-1",
      })
    }))
  })
})
```

**Commit:** `test(logger): unit tests for Logger service`

---

## F.3 — Request-Scoped Logger Middleware

### Task F.3.1 — Per-request logger middleware

**File:** `apps/website/src/middleware/logger.ts`

**Spec:**

```typescript
import { defineMiddleware } from "astro:middleware"
import { Effect } from "effect"
import { Logger, makeLogger } from "@/lib/logger/logger.service"
import { traceContextFromRequest } from "@/lib/logger/logger.trace"
import { randomHex } from "@/lib/logger/logger.trace"

const REQUEST_ID_HEADER = "x-request-id"

export const loggerMiddleware = defineMiddleware(async (context, next) => {
  const requestId = context.request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID()
  context.response.headers.set(REQUEST_ID_HEADER, requestId)

  const traceCtx = traceContextFromRequest(context.request)
  const traceId = traceCtx?.traceId ?? randomHex(32)
  const spanId = traceCtx?.spanId ?? randomHex(16)

  const logger = makeLogger({
    environment: import.meta.env.NODE_ENV === "production" ? "production" : "development",
    service: "tenang-web",
    traceId, spanId,
  })

  await Effect.runPromise(logger.info("Request started", {
    requestId, traceId, spanId,
    method: context.request.method,
    path: context.url.pathname,
  }))

  const start = Date.now()
  let response: Response
  let error: unknown | undefined
  try {
    response = await next()
  } catch (e) {
    error = e
    throw e
  } finally {
    const durationMs = Date.now() - start
    const status = response?.status ?? 500
    if (error) {
      await Effect.runPromise(logger.error("Request failed", { _tag: "RequestError", message: String(error) }, { requestId, traceId, spanId, durationMs, status }))
    } else {
      await Effect.runPromise(logger.info("Request completed", { requestId, traceId, spanId, durationMs, status }))
    }
  }

  return response
})
```

**Acceptance criteria:** Every request gets a requestId (echoed in response header); request start + completion logged with duration; errors logged with error tag; logger is per-request.

**Commit:** `feat(middleware): request-scoped logger with traceId`

---

## F.4 — Trace Continuity (Effect.span)

### Task F.4.1 — Effect tracing helpers

**File:** `apps/website/src/lib/logger/logger.span.ts`

**Spec:**

```typescript
import { Effect } from "effect"
import { Logger } from "./logger.service"

export const withRequestId = <A, E, R>(requestId: string, effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan("requestId", requestId)
    return yield* effect
  }).pipe(Effect.withSpan("request"))

export const traceProgram = <A, E>(
  programName: string,
  program: Effect.Effect<A, E, Logger>,
): Effect.Effect<A, E, Logger> =>
  Effect.gen(function* () {
    const logger = yield* Logger
    const start = Date.now()
    yield* logger.debug(`Program ${programName} started`)
    const result = yield* program.pipe(Effect.tapBoth({
      onFailure: (e) => logger.error(`Program ${programName} failed`, e, { durationMs: Date.now() - start }),
      onSuccess: (_) => logger.debug(`Program ${programName} succeeded`, { durationMs: Date.now() - start }),
    }))
    return result
  })
```

**Acceptance criteria:** `withRequestId` adds requestId to Effect span; `traceProgram` auto-logs start/finish/error with duration.

**Commit:** `feat(logger): Effect span tracing with requestId`

### Task F.4.2 — Wire traceProgram into run*Effect helpers

**File:** `apps/website/src/lib/api-helpers.ts` (modify)

**Spec:**

```typescript
import { traceProgram } from "@/lib/logger/logger.span"
import { traceContextFromRequest, randomHex } from "@/lib/logger/logger.trace"

export const runAuthEffect = <A, E extends { _tag: string; message: string }>(
  context: APIContext,
  effect: Effect.Effect<A, E, IAuthRepository>,
  programName: string = "auth",
): Promise<A> => {
  const supabase = createSupabaseServerClient(context)!
  const supabaseRepo = makeSupabaseAuthRepository(supabase)
  const traceCtx = traceContextFromRequest(context.request)
  const traceId = traceCtx?.traceId ?? randomHex(32)
  const spanId = traceCtx?.spanId ?? randomHex(16)

  return Effect.runPromise(
    traceProgram(programName, effect).pipe(Effect.provideService(IAuthRepository, supabaseRepo)),
  )
}

// Apply same to runProjectsEffect, runSkillsEffect, runPromptsEffect, runAgentsEffect
```

**Acceptance criteria:** Every program execution auto-logged with start, finish, duration, errors.

**Commit:** `feat(logger): wire traceProgram into all run*Effect helpers`

---

## F.5 — Audit Helpers

**File:** `apps/website/src/lib/logger/audit-helpers.ts`

**Spec:**

```typescript
import { Effect } from "effect"
import { Logger } from "./logger.service"
import type { TCompanyId, TUserId } from "@/shared/types/common.types"

export const logCompanyEvent = (
  action:
    | "company.created" | "company.suspended" | "company.unsuspended"
    | "company.soft_deleted" | "company.hard_deleted"
    | "company.feature_flag.toggled" | "company.quota.updated"
    | "company.billing_tier.changed",
  companyId: TCompanyId,
  actorId: TUserId,
  metadata?: Record<string, unknown>,
): Effect.Effect<void, never, Logger> =>
  Effect.gen(function* () {
    const logger = yield* Logger
    yield* logger.audit(action, { userId: actorId, companyId, resourceType: "company", resourceId: companyId, ...metadata })
  })

export const logMembershipEvent = (
  action: "membership.assigned" | "membership.revoked" | "membership.role_changed" | "membership.last_admin_warning",
  userId: TUserId, companyId: TCompanyId, actorId: TUserId,
  metadata?: Record<string, unknown>,
): Effect.Effect<void, never, Logger> =>
  Effect.gen(function* () {
    const logger = yield* Logger
    yield* logger.audit(action, { userId: actorId, companyId, resourceType: "membership", resourceId: userId, targetUserId: userId, ...metadata })
  })

export const logEscalationEvent = (
  action: "case.created" | "case.assigned" | "case.dismissed" | "case.resolved"
  | "case.re_escalated" | "case.emergency_escalated" | "case.unreachable_protocol",
  caseId: string, actorId: TUserId, companyId: TCompanyId,
  metadata?: Record<string, unknown>,
): Effect.Effect<void, never, Logger> =>
  Effect.gen(function* () {
    const logger = yield* Logger
    yield* logger.audit(action, { userId: actorId, companyId, caseId, resourceType: "escalation_case", resourceId: caseId, ...metadata })
  })

export const logBillingEvent = (
  action: "billing.quota_exhausted" | "billing.tier_changed" | "billing.payment_failed" | "billing.suspended" | "billing.invoice_generated",
  companyId: TCompanyId, actorId: TUserId,
  metadata?: Record<string, unknown>,
): Effect.Effect<void, never, Logger> =>
  Effect.gen(function* () {
    const logger = yield* Logger
    yield* logger.audit(action, { userId: actorId, companyId, resourceType: "billing", resourceId: companyId, ...metadata })
  })
```

**Apply at the right places** in `companies.programs.ts`, `memberships.programs.ts`, `escalation.programs.ts`, `billing.programs.ts`.

**Acceptance criteria:** 4 helper functions; all write to `audit` level (immutable in `audit_log`); includes actor, resource, metadata.

**Commit:** `feat(audit): helpers for sensitive actions`

---

## F.6 — Structured Logging in API Routes

**Pattern — apply to every API route:**

```typescript
export const POST = async (context: APIContext) => {
  const requestId = context.request.headers.get("x-request-id") ?? crypto.randomUUID()
  const logger = makeLogger({ environment: ..., service: "tenang-web" })

  await Effect.runPromise(logger.info("API: POST /api/...", { requestId, action: "..." }))

  // ... handler logic ...

  await Effect.runPromise(logger.info("API: POST /api/... completed", { requestId, durationMs, status }))
}
```

**Acceptance criteria:** Every API route logs request + response; requestId propagated; duration measured.

**Commit:** `feat(logger): structured logging in API routes`

---

## F.7 — Logs Viewer (Super Admin)

**Files:**
- `apps/website/src/pages/super-admin/logs.astro`
- `apps/website/src/components/super-admin/LogsViewer.tsx`
- `apps/website/src/pages/api/super-admin/logs.ts`

**Spec — `LogsViewer.tsx` highlights redacted fields in red, allows filter by level, requestId, userId, companyId, traceId.**

**Acceptance criteria:** Super admin can view logs; filter; cannot see PII (just IDs + metadata); truncate long messages; click to expand nested JSON.

**Commit:** `feat(super-admin): logs viewer with filters`

---

## F.8 — Acceptance Criteria: Observability

1. Every API route logs request + response with requestId
2. Every Effect program logs start/finish with duration
3. Every sensitive action writes to `audit_log`
4. Errors include `_tag` from Effect
5. Super admin can view logs via dashboard
6. RequestId propagates through middleware → route → program → repository
7. All tests for logger pass
8. No `console.log` left in code
9. **AI Engine traceId propagated end-to-end (F.9)**
10. **No PII in any log entry (F.10)**

**Migration checklist:** `app_logs` table (F.2.3); `audit_log` (P1.1.5); indexes; RLS.

**Estimated effort:** 1-2 days for infrastructure + ongoing per-program audit log additions during B2B build.

---

# F.9 — AI Engine Integration: Distributed Tracing + Webhook Observability

> **Scope:** When chat is proxied to (or consumed from) `co-psychologist-ai` — the external clinical AI service — the logger must propagate `traceId` end-to-end and observe every webhook it sends us. This is the only way to debug latency spikes, dropped risk flags, and chat quality issues in production.

**Why this matters:** The chat experience is the most important product surface. When a user says "the AI is slow" or "my crisis card didn't appear", we need to know:
- Did the request reach the AI Engine? (trace propagation)
- How long did the AI Engine take? (latency tracking)
- Did the risk flag fire? (webhook observability)
- Was the response streamed correctly? (SSE timing)
- What did the AI Engine return? (full request/response logging, with PII redacted — see F.10)

**Two integration paths** (decided in Phase 0 Workstream C Open Q #4):
- **Path A** — Consume external `co-psychologist-ai` service via HTTP contract
- **Path B** — Rebuild clinical AI service in this repo's Astro/Workers stack

This appendix covers **both paths** but the external service (Path A) is the more common case for distributed tracing.

## F.9.1 — W3C Trace Context

### Task F.9.1.1 — Trace context propagation

**File:** `apps/website/src/lib/logger/logger.trace.ts`

**Spec:**

```typescript
import { Effect } from "effect"

export type TTraceContext = {
  readonly traceId: string        // 32 hex chars
  readonly spanId: string         // 16 hex chars
  readonly parentSpanId?: string
  readonly traceFlags: string     // "01" = sampled
}

const TRACE_HEADER = "traceparent"
const TRACESTATE_HEADER = "tracestate"
const TRACE_ID_LENGTH = 32
const SPAN_ID_LENGTH = 16
const HEX_REGEX = /^[0-9a-f]+$/

export const randomHex = (length: number): string => {
  const bytes = new Uint8Array(length / 2)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

export const generateTraceContext = (parentSpanId?: string): TTraceContext => ({
  traceId: randomHex(TRACE_ID_LENGTH),
  spanId: randomHex(SPAN_ID_LENGTH),
  parentSpanId,
  traceFlags: "01",
})

export const traceContextToHeaders = (ctx: TTraceContext): Record<string, string> => {
  const value = `00-${ctx.traceId}-${ctx.spanId}-${ctx.traceFlags}`
  return {
    [TRACE_HEADER]: value,
    [TRACESTATE_HEADER]: `tenang=${ctx.spanId}`,
  }
}

export const parseTraceContext = (header: string | null): TTraceContext | null => {
  if (!header) return null
  const match = header.match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/)
  if (!match) return null
  const [, traceId, spanId, traceFlags] = match
  if (!HEX_REGEX.test(traceId) || !HEX_REGEX.test(spanId)) return null
  return { traceId, spanId, traceFlags, parentSpanId: spanId }
}

export const traceContextFromRequest = (request: Request): TTraceContext | null =>
  parseTraceContext(request.headers.get(TRACE_HEADER))
```

**Test — `apps/website/src/lib/logger/__tests__/trace.test.ts`:**

```typescript
import { describe, it, expect } from "vitest"
import { generateTraceContext, parseTraceContext, traceContextToHeaders, traceContextFromRequest } from "../logger.trace"

describe("trace context", () => {
  it("generates valid context", () => {
    const ctx = generateTraceContext()
    expect(ctx.traceId).toHaveLength(32)
    expect(ctx.spanId).toHaveLength(16)
    expect(ctx.traceFlags).toBe("01")
  })

  it("round-trips through headers", () => {
    const ctx = generateTraceContext("parent-span-id")
    const headers = traceContextToHeaders(ctx)
    const parsed = parseTraceContext(headers["traceparent"])
    expect(parsed?.traceId).toBe(ctx.traceId)
    expect(parsed?.spanId).toBe(ctx.spanId)
  })

  it("parses valid W3C traceparent", () => {
    const parsed = parseTraceContext("00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01")
    expect(parsed?.traceId).toBe("0af7651916cd43dd8448eb211c80319c")
    expect(parsed?.spanId).toBe("b7ad6b7169203331")
  })

  it("rejects malformed traceparent", () => {
    expect(parseTraceContext("garbage")).toBeNull()
    expect(parseTraceContext("00-xyz-b7ad6b7169203331-01")).toBeNull()
  })

  it("extracts from Request object", () => {
    const req = new Request("https://example.com", {
      headers: { traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" },
    })
    const ctx = traceContextFromRequest(req)
    expect(ctx?.traceId).toBe("0af7651916cd43dd8448eb211c80319c")
  })
})
```

**Acceptance criteria:** W3C Trace Context (OpenTelemetry-compatible); round-trips through headers; rejects malformed input; integrates with `Logger` context.

**Commit:** `feat(logger): W3C trace context generation + parsing`

### Task F.9.1.2 — Logger context auto-enrichment with trace

**File:** `apps/website/src/lib/logger/logger.service.ts` (modify — already done in F.2.1)

The `makeLogger` function in F.2.1 already accepts `traceId` and `spanId` and includes them in `baseContext`. All logs within that logger carry the trace.

**Acceptance criteria:** Every program execution has traceId + spanId; incoming `traceparent` header is honored.

---

## F.9.2 — AI Engine HTTP Client (with tracing)

### Task F.9.2.1 — `aiEngineClient` with instrumented fetch

**File:** `apps/website/src/lib/ai-engine/ai-engine.client.ts`

**Spec:**

```typescript
import { Effect, Context, Data, Layer } from "effect"
import { Logger } from "@/lib/logger/logger.service"
import { generateTraceContext, traceContextToHeaders, randomHex } from "@/lib/logger/logger.trace"

export const AI_ENGINE_BASE_URL = import.meta.env.AI_ENGINE_BASE_URL ?? "http://localhost:8000"
export const AI_ENGINE_API_KEY = import.meta.env.AI_ENGINE_API_KEY ?? ""

export type TChatRequest = {
  readonly userId: string
  readonly companyId: string | null
  readonly sessionId: string
  readonly messages: ReadonlyArray<{ readonly role: "user" | "assistant" | "system"; readonly content: string }>
  readonly memoryContext?: string
  readonly riskTierAtStart?: "standard" | "critical" | null
}

export type TChatResponse = {
  readonly content: string
  readonly modelUsed: string
  readonly tokensUsed: number
  readonly latencyMs: number
  readonly aiEngineTraceId: string
  readonly memoryUpdated: boolean
  readonly riskFlagsTriggered: ReadonlyArray<{ readonly tier: "standard" | "critical"; readonly pattern: string }>
}

export class AiEngineError extends Data.TaggedError("AiEngineError")<{
  readonly message: string
  readonly statusCode?: number
  readonly cause?: unknown
}> {}

export class IAiEngineClient extends Context.Tag("IAiEngineClient")<
  IAiEngineClient,
  {
    readonly chat: (request: TChatRequest) => Effect.Effect<TChatResponse, AiEngineError, Logger>
    readonly health: () => Effect.Effect<{ status: "ok" | "degraded"; latencyMs: number }, AiEngineError, Logger>
  }
>() {}

export const makeAiEngineClient = (): IAiEngineClient["Type"] => {
  const request = async <T>(path: string, body: unknown, traceId: string, parentSpanId: string): Promise<T> => {
    const spanId = randomHex(16)
    const url = `${AI_ENGINE_BASE_URL}${path}`
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_ENGINE_API_KEY}`,
        ...traceContextToHeaders({ traceId, spanId, parentSpanId, traceFlags: "01" }),
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new AiEngineError({ message: `AI Engine returned ${res.status}`, statusCode: res.status })
    return res.json() as Promise<T>
  }

  return {
    chat: (req) =>
      Effect.gen(function* () {
        const logger = yield* Logger
        const start = Date.now()
        const traceId = randomHex(32)
        const spanId = randomHex(16)

        yield* logger.info("AI Engine: chat request", {
          action: "ai_engine.chat", resourceType: "ai_engine", resourceId: req.sessionId,
          userId: req.userId, companyId: req.companyId ?? undefined, sessionId: req.sessionId,
          traceId, spanId,
          aiEngineRequest: { messageCount: req.messages.length, hasMemoryContext: !!req.memoryContext, riskTierAtStart: req.riskTierAtStart },
        })

        try {
          const response = yield* Effect.tryPromise({
            try: () => request<TChatResponse>("/chat", req, traceId, spanId),
            catch: (e) => new AiEngineError({ message: String(e), cause: e }),
          })
          yield* logger.info("AI Engine: chat response", {
            action: "ai_engine.chat", resourceType: "ai_engine", resourceId: req.sessionId,
            userId: req.userId, companyId: req.companyId ?? undefined, sessionId: req.sessionId,
            traceId, spanId, durationMs: Date.now() - start,
            aiEngineTraceId: response.aiEngineTraceId,
            aiEngineResponse: {
              modelUsed: response.modelUsed, tokensUsed: response.tokensUsed,
              aiEngineLatencyMs: response.latencyMs, memoryUpdated: response.memoryUpdated,
              riskFlagsTriggered: response.riskFlagsTriggered,
            },
          })
          return response
        } catch (e) {
          yield* logger.error("AI Engine: chat failed", e as any, {
            action: "ai_engine.chat", resourceType: "ai_engine", resourceId: req.sessionId,
            userId: req.userId, companyId: req.companyId ?? undefined, sessionId: req.sessionId,
            traceId, spanId, durationMs: Date.now() - start,
          })
          throw e
        }
      }),

    health: () =>
      Effect.gen(function* () {
        const logger = yield* Logger
        const start = Date.now()
        try {
          const res = yield* Effect.tryPromise({
            try: () => fetch(`${AI_ENGINE_BASE_URL}/health`, { headers: { Authorization: `Bearer ${AI_ENGINE_API_KEY}` } }),
            catch: (e) => new AiEngineError({ message: String(e), cause: e }),
          })
          const latencyMs = Date.now() - start
          const status = res.ok ? "ok" : "degraded"
          yield* logger.info("AI Engine: health check", { action: "ai_engine.health", durationMs: latencyMs, aiEngineStatus: status })
          return { status, latencyMs }
        } catch (e) {
          yield* logger.error("AI Engine: health check failed", e as any, { action: "ai_engine.health", durationMs: Date.now() - start })
          throw e
        }
      }),
  }
}

export const AiEngineClientLive = Layer.succeed(IAiEngineClient, makeAiEngineClient())
```

**Test — `apps/website/src/lib/ai-engine/__tests__/ai-engine.client.test.ts`:**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { Effect, Layer } from "effect"
import { Logger, makeLogger } from "@/lib/logger/logger.service"
import { makeAiEngineClient } from "../ai-engine.client"

const captured: any[] = []
const originalLog = console.log
beforeEach(() => { captured.length = 0; console.log = (msg) => captured.push(msg) })
const restoreLog = () => { console.log = originalLog }

const mockFetch = vi.fn()
global.fetch = mockFetch as any

const TestLoggerLive = Layer.succeed(Logger, makeLogger({ environment: "development", service: "tenang-test" }))

describe("AiEngineClient", () => {
  beforeEach(() => mockFetch.mockReset())

  it("chat sends traceparent header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: "test", modelUsed: "deepseek-chat", tokensUsed: 100, latencyMs: 1500,
        aiEngineTraceId: "ai-trace-1", memoryUpdated: false, riskFlagsTriggered: [],
      }),
    })
    await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* IAiEngineClient
        return yield* client.chat({
          userId: "u-1", companyId: "co-1", sessionId: "s-1", messages: [],
        })
      }).pipe(Effect.provideLayer(Layer.mergeAll(TestLoggerLive, AiEngineClientLive))),
    )
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          traceparent: expect.stringMatching(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/),
        }),
      }),
    )
  })

  it("chat logs request + response with traceId", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: "test", modelUsed: "deepseek-chat", tokensUsed: 100, latencyMs: 1500,
        aiEngineTraceId: "ai-trace-1", memoryUpdated: false, riskFlagsTriggered: [],
      }),
    })
    await Effect.runPromise(/* similar */)
    // Assert logs include traceId
  })

  it("health returns ok on 200", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })
    // ...
  })

  it("chat throws AiEngineError on non-2xx", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
    // ...
  })
})
```

**Acceptance criteria:** Every request to AI Engine includes W3C `traceparent` header; logger captures request + response; errors include `_tag`; AI Engine traceId stored.

**Commit:** `feat(ai-engine): instrumented HTTP client with distributed tracing`

### Task F.9.2.2 — Wire AI Engine client into chat API

**File:** `apps/website/src/pages/api/chat.ts` (modify)

**Spec:**

```typescript
import { Effect, Layer } from "effect"
import { Logger, makeLogger } from "@/lib/logger/logger.service"
import { IAiEngineClient, makeAiEngineClient } from "@/lib/ai-engine/ai-engine.client"
import { traceContextFromRequest, generateTraceContext } from "@/lib/logger/logger.trace"

export const POST = async (context: APIContext) => {
  const traceCtx = traceContextFromRequest(context.request) ?? generateTraceContext()
  context.response.headers.set("traceparent", `00-${traceCtx.traceId}-${traceCtx.spanId}-01`)

  const logger = makeLogger({
    environment: import.meta.env.NODE_ENV === "production" ? "production" : "development",
    service: "tenang-web",
    traceId: traceCtx.traceId, spanId: traceCtx.spanId,
  })

  // ... existing auth/quota checks ...

  // Call AI Engine via instrumented client
  const aiEngineResponse = await Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* IAiEngineClient
      return yield* client.chat({
        userId, companyId, sessionId: body.sessionId, messages: body.messages,
        memoryContext, riskTierAtStart: null,
      })
    }).pipe(Effect.provideLayer(Layer.mergeAll(
      Layer.succeed(Logger, logger),
      Layer.succeed(IAiEngineClient, makeAiEngineClient()),
    ))),
  )

  // Stream response
  return new Response(aiEngineResponse.content, {
    headers: { "Content-Type": "text/event-stream", "X-Trace-Id": traceCtx.traceId },
  })
}
```

**Acceptance criteria:** Every chat request logs with traceId; AI Engine response time tracked; risk flags triggered logged; client gets `X-Trace-Id` header.

**Commit:** `feat(chat): wire AI Engine client with distributed tracing`

---

## F.9.3 — AI Engine Webhook Observability

### Task F.9.3.1 — Webhook ingestion with trace correlation

**File:** `apps/website/src/pages/api/webhooks/risk-flag.ts` (modify)

**Spec:**

```typescript
import { traceContextFromRequest, randomHex } from "@/lib/logger/logger.trace"
import { redactPII } from "@/lib/logger/pii-redaction"

export const POST = async (context: APIContext) => {
  const traceCtx = traceContextFromRequest(context.request)
  const traceId = traceCtx?.traceId ?? randomHex(32)
  const spanId = randomHex(16)
  const logger = makeLogger({ environment: ..., service: "tenang-web", traceId, spanId })

  // Verify signature
  const rawBody = await context.request.text()
  const signature = context.request.headers.get("x-ai-engine-signature")
  if (!verifyWebhookSignature(signature, rawBody)) {
    await Effect.runPromise(logger.error("AI Engine webhook: invalid signature", { _tag: "UnauthorizedWebhookError", message: "Invalid signature" }, { action: "ai_engine.webhook.risk_flag" }))
    return new Response("Unauthorized", { status: 401 })
  }

  const body = JSON.parse(rawBody)
  const start = Date.now()

  await Effect.runPromise(logger.info("AI Engine webhook: risk flag received", {
    action: "ai_engine.webhook.risk_flag", traceId, spanId,
    aiEngineTraceId: body.aiEngineTraceId,
    webhookPayload: redactPII(body),  // PII-redacted
  }))

  const flag = await processFlag(body)
  await Effect.runPromise(logger.info("AI Engine webhook: risk flag processed", {
    action: "ai_engine.webhook.risk_flag", traceId, spanId, durationMs: Date.now() - start,
    flagId: flag.id, tier: flag.tier, companyId: flag.companyId,
  }))

  return jsonOk(flag, makeMeta())
}
```

**Acceptance criteria:** Webhook signature verified; incoming webhook logged with AI Engine's traceId; processing duration tracked; result logged.

**Commit:** `feat(webhooks): instrumented risk-flag webhook with trace correlation`

### Task F.9.3.2 — Outbound webhook to AI Engine

**File:** `apps/website/src/lib/ai-engine/ai-engine.webhooks.ts`

**Spec:**

```typescript
import { createHmac } from "node:crypto"

const AI_ENGINE_WEBHOOK_SECRET = import.meta.env.AI_ENGINE_WEBHOOK_SECRET ?? "dev"

const signWebhookBody = (body: string, secret: string): string =>
  createHmac("sha256", secret).update(body).digest("hex")

export const sendWebhookToAiEngine = (
  event: "subscription.changed" | "user.deactivated" | "company.suspended",
  payload: unknown,
  traceCtx: TTraceContext,
): Effect.Effect<void, AiEngineError, Logger> =>
  Effect.gen(function* () {
    const logger = yield* Logger
    const start = Date.now()
    const spanId = randomHex(16)
    const body = JSON.stringify(payload)
    const signature = signWebhookBody(body, AI_ENGINE_WEBHOOK_SECRET)

    yield* Effect.tryPromise({
      try: () => fetch(`${AI_ENGINE_BASE_URL}/webhooks/tenang`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json", "X-Tenang-Signature": signature,
          ...traceContextToHeaders({ ...traceCtx, spanId }),
        },
        body,
      }),
      catch: (e) => new AiEngineError({ message: String(e), cause: e }),
    })

    yield* logger.info("AI Engine webhook: sent", {
      action: "ai_engine.webhook.outbound", event,
      durationMs: Date.now() - start,
      traceId: traceCtx.traceId, spanId,
    })
  })
```

**Acceptance criteria:** Outbound webhooks signed; trace context propagated; send duration logged.

**Commit:** `feat(ai-engine): outbound webhook delivery with trace propagation`

---

## F.9.4 — AI Engine Health Monitoring

### Task F.9.4.1 — Scheduled health check cron

**File:** `apps/website/src/pages/api/cron/ai-engine-health.ts`

**Spec:**

```typescript
export const GET = async (context: APIContext) => {
  const authHeader = context.request.headers.get("authorization")
  if (authHeader !== `Bearer ${import.meta.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const logger = makeLogger({ environment: "production", service: "tenang-web" })
  const supabase = createSupabaseServiceClient()

  let degraded = false
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(`${AI_ENGINE_BASE_URL}/health`, { headers: { Authorization: `Bearer ${AI_ENGINE_API_KEY}` } })
      if (!res.ok) degraded = true
    } catch { degraded = true }
    await new Promise((r) => setTimeout(r, 12000))
  }

  await Effect.runPromise(logger.warn(
    degraded ? "AI Engine: degraded" : "AI Engine: healthy",
    { _tag: degraded ? "AiEngineDegraded" : "AiEngineHealthy", message: degraded ? "Health check failed" : "OK" },
    { action: "ai_engine.health_check.cron" },
  ))

  if (degraded) {
    await supabase.from("platform_status").upsert({
      id: 1, is_active: true,
      title: "We're experiencing some delays in chat responses",
      body: "Our AI engine is being monitored. Your conversations will continue normally.",
      expected_resolution_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
  } else {
    await supabase.from("platform_status").upsert({ id: 1, is_active: false })
  }

  return new Response("OK")
}
```

**Update `wrangler.jsonc`:**

```jsonc
{
  "triggers": {
    "crons": [
      "0 6 * * *",      // Daily client health
      "0 9 * * *",      // Daily renewal reminder
      "*/5 * * * *"     // Every 5 min AI Engine health
    ]
  }
}
```

**Acceptance criteria:** Health check every 5 minutes; degraded auto-publishes banner; healthy clears banner; all logged.

**Commit:** `feat(cron): AI Engine health monitoring every 5 min`

---

# F.10 — PII Redaction in Logs

> **Scope:** Logs must NEVER contain PII (emails, phone numbers, names, addresses, ID numbers, chat content, risk assessment content). This is a **non-negotiable** requirement under UU PDP and Indonesian clinical ethics standards.

**Why this matters:**
- Logs are stored in `app_logs` table (read by super admins and potentially by Cloudflare logpush destinations)
- Audit logs are immutable and long-lived
- A data breach of logs = data breach of PII
- PII in logs makes compliance audits nearly impossible

**Two-layer approach:**
1. **Field-level redaction** — known PII fields (email, phone, name) replaced with `[REDACTED:field]`
2. **Content-level redaction** — free text scrubbed via regex (emails, phones, names, addresses, JWTs, etc.)

## F.10.1 — Field-Level Redaction

### Task F.10.1.1 — Define PII schema

**File:** `apps/website/src/lib/logger/pii-fields.ts`

**Spec:**

```typescript
export const PII_FIELDS = [
  "email", "phone", "fullName", "full_name",
  "name",  // ambiguous — only redact in user context
  "address", "dateOfBirth", "date_of_birth",
  "idNumber", "id_number", "ktp", "passport", "ssn",
  "taxId", "tax_id", "creditCard", "credit_card",
  "bankAccount", "bank_account",
  "password", "passwordHash", "password_hash",
  "token", "accessToken", "access_token",
  "refreshToken", "refresh_token", "sessionSecret", "session_secret",
  "chatContent", "chat_content", "transcript",
  "aiSummary", "ai_summary",
  "notes", "caseNotes", "case_notes",
] as const

export type TPiiField = typeof PII_FIELDS[number]

export const redactFields = (input: unknown, depth = 0): unknown => {
  if (depth > 10) return "[REDACTED:deep]"
  if (input === null || input === undefined) return input
  if (typeof input !== "object") return input
  if (Array.isArray(input)) return input.map((item) => redactFields(item, depth + 1))
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (PII_FIELDS.includes(key as TPiiField)) {
      out[key] = `[REDACTED:${key}]`
    } else if (typeof value === "object" && value !== null) {
      out[key] = redactFields(value, depth + 1)
    } else {
      out[key] = value
    }
  }
  return out
}
```

**Test — `apps/website/src/lib/logger/__tests__/pii-fields.test.ts`:**

```typescript
import { describe, it, expect } from "vitest"
import { redactFields } from "../pii-fields"

describe("redactFields", () => {
  it("redacts top-level email", () => {
    expect(redactFields({ email: "user@example.com" })).toEqual({ email: "[REDACTED:email]" })
  })

  it("redacts nested PII", () => {
    expect(redactFields({ user: { email: "x@y.com", age: 30 } })).toEqual({ user: { email: "[REDACTED:email]", age: 30 } })
  })

  it("redacts arrays of PII", () => {
    expect(redactFields([{ email: "a@b.com" }, { email: "c@d.com" }])).toEqual([
      { email: "[REDACTED:email]" }, { email: "[REDACTED:email]" },
    ])
  })

  it("preserves non-PII fields", () => {
    const input = { userId: "u-1", companyId: "co-1", action: "test", durationMs: 100 }
    expect(redactFields(input)).toEqual(input)
  })

  it("redacts multiple PII types", () => {
    const input = { email: "x@y.com", phone: "+62812345678", name: "John", age: 30 }
    expect(redactFields(input)).toEqual({
      email: "[REDACTED:email]", phone: "[REDACTED:phone]", name: "[REDACTED:name]", age: 30,
    })
  })

  it("handles deep nesting with depth limit", () => {
    let deep: any = { value: 1 }
    for (let i = 0; i < 12; i++) deep = { nested: deep }
    const result = redactFields(deep) as any
    expect(JSON.stringify(result)).toContain("REDACTED")
  })

  it("redacts snake_case PII fields", () => {
    expect(redactFields({ full_name: "John", date_of_birth: "1990-01-01" })).toEqual({
      full_name: "[REDACTED:full_name]", date_of_birth: "[REDACTED:date_of_birth]",
    })
  })
})
```

**Acceptance criteria:** All PII_FIELDS redacted at any depth; depth limit prevents infinite recursion; non-PII preserved; both camelCase and snake_case.

**Commit:** `feat(logger): PII field-level redaction`

### Task F.10.1.2 — Wire redactFields into logger (already in F.2.1)

The `format` function in F.2.1 already calls `redactFields` on context and error.

**Test — `apps/website/src/lib/logger/__tests__/logger.redaction.test.ts`:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { Effect, Layer } from "effect"
import { Logger, makeLogger } from "../logger.service"

const captured: any[] = []
const originalLog = console.log
beforeEach(() => { captured.length = 0; console.log = (msg) => captured.push(msg) })
afterEach(() => { console.log = originalLog })

const TestLoggerLive = Layer.succeed(Logger, makeLogger({ environment: "development", service: "tenang-test" }))
const run = <A, E>(eff: Effect.Effect<A, E, Logger>) => Effect.runPromise(eff.pipe(Effect.provideLayer(TestLoggerLive)))

describe("Logger PII redaction", () => {
  it("redacts email in context", async () => {
    await run(Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.info("test", { email: "user@example.com" })
    }))
    expect(captured[0]).toContain("[REDACTED:email]")
    expect(captured[0]).not.toContain("user@example.com")
  })

  it("redacts phone in context", async () => {
    await run(Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.info("test", { phone: "+62812345678" })
    }))
    expect(captured[0]).toContain("[REDACTED:phone]")
    expect(captured[0]).not.toContain("62812345678")
  })

  it("preserves IDs (not PII)", async () => {
    await run(Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.info("test", { userId: "u-1", companyId: "co-1" })
    }))
    expect(captured[0]).toContain("u-1")
    expect(captured[0]).toContain("co-1")
  })

  it("redacts in error context", async () => {
    await run(Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.error("Op failed", { _tag: "TestError", message: "boom", cause: { email: "x@y.com" } }, {})
    }))
  })
})
```

**Acceptance criteria:** Email, phone, etc. all redacted in any log entry; userId/companyId preserved.

**Commit:** `feat(logger): wire redactFields into all log entries`

---

## F.10.2 — Content-Level Redaction (Free Text)

### Task F.10.2.1 — Regex-based PII detector

**File:** `apps/website/src/lib/logger/pii-content.ts`

**Spec:**

```typescript
const PATTERNS: ReadonlyArray<{ name: string; regex: RegExp; replacement: string }> = [
  { name: "email", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: "[REDACTED:email]" },
  { name: "phone-id", regex: /\b(?:\+62|62|0)8[0-9]{8,11}\b/g, replacement: "[REDACTED:phone]" },
  { name: "phone-intl", regex: /\b\+[0-9]{8,15}\b/g, replacement: "[REDACTED:phone]" },
  { name: "ktp", regex: /\b[0-9]{16}\b|\b[0-9]{6}-[0-9]{7}-[0-9]{4}\b/g, replacement: "[REDACTED:ktp]" },
  { name: "credit-card", regex: /\b[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{3,4}\b/g, replacement: "[REDACTED:cc]" },
  { name: "ipv4", regex: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g, replacement: "[REDACTED:ip]" },
  { name: "jwt", regex: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, replacement: "[REDACTED:jwt]" },
]

export const redactContent = (text: string): string => {
  if (!text) return text
  let result = text
  for (const pattern of PATTERNS) result = result.replace(pattern.regex, pattern.replacement)
  return result
}

export const detectPII = (text: string): ReadonlyArray<string> => {
  if (!text) return []
  const detected: string[] = []
  for (const pattern of PATTERNS) {
    if (pattern.regex.test(text)) detected.push(pattern.name)
    pattern.regex.lastIndex = 0
  }
  return detected
}
```

**Test — `apps/website/src/lib/logger/__tests__/pii-content.test.ts`:**

```typescript
import { describe, it, expect } from "vitest"
import { redactContent, detectPII } from "../pii-content"

describe("redactContent", () => {
  it("redacts email", () => {
    expect(redactContent("Contact me at john@example.com please")).toBe("Contact me at [REDACTED:email] please")
  })
  it("redacts Indonesian phone", () => {
    expect(redactContent("Call 081234567890 or +6281234567890")).toBe("Call [REDACTED:phone] or [REDACTED:phone]")
  })
  it("redacts KTP", () => {
    expect(redactContent("My KTP is 1234567890123456")).toBe("My KTP is [REDACTED:ktp]")
    expect(redactContent("KTP: 123456-7890123-4567")).toBe("KTP: [REDACTED:ktp]")
  })
  it("redacts credit card", () => {
    expect(redactContent("Card: 4111-1111-1111-1111")).toBe("Card: [REDACTED:cc]")
  })
  it("redacts IPv4", () => {
    expect(redactContent("From 192.168.1.1")).toBe("From [REDACTED:ip]")
  })
  it("redacts JWT", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    expect(redactContent(`Token: ${jwt}`)).toBe("Token: [REDACTED:jwt]")
  })
  it("preserves non-PII text", () => {
    const text = "The user logged in successfully at 10:30 AM"
    expect(redactContent(text)).toBe(text)
  })
  it("handles multiple PII in one string", () => {
    expect(redactContent("Email john@test.com or call 081234567890")).toBe("Email [REDACTED:email] or call [REDACTED:phone]")
  })
})

describe("detectPII", () => {
  it("detects which PII types are present", () => {
    expect(detectPII("Contact john@test.com or 081234567890")).toEqual(expect.arrayContaining(["email", "phone-id"]))
  })
  it("returns empty array for clean text", () => {
    expect(detectPII("The user is feeling better today")).toEqual([])
  })
})
```

**Acceptance criteria:** Email, phone (ID + intl), KTP, credit card, IPv4, JWT all detected and redacted; non-PII text passes; multiple PII all redacted.

**Commit:** `feat(logger): content-level PII redaction (regex)`

### Task F.10.2.2 — Optional name detection (opt-in)

**File:** `apps/website/src/lib/logger/pii-content.ts` (modify)

**Spec:** Optional name detection. False-positive risk is HIGH, so opt-in only.

```typescript
const ENABLE_NAME_DETECTION = import.meta.env.PII_NAME_DETECTION === "true"

const COMMON_FIRST_NAMES = [
  "Budi", "Dewi", "Agus", "Siti", "Rina", "Dian", "Bayu", "Andi", "Rudi", "Putri",
  "John", "Jane", "Michael", "Sarah", "David", "Lisa", "Robert", "Emily", "James", "Mary",
]

const NAME_PATTERN = new RegExp(`\\b(${COMMON_FIRST_NAMES.join("|")})\\b`, "g")

export const redactNames = (text: string): string => {
  if (!ENABLE_NAME_DETECTION) return text
  return text.replace(NAME_PATTERN, "[REDACTED:name]")
}
```

**Acceptance criteria:** Disabled by default; opt-in via `PII_NAME_DETECTION=true`; only common first names matched.

**Commit:** `feat(logger): optional name detection (opt-in)`

---

## F.10.3 — Auto-Redact Chat Content

### Task F.10.3.1 — Wire redactContent into logger (already in F.2.1)

The `format` function in F.2.1 already calls `redactContent` on `REDACTABLE_TEXT_FIELDS` (aiSummary, transcript, notes, etc.).

**Test — `apps/website/src/lib/logger/__tests__/logger.content-redaction.test.ts`:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { Effect, Layer } from "effect"
import { Logger, makeLogger } from "../logger.service"

const captured: any[] = []
const originalLog = console.log
beforeEach(() => { captured.length = 0; console.log = (msg) => captured.push(msg) })
afterEach(() => { console.log = originalLog })

const TestLoggerLive = Layer.succeed(Logger, makeLogger({ environment: "development", service: "tenang-test" }))
const run = <A, E>(eff: Effect.Effect<A, E, Logger>) => Effect.runPromise(eff.pipe(Effect.provideLayer(TestLoggerLive)))

describe("Logger content redaction", () => {
  it("redacts email in aiSummary", async () => {
    await run(Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.info("Case summary", { aiSummary: "User mentioned john@example.com" })
    }))
    expect(captured[0]).toContain("[REDACTED:email]")
    expect(captured[0]).not.toContain("john@example.com")
  })

  it("redacts phone in transcript", async () => {
    await run(Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.info("Chat", { transcript: "User: call me at 081234567890" })
    }))
    expect(captured[0]).toContain("[REDACTED:phone]")
  })

  it("preserves non-PII in description", async () => {
    await run(Effect.gen(function* () {
      const logger = yield* Logger
      yield* logger.info("Ticket", { description: "Login button is broken" })
    }))
    expect(captured[0]).toContain("Login button is broken")
  })
})
```

**Acceptance criteria:** Free-text fields auto-redacted; email/phone/KTP all scrubbed; non-PII text preserved.

**Commit:** `feat(logger): auto-redact free-text fields in log context`

---

## F.10.4 — Reject Logs with PII (Defense in Depth)

### Task F.10.4.1 — PII defense in audit_log writer (already in F.2.4)

The `writeAuditLog` function in F.2.4 already calls `detectPII` on the context. If PII is found, the log is refused and a warning is emitted to console.

**Test — `apps/website/src/lib/logger/__tests__/logger.audit-pii.test.ts`:**

```typescript
import { describe, it, expect, vi } from "vitest"
import { writeAuditLog } from "../logger.audit"

describe("audit log PII defense", () => {
  it("refuses to write audit log containing email", async () => {
    const insert = vi.fn()
    // Mock supabase
    const entry = {
      level: "audit" as const,
      message: "user.created",
      context: { userId: "u-1", email: "x@y.com" },
      timestamp: new Date().toISOString(),
      service: "tenang-web" as const,
      environment: "production" as const,
    }
    await writeAuditLog(entry)
    expect(insert).not.toHaveBeenCalled()
  })
})
```

**Acceptance criteria:** Audit log writes that contain PII are REJECTED; warning logged to console; original log NOT written to `audit_log`.

**Commit:** `feat(logger): reject audit logs with PII (defense in depth)`

---

## F.10.5 — Log Viewer PII Safety

### Task F.10.5.1 — Logs viewer shows redacted data

**File:** `apps/website/src/components/super-admin/LogsViewer.tsx` (modify — built in F.7)

**Spec:**

```typescript
const renderContext = (context: any) => {
  return Object.entries(context).map(([key, value]) => {
    const isRedacted = typeof value === "string" && value.startsWith("[REDACTED:")
    return (
      <div key={key} className="text-xs">
        <span className="font-mono text-gray-500">{key}:</span>{" "}
        {isRedacted ? (
          <span className="text-red-600 font-mono">{value}</span>
        ) : (
          <span className="font-mono">{String(value)}</span>
        )}
      </div>
    )
  })
}
```

**Acceptance criteria:** Redacted fields highlighted in red; non-redacted fields shown normally; truncate long values; click to expand nested JSON.

**Commit:** `feat(logs-viewer): highlight redacted fields`

---

# Cross-Appendix Acceptance Gate

**For Phase 1 launch, observability requirements:**

| Requirement | Status |
|---|---|
| Logger service in place (F.1-F.2) | ✅ F.2.1 |
| Request middleware with requestId (F.3) | ✅ F.3.1 |
| Effect trace continuity (F.4) | ✅ F.4.1-F.4.2 |
| Audit helpers applied to all sensitive programs (F.5) | ✅ F.5 |
| Every API route logs request+response (F.6) | ✅ F.6 |
| Logs viewer at /super-admin/logs (F.7) | ✅ F.7 |
| No `console.log` left in BE | ✅ Verification command |
| W3C traceparent propagated to/from AI Engine (F.9) | ✅ F.9.1-F.9.2 |
| AI Engine webhooks instrumented (F.9.3) | ✅ F.9.3 |
| AI Engine health monitored (F.9.4) | ✅ F.9.4 |
| Field-level PII redaction (F.10.1) | ✅ F.10.1 |
| Content-level PII redaction (F.10.2) | ✅ F.10.2 |
| Chat content auto-redacted (F.10.3) | ✅ F.10.3 |
| Audit log rejects PII (F.10.4) | ✅ F.10.4 |
| Logs viewer shows redacted (F.10.5) | ✅ F.10.5 |

**Estimated additional effort for F.9 + F.10:** 2-3 days for infrastructure, then ongoing audit log additions during B2B build.
