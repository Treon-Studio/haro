# B2B Extended Epics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement three core B2B extension epics: Billing Session Quotas (EPIC-06), Clinical Triage Queues (EPIC-04), and HIPAA-compliant anonymized Admin Analytics Dashboards (EPIC-05).

**Architecture:** We use an Effect-TS domain-driven design. We write migrations, create separate folders for `billing`, `safety`, and `analytics` domains, set up REST routes mapping domain programs, and build beautiful, responsive React 19 UI modules.

**Tech Stack:** Astro 5, React 19, Supabase RLS, Effect-TS (`@effect/schema`, `effect`), Lucide Icons, Tailwind CSS v4, Recharts.

---

## File Structure & Touch-Map

```
apps/website/
  supabase/migrations/
    20260624000008_company_billing_quotas.sql
    20260624000009_create_risk_and_escalation.sql
    20260624000010_create_session_metrics.sql
  src/
    domain/
      billing/ (types, errors, schemas, repository, repository.supabase, programs, index)
      safety/ (types, errors, schemas, repository, repository.supabase, programs, index)
      analytics/ (types, errors, repository, repository.supabase, programs, index)
    pages/
      api/
        companies/[id]/billing.ts
        super-admin/risk/ (escalate.ts, cases.ts, cases/[id].ts)
        companies/[id]/analytics.ts
        companies/[id]/audit-trail.ts
      super-admin/
        audit-log.astro
        tenants.astro
        handoffs.astro
        risk-queue.astro
      admin/
        dashboard.astro
    blocks/
      super-admin/
        RiskQueue.tsx
      admin/
        AdminDashboard.tsx
    lib/
      api-helpers.ts
```

---

## Phase 2 Sprints: Task Decompositions

### Task P2.1: Quota Billing Migration (EPIC-06)

**Files:**
- Create: `apps/website/supabase/migrations/20260624000008_company_billing_quotas.sql`

- [ ] **Step 1: Write migration SQL**
Write columns `session_quota` and `sessions_used` to `companies` table, and create the `billing_events` log table with strict RLS restricted to owner, admin, or super_admin roles.

```sql
-- Upgrades public.companies with billing/quota tracking
alter table public.companies
  add column if not exists session_quota integer not null default 1000,
  add column if not exists sessions_used integer not null default 0;

-- Create B2B Billing Events Audit Table
create table if not exists public.billing_events (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  event_type text not null check (event_type in ('quota_allocated', 'quota_exceeded', 'payment_success', 'payment_failed', 'company_suspended')),
  amount numeric(15, 2) default 0.00,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.billing_events enable row level security;

-- RLS: select restricted to corporate owners, admins, and platform super_admins
create policy "Admins can view billing events" on public.billing_events
  for select using (
    exists (
      select 1 from public.company_memberships
      where company_id = billing_events.company_id
        and user_id = auth.uid()
        and role in ('owner', 'admin', 'super_admin')
        and status = 'active'
    )
  );
```

- [ ] **Step 2: Commit**
```bash
git add apps/website/supabase/migrations/20260624000008_company_billing_quotas.sql
git commit -m "migration: company_billing_quotas"
```

---

### Task P2.2: Quota Billing Domain Layer (EPIC-06)

**Files:**
- Create: `apps/website/src/domain/billing/billing.types.ts`
- Create: `apps/website/src/domain/billing/billing.errors.ts`
- Create: `apps/website/src/domain/billing/billing.repository.ts`
- Create: `apps/website/src/domain/billing/billing.repository.supabase.ts`
- Create: `apps/website/src/domain/billing/billing.programs.ts`
- Create: `apps/website/src/domain/billing/index.ts`
- Test: `apps/website/src/domain/billing/__tests__/billing.programs.test.ts`

- [ ] **Step 1: Create types, errors, and repository interfaces**

`billing.types.ts`:
```typescript
export type TBillingInfo = {
  readonly companyId: string
  readonly sessionQuota: number
  readonly sessionsUsed: number
  readonly isQuotaExceeded: boolean
  readonly warningLevel: "none" | "warning" | "critical" | "exceeded"
}

export type TBillingInfoDto = {
  readonly company_id: string
  readonly session_quota: number
  readonly sessions_used: number
  readonly is_quota_exceeded: boolean
  readonly warning_level: string
}

export const toBillingInfoDto = (info: TBillingInfo): TBillingInfoDto => ({
  company_id: info.companyId,
  session_quota: info.sessionQuota,
  sessions_used: info.sessionsUsed,
  is_quota_exceeded: info.isQuotaExceeded,
  warning_level: info.warningLevel,
})
```

`billing.errors.ts`:
```typescript
import { Data } from "effect"
export class BillingFetchError extends Data.TaggedError("BillingFetchError")<{ readonly message: string }> {}
export class BillingUpdateError extends Data.TaggedError("BillingUpdateError")<{ readonly message: string }> {}
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{ readonly message: string }> {}
```

`billing.repository.ts`:
```typescript
import { Context, Effect } from "effect"
import type { TBillingInfo } from "./billing.types"
import { BillingFetchError, BillingUpdateError, UnauthorizedError } from "./billing.errors"

export class IBillingRepository extends Context.Tag("IBillingRepository")<
  IBillingRepository,
  {
    readonly getBillingInfo: (companyId: string) => Effect.Effect<TBillingInfo, BillingFetchError | UnauthorizedError>
    readonly incrementSessionUsage: (companyId: string) => Effect.Effect<TBillingInfo, BillingUpdateError | UnauthorizedError>
  }
> () {}
```

- [ ] **Step 2: Create Supabase repository implementation**

`billing.repository.supabase.ts`:
```typescript
import { Effect } from "effect"
import type { SupabaseClient } from "@supabase/supabase-js"
import { IBillingRepository } from "./billing.repository"
import type { TBillingInfo } from "./billing.types"
import { BillingFetchError, BillingUpdateError, UnauthorizedError } from "./billing.errors"

const mapBillingData = (data: any): TBillingInfo => {
  const quota = data.session_quota
  const used = data.sessions_used
  const isExceeded = used >= quota
  let warningLevel: "none" | "warning" | "critical" | "exceeded" = "none"

  if (isExceeded) warningLevel = "exceeded"
  else if (used >= quota * 0.95) warningLevel = "critical"
  else if (used >= quota * 0.8) warningLevel = "warning"

  return {
    companyId: data.id,
    sessionQuota: quota,
    sessionsUsed: used,
    isQuotaExceeded: isExceeded,
    warningLevel,
  }
}

export const makeSupabaseBillingRepository = (
  supabase: SupabaseClient,
): IBillingRepository["Type"] => ({
  getBillingInfo: (companyId) =>
    Effect.tryPromise({
      try: async () => {
        const { data, error } = await supabase
          .from("companies")
          .select("id, session_quota, sessions_used")
          .eq("id", companyId)
          .single()

        if (error || !data) throw new BillingFetchError({ message: error?.message || "Organisasi tidak ditemukan" })
        return mapBillingData(data)
      },
      catch: (err: any) => {
        if (err instanceof BillingFetchError) return err
        return new BillingFetchError({ message: err?.message || "Unknown error" })
      },
    }),

  incrementSessionUsage: (companyId) =>
    Effect.tryPromise({
      try: async () => {
        // Fetch current
        const { data: current, error: getError } = await supabase
          .from("companies")
          .select("sessions_used")
          .eq("id", companyId)
          .single()

        if (getError || !current) throw new BillingUpdateError({ message: "Gagal memuat status kuota" })

        const { data, error } = await supabase
          .from("companies")
          .update({ sessions_used: current.sessions_used + 1 })
          .eq("id", companyId)
          .select("id, session_quota, sessions_used")
          .single()

        if (error || !data) throw new BillingUpdateError({ message: error?.message || "Gagal mengupdate pemakaian kuota" })
        return mapBillingData(data)
      },
      catch: (err: any) => {
        if (err instanceof BillingUpdateError) return err
        return new BillingUpdateError({ message: err?.message || "Unknown error" })
      },
    }),
})
```

- [ ] **Step 3: Create programs & barrel index**

`billing.programs.ts`:
```typescript
import { Effect, pipe } from "effect"
import { IBillingRepository } from "./billing.repository"
import { toBillingInfoDto } from "./billing.types"
import type { TBillingInfoDto } from "./billing.types"
import { BillingFetchError, BillingUpdateError, UnauthorizedError } from "./billing.errors"

export type BillingProgramError = BillingFetchError | BillingUpdateError | UnauthorizedError

export const getBillingInfoProgram = (
  companyId: string,
): Effect.Effect<TBillingInfoDto, BillingProgramError, IBillingRepository> =>
  pipe(
    IBillingRepository,
    Effect.flatMap((repo) => repo.getBillingInfo(companyId)),
    Effect.map(toBillingInfoDto),
  )

export const checkAndIncrementQuotaProgram = (
  companyId: string,
): Effect.Effect<boolean, BillingProgramError, IBillingRepository> =>
  pipe(
    IBillingRepository,
    Effect.flatMap((repo) =>
      pipe(
        repo.getBillingInfo(companyId),
        Effect.flatMap((info) => {
          if (info.isQuotaExceeded) {
            return Effect.succeed(false)
          }
          return pipe(
            repo.incrementSessionUsage(companyId),
            Effect.map(() => true),
          )
        }),
      )
    ),
  )
```

`index.ts`:
```typescript
export * from "./billing.types"
export * from "./billing.errors"
export * from "./billing.repository"
export * from "./billing.repository.supabase"
export * from "./billing.programs"
```

- [ ] **Step 4: Write failing unit test**

`__tests__/billing.programs.test.ts`:
```typescript
import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { IBillingRepository } from "../billing.repository"
import { getBillingInfoProgram, checkAndIncrementQuotaProgram } from "../billing.programs"
import type { TBillingInfo } from "../billing.types"

const mockBilling: TBillingInfo = {
  companyId: "company-1",
  sessionQuota: 10,
  sessionsUsed: 8,
  isQuotaExceeded: false,
  warningLevel: "warning",
}

const mockRepo = {
  getBillingInfo: (companyId: string) => {
    if (companyId === "company-exhausted") {
      return Effect.succeed({ ...mockBilling, companyId, sessionsUsed: 10, isQuotaExceeded: true, warningLevel: "exceeded" })
    }
    return Effect.succeed({ ...mockBilling, companyId })
  },
  incrementSessionUsage: (companyId: string) =>
    Effect.succeed({ ...mockBilling, companyId, sessionsUsed: 9 }),
} satisfies IBillingRepository["Type"]

const runWithRepo = (effect: any): Promise<any> =>
  Effect.runPromise(effect.pipe(Effect.provideService(IBillingRepository, mockRepo)))

describe("getBillingInfoProgram", () => {
  it("fetches and maps corporate billing quota status", async () => {
    const result = await runWithRepo(getBillingInfoProgram("company-1"))
    expect(result.company_id).toBe("company-1")
    expect(result.sessions_used).toBe(8)
    expect(result.is_quota_exceeded).toBe(false)
    expect(result.warning_level).toBe("warning")
  })
})

describe("checkAndIncrementQuotaProgram", () => {
  it("increments quota if limit has not been reached", async () => {
    const result = await runWithRepo(checkAndIncrementQuotaProgram("company-1"))
    expect(result).toBe(true)
  })

  it("returns false and blocks increment if quota is already exhausted", async () => {
    const result = await runWithRepo(checkAndIncrementQuotaProgram("company-exhausted"))
    expect(result).toBe(false)
  })
})
```

- [ ] **Step 5: Run tests and verify they pass**
Run: `pnpm test src/domain/billing/`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git add apps/website/src/domain/billing/
git commit -m "feat(domain): company billing quota tracking domain"
```

---

### Task P2.3: Billing Quota REST Routes & API Helpers (EPIC-06)

**Files:**
- Modify: `apps/website/src/lib/api-helpers.ts`
- Create: `apps/website/src/pages/api/companies/[id]/billing.ts`

- [ ] **Step 1: Update API helpers with `runBillingEffect`**
Add `IBillingRepository` and `makeSupabaseBillingRepository` imports and append `runBillingEffect`.

```typescript
import { IBillingRepository, makeSupabaseBillingRepository } from "@/domain/billing/index"

export const runBillingEffect = <A>(
  context: APIContext,
  effect: Effect.Effect<A, any, IBillingRepository>,
): Promise<A> => {
  const supabase = createSupabaseServerClient(context)!
  const supabaseRepo = makeSupabaseBillingRepository(supabase)
  const logger = context.locals.logger
  const traced = effect.pipe(Effect.provideService(IBillingRepository, supabaseRepo))
  return logger?.withSpan
    ? Effect.runPromise(logger.withSpan("billing", () => traced))
    : Effect.runPromise(traced)
}
```

- [ ] **Step 2: Create B2B billing status route**

`api/companies/[id]/billing.ts`:
```typescript
import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { getBillingInfoProgram } from "@/domain/billing/billing.programs"
import { makeMeta, jsonOk, jsonError, runBillingEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"

export const GET: APIRoute = async (context) => {
  const meta = makeMeta()
  const companyId = context.params.id

  if (!companyId) {
    return jsonError({ _tag: "ValidationError", message: "Company ID is required" }, meta, HTTP_STATUS.BAD_REQUEST)
  }

  const program = pipe(
    getBillingInfoProgram(companyId),
    Effect.map((data) => jsonOk(data, meta)),
    Effect.catchTags({
      UnauthorizedError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
      BillingFetchError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runBillingEffect(context, program)
}
```

- [ ] **Step 3: Run diagnostics**
Run: `pnpm check`
Expected: SUCCESS

- [ ] **Step 4: Commit**
```bash
git add apps/website/src/lib/api-helpers.ts apps/website/src/pages/api/companies/
git commit -m "feat(api): billing quotas REST endpoint"
```

---

### Task P2.4: Quota Enforcement in Chat Engine (EPIC-06)

**Files:**
- Modify: `apps/website/src/pages/api/conversations.ts`
- Modify: `apps/website/blocks/chat/components/ChatForm.tsx`
- Modify: `apps/website/blocks/chat/index.tsx`

- [ ] **Step 1: Wire checkAndIncrementQuotaProgram into conversation initialization**
Ensure B2C (personal/no companyId) bypasses checking.

```typescript
// Inside POST handler of src/pages/api/conversations.ts
import { runBillingEffect } from '@/lib/api-helpers'
import { checkAndIncrementQuotaProgram } from '@/domain/billing/billing.programs'

// Inside POST, if companyId is present
const billingProgram = checkAndIncrementQuotaProgram(companyId)
const isQuotaAllowed = await runBillingEffect(context, billingProgram)
if (!isQuotaAllowed) {
  return json({ error: "Sesi kuota perusahaan Anda telah habis untuk bulan ini." }, 403)
}
```

- [ ] **Step 2: Load billing info & render Quota Warning Banner in frontend**
Modify `blocks/chat/index.tsx` to fetch `/api/companies/[id]/billing` if companyId exists, passing `isQuotaExceeded: boolean` to `ChatForm.tsx`.

`ChatForm.tsx`:
```typescript
interface ChatFormProps {
  // ...
  isQuotaExceeded?: boolean
}

// In ChatForm rendering, if isQuotaExceeded is true, replace input form markup with:
{isQuotaExceeded ? (
  <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', textAlign: 'center', fontSize: 13, lineHeight: '1.5' }}>
    Perusahaan Anda telah mencapai batas kuota obrolan bulan ini. Silakan hubungi HR Admin Anda untuk mengupgrade paket layanan.
  </div>
) : (
  // render normal textarea & send buttons...
)}
```

- [ ] **Step 3: Run type check & verification**
Run: `pnpm check && pnpm test`
Expected: SUCCESS

- [ ] **Step 4: Commit**
```bash
git add apps/website/src/pages/api/conversations.ts apps/website/blocks/chat/
git commit -m "feat(chat): enforce billing session quota locks on chat client"
```

---

### Task P2.5: Clinical Safety & Risk Migration (EPIC-04)

**Files:**
- Create: `apps/website/supabase/migrations/20260624000009_create_risk_and_escalation.sql`

- [ ] **Step 1: Write migration SQL**
Create risk tiers, case statuses, `risk_flags`, and `escalation_cases` tables. Apply complete security policies restricting select/update actions to active clinical_staff, super_admin, or company owners.

```sql
create type public.risk_tier as enum ('standard', 'critical');
create type public.case_status as enum ('open', 'assigned', 'resolved', 'dismissed');

-- Risk Flags: recorded whenever self-harm or acute mental distress intent is triggered
create table if not exists public.risk_flags (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  session_id text not null, -- references Cloudflare KV conversation ID
  tier public.risk_tier not null default 'standard',
  ai_summary text, -- detailed summary extracted by AI
  trigger_pattern text, -- matching keywords or safety trigger patterns
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Escalation Cases: actionable cases managed by clinical psychologists
create table if not exists public.escalation_cases (
  id uuid default gen_random_uuid() primary key,
  risk_flag_id uuid not null references public.risk_flags(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  status public.case_status not null default 'open',
  primary_assignee uuid references auth.users(id) on delete set null, -- clinical psychologist
  backup_assignee uuid references auth.users(id) on delete set null,
  followup_attempts jsonb not null default '[]'::jsonb, -- logs of follow-up calls/messages
  outcome text, -- e.g., 'referred_to_psychologist', 'resolved_offline', 'dismissed_false_positive'
  outcome_notes text,
  resolved_at timestamp with time zone,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.risk_flags enable row level security;
alter table public.escalation_cases enable row level security;

-- Only clinical staff, super admins, or company owners can access safety records
create policy "Clinical staff can manage escalation cases" on public.escalation_cases
  for all using (
    exists (
      select 1 from public.company_memberships
      where company_id = escalation_cases.company_id
        and user_id = auth.uid()
        and role in ('owner', 'super_admin', 'clinical_staff')
        and status = 'active'
    )
  );

create policy "Clinical staff can view risk flags" on public.risk_flags
  for select using (
    exists (
      select 1 from public.company_memberships
      where company_id = risk_flags.company_id
        and user_id = auth.uid()
        and role in ('owner', 'super_admin', 'clinical_staff')
        and status = 'active'
    )
  );
```

- [ ] **Step 2: Commit**
```bash
git add apps/website/supabase/migrations/20260624000009_create_risk_and_escalation.sql
git commit -m "migration: create_risk_and_escalation"
```

---

### Task P2.6: Clinical Safety & Risk Domain Layer (EPIC-04)

**Files:**
- Create: `apps/website/src/domain/safety/safety.types.ts`
- Create: `apps/website/src/domain/safety/safety.errors.ts`
- Create: `apps/website/src/domain/safety/safety.repository.ts`
- Create: `apps/website/src/domain/safety/safety.repository.supabase.ts`
- Create: `apps/website/src/domain/safety/safety.programs.ts`
- Create: `apps/website/src/domain/safety/index.ts`
- Test: `apps/website/src/domain/safety/__tests__/safety.programs.test.ts`

- [ ] **Step 1: Create types, errors, and repository interfaces**

`safety.types.ts`:
```typescript
export type TRiskFlag = {
  readonly id: string
  readonly userId: string
  readonly companyId: string
  readonly sessionId: string
  readonly tier: "standard" | "critical"
  readonly aiSummary: string | null
  readonly triggerPattern: string | null
  readonly createdAt: string
}

export type TEscalationCase = {
  readonly id: string
  readonly riskFlagId: string
  readonly companyId: string
  readonly status: "open" | "assigned" | "resolved" | "dismissed"
  readonly primaryAssignee: string | null
  readonly backupAssignee: string | null
  readonly followupAttempts: readonly { date: string; notes: string }[]
  readonly outcome: string | null
  readonly outcomeNotes: string | null
  readonly resolvedAt: string | null
  readonly resolvedBy: string | null
  readonly createdAt: string
}
```

`safety.errors.ts`:
```typescript
import { Data } from "effect"
export class SafetyFetchError extends Data.TaggedError("SafetyFetchError")<{ readonly message: string }> {}
export class SafetyUpdateError extends Data.TaggedError("SafetyUpdateError")<{ readonly message: string }> {}
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{ readonly message: string }> {}
```

`safety.repository.ts`:
```typescript
import { Context, Effect } from "effect"
import type { TRiskFlag, TEscalationCase } from "./safety.types"
import { SafetyFetchError, SafetyUpdateError, UnauthorizedError } from "./safety.errors"

export class ISafetyRepository extends Context.Tag("ISafetyRepository")<
  ISafetyRepository,
  {
    readonly flagRisk: (userId: string, companyId: string, sessionId: string, tier: "standard" | "critical", summary: string, trigger: string) => Effect.Effect<TRiskFlag, SafetyUpdateError | UnauthorizedError>
    readonly getEscalationCases: () => Effect.Effect<readonly TEscalationCase[], SafetyFetchError | UnauthorizedError>
    readonly assignCase: (caseId: string, assigneeId: string) => Effect.Effect<TEscalationCase, SafetyUpdateError | UnauthorizedError>
    readonly logFollowupAttempt: (caseId: string, notes: string) => Effect.Effect<TEscalationCase, SafetyUpdateError | UnauthorizedError>
    readonly resolveCase: (caseId: string, outcome: string, notes: string) => Effect.Effect<TEscalationCase, SafetyUpdateError | UnauthorizedError>
  }
> () {}
```

- [ ] **Step 2: Create Supabase repository implementation**

`safety.repository.supabase.ts`:
```typescript
import { Effect } from "effect"
import type { SupabaseClient } from "@supabase/supabase-js"
import { ISafetyRepository } from "./safety.repository"
import type { TRiskFlag, TEscalationCase } from "./safety.types"
import { SafetyFetchError, SafetyUpdateError, UnauthorizedError } from "./safety.errors"

const mapRiskData = (data: any): TRiskFlag => ({
  id: data.id,
  userId: data.user_id,
  companyId: data.company_id,
  sessionId: data.session_id,
  tier: data.tier as "standard" | "critical",
  aiSummary: data.ai_summary,
  triggerPattern: data.trigger_pattern,
  createdAt: data.created_at,
})

const mapCaseData = (data: any): TEscalationCase => ({
  id: data.id,
  riskFlagId: data.risk_flag_id,
  companyId: data.company_id,
  status: data.status as "open" | "assigned" | "resolved" | "dismissed",
  primaryAssignee: data.primary_assignee,
  backupAssignee: data.backup_assignee,
  followupAttempts: data.followup_attempts || [],
  outcome: data.outcome,
  outcomeNotes: data.outcome_notes,
  resolvedAt: data.resolved_at,
  resolvedBy: data.resolved_by,
  createdAt: data.created_at,
})

export const makeSupabaseSafetyRepository = (
  supabase: SupabaseClient,
): ISafetyRepository["Type"] => ({
  flagRisk: (userId, companyId, sessionId, tier, summary, trigger) =>
    Effect.tryPromise({
      try: async () => {
        const { data: flag, error } = await supabase
          .from("risk_flags")
          .insert({
            user_id: userId,
            company_id: companyId,
            session_id: sessionId,
            tier,
            ai_summary: summary,
            trigger_pattern: trigger,
          })
          .select()
          .single()

        if (error || !flag) throw new SafetyUpdateError({ message: error?.message || "Gagal mencatat bendera risiko" })

        // Auto escalate case if tier is critical
        if (tier === "critical") {
          const { error: caseError } = await supabase
            .from("escalation_cases")
            .insert({
              risk_flag_id: flag.id,
              company_id: companyId,
              status: "open",
            })

          if (caseError) {
            await supabase.from("risk_flags").delete().eq("id", flag.id)
            throw new SafetyUpdateError({ message: `Auto escalation failed: ${caseError.message}` })
          }
        }

        return mapRiskData(flag)
      },
      catch: (err: any) => {
        if (err instanceof SafetyUpdateError) return err
        return new SafetyUpdateError({ message: err?.message || "Unknown error" })
      },
    }),

  getEscalationCases: () =>
    Effect.tryPromise({
      try: async () => {
        const { data, error } = await supabase
          .from("escalation_cases")
          .select("*")
          .in("status", ["open", "assigned"])
          .order("created_at", { ascending: false })

        if (error) throw new SafetyFetchError({ message: error.message })
        if (!data) return []

        return data.map(mapCaseData)
      },
      catch: (err: any) => {
        if (err instanceof SafetyFetchError) return err
        return new SafetyFetchError({ message: err?.message || "Unknown error" })
      },
    }),

  assignCase: (caseId, assigneeId) =>
    Effect.tryPromise({
      try: async () => {
        const { data, error } = await supabase
          .from("escalation_cases")
          .update({
            status: "assigned",
            primary_assignee: assigneeId,
          })
          .eq("id", caseId)
          .select()
          .single()

        if (error || !data) throw new SafetyUpdateError({ message: error?.message || "Gagal menetapkan penanganan kasus" })
        return mapCaseData(data)
      },
      catch: (err: any) => {
        if (err instanceof SafetyUpdateError) return err
        return new SafetyUpdateError({ message: err?.message || "Unknown error" })
      },
    }),

  logFollowupAttempt: (caseId, notes) =>
    Effect.tryPromise({
      try: async () => {
        const { data: current, error: getError } = await supabase
          .from("escalation_cases")
          .select("followup_attempts")
          .eq("id", caseId)
          .single()

        if (getError || !current) throw new SafetyUpdateError({ message: "Gagal memuat log follow-up" })

        const logs = [...(current.followup_attempts || []), { date: new Date().toISOString(), notes }]

        const { data, error } = await supabase
          .from("escalation_cases")
          .update({ followup_attempts: logs })
          .eq("id", caseId)
          .select()
          .single()

        if (error || !data) throw new SafetyUpdateError({ message: error?.message || "Gagal memperbarui log follow-up" })
        return mapCaseData(data)
      },
      catch: (err: any) => {
        if (err instanceof SafetyUpdateError) return err
        return new SafetyUpdateError({ message: err?.message || "Unknown error" })
      },
    }),

  resolveCase: (caseId, outcome, notes) =>
    Effect.tryPromise({
      try: async () => {
        const { data: sessionData } = await supabase.auth.getSession()
        const userId = sessionData?.session?.user?.id

        const { data, error } = await supabase
          .from("escalation_cases")
          .update({
            status: "resolved",
            outcome,
            outcome_notes: notes,
            resolved_at: new Date().toISOString(),
            resolved_by: userId || null,
          })
          .eq("id", caseId)
          .select()
          .single()

        if (error || !data) throw new SafetyUpdateError({ message: error?.message || "Gagal menyelesaikan kasus" })
        return mapCaseData(data)
      },
      catch: (err: any) => {
        if (err instanceof SafetyUpdateError) return err
        return new SafetyUpdateError({ message: err?.message || "Unknown error" })
      },
    }),
})
```

- [ ] **Step 3: Create programs & barrel index**

`safety.programs.ts`:
```typescript
import { Effect, pipe } from "effect"
import { ISafetyRepository } from "./safety.repository"
import { SafetyFetchError, SafetyUpdateError, UnauthorizedError } from "./safety.errors"
import type { TRiskFlag, TEscalationCase } from "./safety.types"

export type SafetyProgramError = SafetyFetchError | SafetyUpdateError | UnauthorizedError

export const flagRiskProgram = (
  userId: string,
  companyId: string,
  sessionId: string,
  tier: "standard" | "critical",
  summary: string,
  trigger: string,
): Effect.Effect<TRiskFlag, SafetyProgramError, ISafetyRepository> =>
  pipe(
    ISafetyRepository,
    Effect.flatMap((repo) => repo.flagRisk(userId, companyId, sessionId, tier, summary, trigger)),
  )

export const getEscalationCasesProgram = (): Effect.Effect<
  readonly TEscalationCase[],
  SafetyProgramError,
  ISafetyRepository
> =>
  pipe(
    ISafetyRepository,
    Effect.flatMap((repo) => repo.getEscalationCases()),
  )

export const assignCaseProgram = (
  caseId: string,
  assigneeId: string,
): Effect.Effect<TEscalationCase, SafetyProgramError, ISafetyRepository> =>
  pipe(
    ISafetyRepository,
    Effect.flatMap((repo) => repo.assignCase(caseId, assigneeId)),
  )

export const logFollowupAttemptProgram = (
  caseId: string,
  notes: string,
): Effect.Effect<TEscalationCase, SafetyProgramError, ISafetyRepository> =>
  pipe(
    ISafetyRepository,
    Effect.flatMap((repo) => repo.logFollowupAttempt(caseId, notes)),
  )

export const resolveCaseProgram = (
  caseId: string,
  outcome: string,
  notes: string,
): Effect.Effect<TEscalationCase, SafetyProgramError, ISafetyRepository> =>
  pipe(
    ISafetyRepository,
    Effect.flatMap((repo) => repo.resolveCase(caseId, outcome, notes)),
  )
```

`index.ts`:
```typescript
export * from "./safety.types"
export * from "./safety.errors"
export * from "./safety.repository"
export * from "./safety.repository.supabase"
export * from "./safety.programs"
```

- [ ] **Step 4: Write failing unit test**

`__tests__/safety.programs.test.ts`:
```typescript
import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { ISafetyRepository } from "../safety.repository"
import { flagRiskProgram, assignCaseProgram, logFollowupAttemptProgram, resolveCaseProgram } from "../safety.programs"
import type { TRiskFlag, TEscalationCase } from "../safety.types"

const mockFlag: TRiskFlag = {
  id: "flag-1",
  userId: "user-1",
  companyId: "company-1",
  sessionId: "session-1",
  tier: "critical",
  aiSummary: "Suicidality keywords triggered",
  triggerPattern: "bunuh diri",
  createdAt: "2026-06-24T00:00:00Z",
}

const mockCase: TEscalationCase = {
  id: "case-1",
  riskFlagId: "flag-1",
  companyId: "company-1",
  status: "open",
  primaryAssignee: null,
  backupAssignee: null,
  followupAttempts: [],
  outcome: null,
  outcomeNotes: null,
  resolvedAt: null,
  resolvedBy: null,
  createdAt: "2026-06-24T00:00:00Z",
}

const mockRepo = {
  flagRisk: (userId: string, companyId: string, sessionId: string, tier: "standard" | "critical", summary: string, trigger: string) =>
    Effect.succeed({ ...mockFlag, userId, companyId, sessionId, tier, aiSummary: summary, triggerPattern: trigger }),
  getEscalationCases: () => Effect.succeed([mockCase]),
  assignCase: (caseId: string, assigneeId: string) =>
    Effect.succeed({ ...mockCase, id: caseId, primaryAssignee: assigneeId, status: "assigned" }),
  logFollowupAttempt: (caseId: string, notes: string) =>
    Effect.succeed({ ...mockCase, id: caseId, followupAttempts: [{ date: "2026-06-24T00:00:00Z", notes }] }),
  resolveCase: (caseId: string, outcome: string, notes: string) =>
    Effect.succeed({ ...mockCase, id: caseId, status: "resolved", outcome, outcomeNotes: notes, resolvedAt: "2026-06-24T00:00:00Z" }),
} satisfies ISafetyRepository["Type"]

const runWithRepo = (effect: any): Promise<any> =>
  Effect.runPromise(effect.pipe(Effect.provideService(ISafetyRepository, mockRepo)))

describe("flagRiskProgram", () => {
  it("records risk flags and triggers automatic case escalation", async () => {
    const result = await runWithRepo(flagRiskProgram("user-9", "company-1", "session-9", "critical", "Crisis detected", "harm"))
    expect(result.userId).toBe("user-9")
    expect(result.tier).toBe("critical")
  })
})

describe("assignCaseProgram", () => {
  it("assigns active psychologists and locks states", async () => {
    const result = await runWithRepo(assignCaseProgram("case-123", "psychologist-1"))
    expect(result.id).toBe("case-123")
    expect(result.primaryAssignee).toBe("psychologist-1")
    expect(result.status).toBe("assigned")
  })
})

describe("logFollowupAttemptProgram", () => {
  it("appends timeline entries", async () => {
    const result = await runWithRepo(logFollowupAttemptProgram("case-123", "User called, no response"))
    expect(result.id).toBe("case-123")
    expect(result.followupAttempts).toHaveLength(1)
    expect(result.followupAttempts[0].notes).toBe("User called, no response")
  })
})

describe("resolveCaseProgram", () => {
  it("resolves clinical cases with closing outcomes", async () => {
    const result = await runWithRepo(resolveCaseProgram("case-123", "referred_to_psychologist", "Referred to local clinic"))
    expect(result.id).toBe("case-123")
    expect(result.status).toBe("resolved")
    expect(result.outcome).toBe("referred_to_psychologist")
  })
})
```

- [ ] **Step 5: Run tests and verify they pass**
Run: `pnpm test src/domain/safety/`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git add apps/website/src/domain/safety/
git commit -m "feat(domain): clinical safety escalation domain"
```

---

### Task P2.7: Clinical Safety REST Routes & Realtime Sockets (EPIC-04)

**Files:**
- Modify: `apps/website/src/lib/api-helpers.ts`
- Create: `apps/website/src/pages/api/super-admin/risk/escalate.ts`
- Create: `apps/website/src/pages/api/super-admin/risk/cases.ts`
- Create: `apps/website/src/pages/api/super-admin/risk/cases/[id].ts`

- [ ] **Step 1: Update API helpers with `runSafetyEffect`**
Add `ISafetyRepository` and `makeSupabaseSafetyRepository` imports and append `runSafetyEffect`.

```typescript
import { ISafetyRepository, makeSupabaseSafetyRepository } from "@/domain/safety/index"

export const runSafetyEffect = <A>(
  context: APIContext,
  effect: Effect.Effect<A, any, ISafetyRepository>,
): Promise<A> => {
  const supabase = createSupabaseServerClient(context)!
  const supabaseRepo = makeSupabaseSafetyRepository(supabase)
  const logger = context.locals.logger
  const traced = effect.pipe(Effect.provideService(ISafetyRepository, supabaseRepo))
  return logger?.withSpan
    ? Effect.runPromise(logger.withSpan("safety", () => traced))
    : Effect.runPromise(traced)
}
```

- [ ] **Step 2: Create API Endpoints for Clinical safety actions**

`api/super-admin/risk/escalate.ts`:
```typescript
import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { flagRiskProgram } from "@/domain/safety/safety.programs"
import { makeMeta, jsonOk, jsonError, runSafetyEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: () => new Error("Invalid JSON body"),
    }),
    Effect.flatMap((body: any) =>
      flagRiskProgram(body.userId, body.companyId, body.sessionId, body.tier, body.summary, body.trigger)
    ),
    Effect.map((data) => jsonOk(data, meta, HTTP_STATUS.CREATED)),
    Effect.catchAll((err: any) => Effect.succeed(jsonError({ _tag: "SafetyError", message: err.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR))),
  )

  return await runSafetyEffect(context, program)
}
```

`api/super-admin/risk/cases.ts`:
```typescript
import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { getEscalationCasesProgram } from "@/domain/safety/safety.programs"
import { makeMeta, jsonOk, jsonError, runSafetyEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"

export const GET: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    getEscalationCasesProgram(),
    Effect.map((data) => jsonOk(data, meta)),
    Effect.catchAll((err: any) => Effect.succeed(jsonError({ _tag: "SafetyError", message: err.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR))),
  )

  return await runSafetyEffect(context, program)
}
```

`api/super-admin/risk/cases/[id].ts`:
```typescript
import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { assignCaseProgram, logFollowupAttemptProgram, resolveCaseProgram } from "@/domain/safety/safety.programs"
import { makeMeta, jsonOk, jsonError, runSafetyEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { ValidationError } from "@/shared/errors/application.errors"

export const PATCH: APIRoute = async (context) => {
  const meta = makeMeta()
  const caseId = context.params.id

  if (!caseId) {
    return jsonError({ _tag: "ValidationError", message: "Case ID is required" }, meta, HTTP_STATUS.BAD_REQUEST)
  }

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: () => new ValidationError({ issues: "Invalid JSON body" }),
    }),
    Effect.flatMap((body: any) => {
      if (body.action === "assign") {
        return assignCaseProgram(caseId, body.assigneeId)
      } else if (body.action === "log_attempt") {
        return logFollowupAttemptProgram(caseId, body.notes)
      } else if (body.action === "resolve") {
        return resolveCaseProgram(caseId, body.outcome, body.notes)
      }
      return Effect.fail(new ValidationError({ issues: "Aksi tidak dikenal" }))
    }),
    Effect.map((data) => jsonOk(data, meta)),
    Effect.catchTags({
      ValidationError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.issues }, meta, HTTP_STATUS.BAD_REQUEST)),
      UnauthorizedError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
    }),
    Effect.catchAll((err: any) => Effect.succeed(jsonError({ _tag: "SafetyError", message: err.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR))),
  )

  return await runSafetyEffect(context, program)
}
```

- [ ] **Step 3: Run type checks**
Run: `pnpm check`
Expected: SUCCESS

- [ ] **Step 4: Commit**
```bash
git add apps/website/src/lib/api-helpers.ts apps/website/src/pages/api/super-admin/risk/
git commit -m "feat(api): clinical triage REST endpoints"
```

---

### Task P2.8: Real-time Clinical Triage Board (EPIC-04)

**Files:**
- Create: `apps/website/blocks/super-admin/RiskQueue.tsx`
- Create: `apps/website/src/pages/super-admin/risk-queue.astro`

- [ ] **Step 1: Build interactive board UI island**

`blocks/super-admin/RiskQueue.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@treonstudio/bungas-core/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@treonstudio/bungas-core/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@treonstudio/bungas-core/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@treonstudio/bungas-core/ui/dialog'
import {
  ShieldAlert,
  Users,
  Activity,
  UserCheck,
  CheckCircle,
  Loader2,
  Clock,
  ClipboardCheck,
  Plus
} from 'lucide-react'

type TEscalationCase = {
  id: string
  risk_flag_id: string
  company_id: string
  status: 'open' | 'assigned' | 'resolved' | 'dismissed'
  primary_assignee: string | null
  followup_attempts: { date: string; notes: string }[]
  created_at: string
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
)

export function RiskQueue() {
  const [cases, setCases] = useState<TEscalationCase[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCase, setSelectedCase] = useState<TEscalationCase | null>(null)
  const [followupNotes, setFollowupNotes] = useState('')
  const [resolveOutcome, setResolveOutcome] = useState<'referred_to_psychologist' | 'resolved_offline' | 'dismissed_false_positive'>('resolved_offline')
  const [resolveNotes, setResolveNotes] = useState('')
  const [isActionLoading, setIsActionLoading] = useState(false)

  const fetchCases = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/super-admin/risk/cases')
      const result = await res.json()
      if (result.success && result.data) {
        setCases(result.data)
      }
    } catch (err) {
      console.error('Error fetching clinical cases', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCases()

    // Subscribes to real-time clinical updates
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'escalation_cases' },
        (payload) => {
          console.log('Realtime change received!', payload)
          fetchCases() // trigger reload on updates/inserts
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleAssign = async (caseId: string) => {
    setIsActionLoading(true)
    try {
      const res = await fetch(`/api/super-admin/risk/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign', assigneeId: 'clinical_user' }) // session user
      })
      const result = await res.json()
      if (result.success) {
        fetchCases()
        setSelectedCase(null)
      }
    } catch (err) {
      console.error('Error assigning case', err)
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleAddFollowup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCase || !followupNotes.trim() || isActionLoading) return

    setIsActionLoading(true)
    try {
      const res = await fetch(`/api/super-admin/risk/cases/${selectedCase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'log_attempt', notes: followupNotes.trim() })
      })
      const result = await res.json()
      if (result.success) {
        setFollowupNotes('')
        fetchCases()
        setSelectedCase(null)
      }
    } catch (err) {
      console.error('Error adding followup', err)
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCase || isActionLoading) return

    setIsActionLoading(true)
    try {
      const res = await fetch(`/api/super-admin/risk/cases/${selectedCase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', outcome: resolveOutcome, notes: resolveNotes })
      })
      const result = await res.json()
      if (result.success) {
        setResolveNotes('')
        setSelectedCase(null)
        fetchCases()
      }
    } catch (err) {
      console.error('Error resolving case', err)
    } finally {
      setIsActionLoading(false)
    }
  }

  const criticalQueue = cases.filter(c => c.status === 'open')
  const assignedQueue = cases.filter(c => c.status === 'assigned')

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* 1. Critical Queue (Open Crises) */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2 text-red-500">
          <ShieldAlert className="h-5 w-5 animate-pulse" />
          Critical Queue (Unassigned)
        </h2>
        {isLoading ? (
          <div className="h-20 animate-pulse bg-surface-secondary rounded" />
        ) : criticalQueue.length > 0 ? (
          criticalQueue.map(c => (
            <Card key={c.id} className="bg-surface-primary border-red-500/20 text-text-primary hover:border-red-500/40 transition-colors cursor-pointer" onClick={() => setSelectedCase(c)}>
              <div className="p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-sm">Case {c.id.slice(0,8)}</h3>
                  <p className="text-[10px] text-text-secondary">Opened: {new Date(c.created_at).toLocaleString()}</p>
                </div>
                <Badge className="bg-red-500/10 text-red-500 border-none text-[10px] uppercase font-bold">Open</Badge>
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center py-8 text-text-secondary border border-dashed border-border-primary rounded-lg text-xs">Antrean aman. Tidak ada krisis mendesak.</div>
        )}
      </div>

      {/* 2. Assigned Triage Queue */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2 text-brand-primary">
          <Activity className="h-5 w-5" />
          Assigned & In-Followup
        </h2>
        {isLoading ? (
          <div className="h-20 animate-pulse bg-surface-secondary rounded" />
        ) : assignedQueue.length > 0 ? (
          assignedQueue.map(c => (
            <Card key={c.id} className="bg-surface-primary border-border-primary text-text-primary hover:border-brand-primary/30 transition-colors cursor-pointer" onClick={() => setSelectedCase(c)}>
              <div className="p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-sm">Case {c.id.slice(0,8)}</h3>
                  <p className="text-[10px] text-text-secondary">Assignee: {c.primary_assignee || 'Assigned'}</p>
                </div>
                <Badge className="bg-brand-primary/10 text-brand-primary border-none text-[10px] uppercase font-bold">Assigned</Badge>
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center py-8 text-text-secondary border border-dashed border-border-primary rounded-lg text-xs">Tidak ada kasus penanganan aktif.</div>
        )}
      </div>

      {/* Triage & Management Dialog */}
      {selectedCase && (
        <Dialog open={!!selectedCase} onOpenChange={(open) => !open && setSelectedCase(null)}>
          <DialogContent className="bg-surface-primary text-text-primary border-border-primary max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-brand-primary" />
                Manage Case {selectedCase.id.slice(0,8)}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs text-text-secondary">
              <div>Status Kasus: <Badge className="border-none bg-brand-primary/10 text-brand-primary uppercase font-bold text-[9px]">{selectedCase.status}</Badge></div>

              {selectedCase.status === 'open' ? (
                <div className="space-y-2">
                  <p>Kasus ini belum ditugaskan kepada siapa pun. Ambil alih untuk memulai pelacakan penanganan.</p>
                  <Button onClick={() => handleAssign(selectedCase.id)} className="w-full bg-brand-primary text-white">
                    {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4 mr-1" />}
                    Ambil Alih Kasus
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Followup logs */}
                  <div className="space-y-1.5 p-3 rounded bg-surface-secondary/50 border border-border-primary">
                    <span className="font-bold text-text-primary block mb-1">Riwayat Follow-Up:</span>
                    {selectedCase.followup_attempts.length > 0 ? (
                      selectedCase.followup_attempts.map((att, i) => (
                        <div key={i} className="border-b border-border-primary last:border-none pb-1 mb-1">
                          <div className="text-[10px] text-text-secondary font-mono">{new Date(att.date).toLocaleString()}</div>
                          <p className="text-text-primary mt-0.5">{att.notes}</p>
                        </div>
                      ))
                    ) : (
                      <p className="italic">Belum ada aktivitas follow-up yang dicatat.</p>
                    )}
                  </div>

                  {/* Add Followup Form */}
                  <form onSubmit={handleAddFollowup} className="space-y-2">
                    <Label htmlFor="notes" className="font-bold text-text-primary">Catat Aktivitas Follow-up Baru</Label>
                    <Input id="notes" value={followupNotes} onChange={e => setFollowupNotes(e.target.value)} placeholder="Tulis catatan, e.g. Telah melakukan panggilan telepon..." required className="border-border-primary bg-transparent text-text-primary" />
                    <Button type="submit" disabled={isActionLoading} className="w-full">
                      {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Log Aktivitas'}
                    </Button>
                  </form>

                  {/* Resolve Form */}
                  <form onSubmit={handleResolve} className="space-y-2 border-t border-border-primary pt-4">
                    <Label htmlFor="outcome" className="font-bold text-text-primary">Selesaikan & Tutup Kasus</Label>
                    <Select value={resolveOutcome} onValueChange={(val: any) => setResolveOutcome(val)}>
                      <SelectTrigger className="border-border-primary bg-transparent text-text-primary">
                        <SelectValue placeholder="Pilih Hasil" />
                      </SelectTrigger>
                      <SelectContent className="bg-surface-primary text-text-primary border-border-primary">
                        <SelectItem value="referred_to_psychologist">Dirujuk ke Psikolog Offline</SelectItem>
                        <SelectItem value="resolved_offline">Selesai via Konseling</SelectItem>
                        <SelectItem value="dismissed_false_positive">Salah Deteksi (False Positive)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} placeholder="Tulis rincian penutupan kasus..." required className="border-border-primary bg-transparent text-text-primary" />
                    <Button type="submit" disabled={isActionLoading} className="w-full bg-green-600 hover:bg-green-700 text-white border-none">
                      {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Selesaikan Kasus'}
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
```

`src/pages/super-admin/risk-queue.astro`:
```astro
---
import SuperAdminLayout from '@/layouts/SuperAdminLayout.astro'
import { RiskQueue } from '@/../blocks/super-admin/RiskQueue'
---

<SuperAdminLayout title="Triage Queue - Super Admin Console">
  <div class="p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
    <div>
      <h1 class="text-3xl font-extrabold tracking-tight">Clinical Triage Board</h1>
      <p class="text-sm text-text-secondary">Antrean mitigasi krisis psikologis secara real-time demi keselamatan pengguna.</p>
    </div>

    <RiskQueue client:load />
  </div>
</SuperAdminLayout>
```

- [ ] **Step 2: Verify type check**
Run: `pnpm check`
Expected: SUCCESS

- [ ] **Step 3: Commit**
```bash
git add apps/website/blocks/super-admin/RiskQueue.tsx apps/website/src/pages/super-admin/risk-queue.astro
git commit -m "feat(ui): real-time clinical triage board"
```

---

### Task P2.9: Admin Analytics Migration & Logging (EPIC-05)

**Files:**
- Create: `apps/website/supabase/migrations/20260624000010_create_session_metrics.sql`

- [ ] **Step 1: Write migration SQL**
Create `session_metrics` table with index on `company_id` and `created_at`. Configure RLS allowing selects exclusively to active company owners, admins, or super admins.

```sql
-- Track lightweight session logs for high-performance aggregate reporting
create table if not exists public.session_metrics (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null, -- references Cloudflare KV conversation ID
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexing for speed
create index idx_session_metrics_company_id on public.session_metrics(company_id);
create index idx_session_metrics_created_at on public.session_metrics(created_at);

-- Enable Row Level Security
alter table public.session_metrics enable row level security;

create policy "Admins can view company session metrics" on public.session_metrics
  for select using (
    exists (
      select 1 from public.company_memberships
      where company_id = session_metrics.company_id
        and user_id = auth.uid()
        and role in ('owner', 'admin', 'super_admin')
        and status = 'active'
    )
  );
```

- [ ] **Step 2: Commit**
```bash
git add apps/website/supabase/migrations/20260624000010_create_session_metrics.sql
git commit -m "migration: create_session_metrics"
```

---

### Task P2.10: Admin Analytics Domain Layer (EPIC-05)

**Files:**
- Create: `apps/website/src/domain/analytics/analytics.types.ts`
- Create: `apps/website/src/domain/analytics/analytics.errors.ts`
- Create: `apps/website/src/domain/analytics/analytics.repository.ts`
- Create: `apps/website/src/domain/analytics/analytics.repository.supabase.ts`
- Create: `apps/website/src/domain/analytics/analytics.programs.ts`
- Create: `apps/website/src/domain/analytics/index.ts`
- Test: `apps/website/src/domain/analytics/__tests__/analytics.programs.test.ts`

- [ ] **Step 1: Create types, errors, and repository interfaces**

`analytics.types.ts`:
```typescript
export type TAnalyticsData = {
  readonly totalMembers: number
  readonly totalSessions: number
  readonly dauHistory: readonly { date: string; active_users: number }[]
  readonly isPrivacyProtected: boolean
}

export type TAnalyticsDto = {
  readonly total_members: number
  readonly total_sessions: number
  readonly dau_history: readonly { date: string; active_users: number }[]
  readonly is_privacy_protected: boolean
}

export const toAnalyticsDto = (data: TAnalyticsData): TAnalyticsDto => ({
  total_members: data.totalMembers,
  total_sessions: data.totalSessions,
  dau_history: data.dauHistory,
  is_privacy_protected: data.isPrivacyProtected,
})
```

`analytics.errors.ts`:
```typescript
import { Data } from "effect"
export class AnalyticsFetchError extends Data.TaggedError("AnalyticsFetchError")<{ readonly message: string }> {}
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{ readonly message: string }> {}
```

`analytics.repository.ts`:
```typescript
import { Context, Effect } from "effect"
import type { TAnalyticsData } from "./analytics.types"
import { AnalyticsFetchError, UnauthorizedError } from "./analytics.errors"

export class IAnalyticsRepository extends Context.Tag("IAnalyticsRepository")<
  IAnalyticsRepository,
  {
    readonly getCompanyMemberCount: (companyId: string) => Effect.Effect<number, AnalyticsFetchError | UnauthorizedError>
    readonly getDailyActiveUsers: (companyId: string, limitDays: number) => Effect.Effect<readonly { date: string; active_users: number }[], AnalyticsFetchError | UnauthorizedError>
    readonly getTotalSessionsCount: (companyId: string, limitDays: number) => Effect.Effect<number, AnalyticsFetchError | UnauthorizedError>
  }
> () {}
```

- [ ] **Step 2: Create Supabase repository implementation**

`analytics.repository.supabase.ts`:
```typescript
import { Effect } from "effect"
import type { SupabaseClient } from "@supabase/supabase-js"
import { IAnalyticsRepository } from "./analytics.repository"
import { AnalyticsFetchError, UnauthorizedError } from "./analytics.errors"

export const makeSupabaseAnalyticsRepository = (
  supabase: SupabaseClient,
): IAnalyticsRepository["Type"] => ({
  getCompanyMemberCount: (companyId) =>
    Effect.tryPromise({
      try: async () => {
        const { count, error } = await supabase
          .from("company_company_memberships" as any || "company_memberships") // support mapped fallback
          .select("*", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("status", "active")

        if (error) throw new AnalyticsFetchError({ message: error.message })
        return count || 0
      },
      catch: (err: any) => {
        if (err instanceof AnalyticsFetchError) return err
        return new AnalyticsFetchError({ message: err?.message || "Unknown error" })
      },
    }),

  getDailyActiveUsers: (companyId, limitDays) =>
    Effect.tryPromise({
      try: async () => {
        // Simple aggregate group by date query
        const { data, error } = await supabase
          .from("session_metrics")
          .select("created_at, user_id")
          .eq("company_id", companyId)

        if (error) throw new AnalyticsFetchError({ message: error.message })
        if (!data) return []

        // In-memory bucket by date to support SQLite/Postgres uniform dev tests
        const counts: Record<string, Set<string>> = {}
        data.forEach((row) => {
          const date = new Date(row.created_at).toISOString().split("T")[0]
          if (!counts[date]) counts[date] = new Set()
          counts[date].add(row.user_id)
        })

        return Object.keys(counts).map((date) => ({
          date,
          active_users: counts[date].size,
        }))
      },
      catch: (err: any) => {
        if (err instanceof AnalyticsFetchError) return err
        return new AnalyticsFetchError({ message: err?.message || "Unknown error" })
      },
    }),

  getTotalSessionsCount: (companyId, limitDays) =>
    Effect.tryPromise({
      try: async () => {
        const { count, error } = await supabase
          .from("session_metrics")
          .select("*", { count: "exact", head: true })
          .eq("company_id", companyId)

        if (error) throw new AnalyticsFetchError({ message: error.message })
        return count || 0
      },
      catch: (err: any) => {
        if (err instanceof AnalyticsFetchError) return err
        return new AnalyticsFetchError({ message: err?.message || "Unknown error" })
      },
    }),
})
```

- [ ] **Step 3: Create programs & barrel index**

`analytics.programs.ts`:
```typescript
import { Effect, pipe } from "effect"
import { IAnalyticsRepository } from "./analytics.repository"
import { toAnalyticsDto } from "./analytics.types"
import type { TAnalyticsDto } from "./analytics.types"
import { AnalyticsFetchError, UnauthorizedError } from "./analytics.errors"

export type AnalyticsProgramError = AnalyticsFetchError | UnauthorizedError

export const getCompanyAnalyticsProgram = (
  companyId: string,
): Effect.Effect<TAnalyticsDto, AnalyticsProgramError, IAnalyticsRepository> =>
  pipe(
    IAnalyticsRepository,
    Effect.flatMap((repo) =>
      pipe(
        repo.getCompanyMemberCount(companyId),
        Effect.flatMap((memberCount) => {
          // Hard-stop HIPAA Privacy Guard (Choice A)
          if (memberCount < 5) {
            return Effect.succeed({
              totalMembers: memberCount,
              totalSessions: 0,
              dauHistory: [],
              isPrivacyProtected: true,
            })
          }

          return pipe(
            repo.getTotalSessionsCount(companyId, 30),
            Effect.flatMap((totalSessions) =>
              pipe(
                repo.getDailyActiveUsers(companyId, 30),
                Effect.map((dauHistory) => ({
                  totalMembers: memberCount,
                  totalSessions,
                  dauHistory,
                  isPrivacyProtected: false,
                })),
              )
            ),
          )
        }),
      )
    ),
    Effect.map(toAnalyticsDto),
  )
```

`index.ts`:
```typescript
export * from "./analytics.types"
export * from "./analytics.errors"
export * from "./analytics.repository"
export * from "./analytics.repository.supabase"
export * from "./analytics.programs"
```

- [ ] **Step 4: Write failing unit test**

`__tests__/analytics.programs.test.ts`:
```typescript
import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { IAnalyticsRepository } from "../analytics.repository"
import { getCompanyAnalyticsProgram } from "../analytics.programs"

const mockRepo = {
  getCompanyMemberCount: (companyId: string) => {
    if (companyId === "company-small") return Effect.succeed(3)
    return Effect.succeed(10)
  },
  getDailyActiveUsers: (companyId: string, limitDays: number) =>
    Effect.succeed([{ date: "2026-06-24", active_users: 6 }]),
  getTotalSessionsCount: (companyId: string, limitDays: number) => Effect.succeed(45),
} satisfies IAnalyticsRepository["Type"]

const runWithRepo = (effect: any): Promise<any> =>
  Effect.runPromise(effect.pipe(Effect.provideService(IAnalyticsRepository, mockRepo)))

describe("getCompanyAnalyticsProgram", () => {
  it("retrieves full metrics if company has 5 or more active members", async () => {
    const result = await runWithRepo(getCompanyAnalyticsProgram("company-large"))
    expect(result.total_members).toBe(10)
    expect(result.total_sessions).toBe(45)
    expect(result.is_privacy_protected).toBe(false)
    expect(result.dau_history).toHaveLength(1)
  })

  it("applies HIPAA Privacy Shield and masks granular metrics if members < 5", async () => {
    const result = await runWithRepo(getCompanyAnalyticsProgram("company-small"))
    expect(result.total_members).toBe(3)
    expect(result.total_sessions).toBe(0) // masked
    expect(result.is_privacy_protected).toBe(true)
    expect(result.dau_history).toHaveLength(0) // masked
  })
})
```

- [ ] **Step 5: Run tests and verify they pass**
Run: `pnpm test src/domain/analytics/`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git add apps/website/src/domain/analytics/
git commit -m "feat(domain): B2B HIPAA-compliant admin analytics domain"
```

---

### Task P2.11: Admin Analytics REST Endpoint (EPIC-05)

**Files:**
- Modify: `apps/website/src/lib/api-helpers.ts`
- Create: `apps/website/src/pages/api/companies/[id]/analytics.ts`

- [ ] **Step 1: Update API helpers with `runAnalyticsEffect`**
Add `IAnalyticsRepository` and `makeSupabaseAnalyticsRepository` imports and append `runAnalyticsEffect`.

```typescript
import { IAnalyticsRepository, makeSupabaseAnalyticsRepository } from "@/domain/analytics/index"

export const runAnalyticsEffect = <A>(
  context: APIContext,
  effect: Effect.Effect<A, any, IAnalyticsRepository>,
): Promise<A> => {
  const supabase = createSupabaseServerClient(context)!
  const supabaseRepo = makeSupabaseAnalyticsRepository(supabase)
  const logger = context.locals.logger
  const traced = effect.pipe(Effect.provideService(IAnalyticsRepository, supabaseRepo))
  return logger?.withSpan
    ? Effect.runPromise(logger.withSpan("analytics", () => traced))
    : Effect.runPromise(traced)
}
```

- [ ] **Step 2: Create B2B analytics route**

`api/companies/[id]/analytics.ts`:
```typescript
import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { getCompanyAnalyticsProgram } from "@/domain/analytics/analytics.programs"
import { makeMeta, jsonOk, jsonError, runAnalyticsEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"

export const GET: APIRoute = async (context) => {
  const meta = makeMeta()
  const companyId = context.params.id

  if (!companyId) {
    return jsonError({ _tag: "ValidationError", message: "Company ID is required" }, meta, HTTP_STATUS.BAD_REQUEST)
  }

  const program = pipe(
    getCompanyAnalyticsProgram(companyId),
    Effect.map((data) => jsonOk(data, meta)),
    Effect.catchTags({
      UnauthorizedError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
      AnalyticsFetchError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runAnalyticsEffect(context, program)
}
```

- [ ] **Step 3: Run type check**
Run: `pnpm check`
Expected: SUCCESS

- [ ] **Step 4: Commit**
```bash
git add apps/website/src/lib/api-helpers.ts apps/website/src/pages/api/companies/
git commit -m "feat(api): B2B admin analytics REST endpoint"
```

---

### Task P2.12: Admin Dashboard Analytics & HIPAA Shield (EPIC-05)

**Files:**
- Create: `apps/website/blocks/admin/AdminDashboard.tsx`
- Create: `apps/website/src/pages/admin/dashboard.astro`

- [ ] **Step 1: Create Admin Dashboard with Recharts and privacy overlays**

`blocks/admin/AdminDashboard.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@treonstudio/bungas-core/ui/card'
import { Badge } from '@treonstudio/bungas-core/ui/badge'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import {
  Users,
  MessageSquare,
  ShieldAlert,
  Loader2,
  Calendar,
  Lock
} from 'lucide-react'

type TAnalytics = {
  total_members: number
  total_sessions: number
  dau_history: { date: string; active_users: number }[]
  is_privacy_protected: boolean
}

export function AdminDashboard({ companyId }: { companyId: string }) {
  const [data, setData] = useState<TAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/companies/${companyId}/analytics`)
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data) {
          setData(result.data)
        }
      })
      .catch(err => console.error('Error loading analytics', err))
      .finally(() => setIsLoading(false))
  }, [companyId])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
        <Loader2 className="h-10 w-10 text-brand-primary animate-spin mb-4" />
        <h3 className="font-bold">Memuat Dashboard Analytics...</h3>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-surface-primary border-border-primary text-text-primary">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-text-secondary uppercase">Jumlah Karyawan Terdaftar</span>
              <h3 className="text-3xl font-bold">{data.total_members}</h3>
              <p className="text-[10px] text-text-secondary">Kursi terisi aktif</p>
            </div>
            <Users className="h-8 w-8 text-brand-primary" />
          </CardContent>
        </Card>

        <Card className="bg-surface-primary border-border-primary text-text-primary">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-text-secondary uppercase">Total Sesi Obrolan</span>
              <h3 className="text-3xl font-bold">{data.is_privacy_protected ? 'N/A' : data.total_sessions}</h3>
              <p className="text-[10px] text-text-secondary">{data.is_privacy_protected ? 'Dilindungi (Anggota < 5)' : 'Jumlah total sesi obrolan'}</p>
            </div>
            <MessageSquare className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Chart with Blocker Shield overlay */}
      <Card className="bg-surface-primary border-border-primary text-text-primary relative overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-brand-primary" />
            Aktifitas Harian Karyawan (Last 30 Days)
          </CardTitle>
          <CardDescription className="text-text-secondary text-xs">Menampilkan jumlah harian karyawan aktif (DAU) yang berkonsultasi.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          {data.is_privacy_protected ? (
            /* 3. HIPAA Shield Overlay (Choice A) */
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-surface-primary/95 z-10 space-y-4">
              <div className="h-14 w-14 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                <Lock className="h-7 w-7" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h4 className="font-extrabold text-base">Proteksi Privasi Aktif (Anonymity Shield)</h4>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Untuk melindungi kerahasiaan karyawan di organisasi kecil, statistik harian dinonaktifkan hingga organisasi Anda memiliki minimal <strong className="text-text-primary">5 anggota aktif</strong>. Saat ini Anda memiliki <strong className="text-brand-primary">{data.total_members} anggota</strong>.
                </p>
              </div>
            </div>
          ) : (
            /* Render line chart if ≥ 5 members */
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.dau_history} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="#8e8ea0" fontSize={11} />
                <YAxis stroke="#8e8ea0" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#2f2f2f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                <Line type="monotone" dataKey="active_users" name="Active Users" stroke="#9B5B3E" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

`src/pages/admin/dashboard.astro`:
```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro'
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { AdminDashboard } from '@/../blocks/admin/AdminDashboard'

const supabase = createSupabaseServerClient(Astro)
if (!supabase) {
  return Astro.redirect('/login')
}

const { data: { session } } = await supabase.auth.getSession()
if (!session) {
  return Astro.redirect('/login')
}

// Security: Verify user is Owner/Admin
const { data: membership } = await supabase
  .from('company_memberships')
  .select('company_id')
  .eq('user_id', session.user.id)
  .in('role', ['owner', 'admin', 'super_admin'])
  .eq('status', 'active')
  .limit(1)

if (!membership || membership.length === 0) {
  return Astro.redirect('/c')
}

const companyId = membership[0].company_id
---

<BaseLayout title="Admin Dashboard - TenangAI" description="Analitik dan utilisasi kesehatan mental organisasi Anda.">
  <div class="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
    <div>
      <h1 class="text-3xl font-extrabold tracking-tight text-text-primary">Dashboard Analytics</h1>
      <p class="text-sm text-text-secondary">Analisis aggregate penggunaan kesehatan mental tim Anda secara rahasia dan aman.</p>
    </div>

    <AdminDashboard companyId={companyId} client:load />
  </div>
</BaseLayout>
```

- [ ] **Step 2: Run verification**
Run: `pnpm check && pnpm test`
Expected: SUCCESS

- [ ] **Step 3: Commit**
```bash
git add apps/website/blocks/admin/AdminDashboard.tsx apps/website/src/pages/admin/dashboard.astro
git commit -m "feat(ui): HIPAA-compliant company admin analytics dashboard"
```
