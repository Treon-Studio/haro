# Journey C + E Drill-Down: Clinical Staff + Psychologist (TDD-Level Tasks)

> Maps to PRD §8.3 (Journey C) and §8.5 (Journey E). Covers: RISK-1 to RISK-20.

This appendix uses an abbreviated TDD format — full TDD tasks for the most critical paths, with references to spec sections for less critical ones. The full journey has 18 stages across 2 user roles; this file covers the high-stakes ones end-to-end and references shorter specs for the rest.

**Domain folders needed:**
- `apps/website/src/domain/risk/` (new)
- `apps/website/src/domain/escalation/` (new)
- `apps/website/src/domain/notifications/` (new)
- `apps/website/src/pages/risk-queue/`
- `apps/website/src/components/risk-queue/`

---

## D.1 — Domain: `risk_flags` (Stage 1 of Journey C)

### Task D.1.1 — Risk flag types + schemas + errors

**Files:**
- Create: `apps/website/src/domain/risk/risk.types.ts`
- Create: `apps/website/src/domain/risk/risk.schemas.ts`
- Create: `apps/website/src/domain/risk/risk.errors.ts`

**Spec — `risk.types.ts`:**

```typescript
import type { TCompanyId, TUserId } from "@/shared/types/common.types"

export type TRiskTier = "standard" | "critical"

export type TRiskFlag = {
  readonly id: string
  readonly userId: TUserId
  readonly companyId: TCompanyId
  readonly sessionId: string
  readonly tier: TRiskTier
  readonly aiSummary: string | null
  readonly triggerPattern: string | null
  readonly createdAt: string
}
```

**Spec — `risk.schemas.ts`:**

```typescript
import { Schema } from "@effect/schema"

const TRiskTierSchema = Schema.Union(Schema.Literal("standard"), Schema.Literal("critical"))

export const CreateRiskFlagSchema = Schema.Struct({
  userId: Schema.String.pipe(Schema.uuid()),
  companyId: Schema.String.pipe(Schema.uuid()),
  sessionId: Schema.String,
  tier: TRiskTierSchema,
  aiSummary: Schema.optional(Schema.String),
  triggerPattern: Schema.optional(Schema.String),
})
```

**Spec — `risk.errors.ts`:**

```typescript
import { Data } from "effect"

export class RiskFlagNotFoundError extends Data.TaggedError("RiskFlagNotFoundError")<{
  readonly message: string
}> {}

export class UnauthorizedWebhookError extends Data.TaggedError("UnauthorizedWebhookError")<{
  readonly message: string
}> {}
```

**Commit:** `feat(risk): types + schemas + errors`

### Task D.1.2 — Risk repository interface

**Files:**
- Create: `apps/website/src/domain/risk/risk.repository.ts`

**Spec:**

```typescript
import { Context, Effect } from "effect"
import type { TCompanyId, TUserId } from "@/shared/types/common.types"
import type { TRiskFlag, TRiskTier } from "./risk.types"
import { RiskFlagNotFoundError } from "./risk.errors"

export class IRiskRepository extends Context.Tag("IRiskRepository")<
  IRiskRepository,
  {
    readonly create: (input: {
      userId: TUserId
      companyId: TCompanyId
      sessionId: string
      tier: TRiskTier
      aiSummary: string | null
      triggerPattern: string | null
    }) => Effect.Effect<TRiskFlag>

    readonly listActive: (companyId: TCompanyId | null) => Effect.Effect<readonly TRiskFlag[]>

    readonly findById: (id: string) => Effect.Effect<TRiskFlag, RiskFlagNotFoundError>

    readonly listForUser: (userId: TUserId) => Effect.Effect<readonly TRiskFlag[]>
  }
>() {}
```

**Commit:** `feat(risk): repository interface`

### Task D.1.3 — `flagRiskProgram` (AI Engine webhook)

**Files:**
- Create: `apps/website/src/domain/risk/risk.programs.ts`
- Create: `apps/website/src/pages/api/webhooks/risk-flag.ts`

**Spec — `risk.programs.ts`:**

```typescript
import { Effect } from "effect"
import { Schema } from "@effect/schema"
import { CreateRiskFlagSchema } from "./risk.schemas"
import { IRiskRepository } from "./risk.repository"
import { IEscalationsRepository } from "@/domain/escalation/escalation.repository"
import { INotificationsRepository } from "@/domain/notifications/notifications.repository"
import { ValidationError } from "@/shared/errors/application.errors"
import type { TRiskFlag } from "./risk.types"

export const flagRiskProgram = (body: unknown): Effect.Effect<
  TRiskFlag,
  ValidationError,
  IRiskRepository | IEscalationsRepository | INotificationsRepository
> =>
  Effect.gen(function* () {
    const input = yield* Schema.decodeUnknown(CreateRiskFlagSchema)(body).pipe(
      Effect.mapError((e) => new ValidationError({ issues: [e.message] })),
    )

    // 1. Create risk flag
    const flag = yield* IRiskRepository.pipe(
      Effect.flatMap((r) => r.create({ ...input, aiSummary: input.aiSummary ?? null, triggerPattern: input.triggerPattern ?? null })),
    )

    // 2. If critical → auto-create case + page on-call
    if (input.tier === "critical") {
      yield* IEscalationsRepository.pipe(
        Effect.flatMap((e) => e.createCaseFromFlag(flag.id)),
      )
      yield* INotificationsRepository.pipe(
        Effect.flatMap((n) => n.pageOnCallClinicalStaff(flag.companyId, flag.id)),
      )
    }

    // 3. Always notify clinical staff (RISK-17)
    yield* INotificationsRepository.pipe(
      Effect.flatMap((n) => n.notifyClinicalStaffOfNewFlag(flag)),
    )

    return flag
  })
```

**Spec — `apps/website/src/pages/api/webhooks/risk-flag.ts`:**

```typescript
import type { APIContext } from "astro"
import { IRiskRepository, makeSupabaseRiskRepository } from "@/domain/risk/risk.repository.supabase"
import { IEscalationsRepository, makeSupabaseEscalationsRepository } from "@/domain/escalation/escalation.repository.supabase"
import { INotificationsRepository, makeSupabaseNotificationsRepository } from "@/domain/notifications/notifications.repository.supabase"
import { createSupabaseServiceClient } from "@/lib/supabase/service"
import { flagRiskProgram } from "@/domain/risk/risk.programs"
import { jsonOk, jsonError, makeMeta } from "@/lib/api-helpers"
import { Effect } from "effect"
import { createHmac, timingSafeEqual } from "node:crypto"

const AI_ENGINE_WEBHOOK_SECRET = import.meta.env.AI_ENGINE_WEBHOOK_SECRET ?? "dev-ai-engine-secret"

const verifyWebhookSignature = (signature: string | null, body: string): boolean => {
  if (!signature) return false
  const expected = createHmac("sha256", AI_ENGINE_WEBHOOK_SECRET).update(body).digest("hex")
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

export const POST = async (context: APIContext) => {
  const rawBody = await context.request.text()
  const signature = context.request.headers.get("x-ai-engine-signature")

  if (!verifyWebhookSignature(signature, rawBody)) {
    return jsonError({ _tag: "UnauthorizedWebhookError", message: "Invalid signature" }, makeMeta(), 401)
  }

  const body = JSON.parse(rawBody)
  const supabase = createSupabaseServiceClient()

  const riskRepo = makeSupabaseRiskRepository(supabase)
  const escRepo = makeSupabaseEscalationsRepository(supabase)
  const notifRepo = makeSupabaseNotificationsRepository(supabase)

  try {
    const flag = await Effect.runPromise(
      flagRiskProgram(body).pipe(
        Effect.provideService(IRiskRepository, riskRepo),
        Effect.provideService(IEscalationsRepository, escRepo),
        Effect.provideService(INotificationsRepository, notifRepo),
      ),
    )
    return jsonOk(flag, makeMeta())
  } catch (e: any) {
    return jsonError({ _tag: e._tag ?? "Error", message: e.message ?? String(e) }, makeMeta(), 400)
  }
}
```

**Test cases — see A.3 Stage 1:**
- [ ] Standard flag → notification sent
- [ ] Critical flag → case auto-created + on-call paged
- [ ] Multiple flags at once → aggregate notification
- [ ] No clinical staff on duty → on-call page, never "help coming"
- [ ] Webhook signature verified

**Commit:** `feat(risk): flagRiskProgram + webhook endpoint for AI Engine`

---

## D.2 — Risk Queue UI (Stage 2-3 of Journey C)

### Task D.2.1 — Risk queue page

**Files:**
- Create: `apps/website/src/pages/risk-queue/index.astro`
- Create: `apps/website/src/components/risk-queue/RiskQueueTable.tsx`
- Create: `apps/website/src/components/risk-queue/TierTabs.tsx`
- Create: `apps/website/src/pages/api/risk-queue/cases.ts`

**Spec — `RiskQueueTable.tsx`:**

```typescript
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@treonstudio/bungas-core/ui/table"
import { Badge } from "@treonstudio/bungas-core/ui/badge"
import { Button } from "@treonstudio/bungas-core/ui/button"

type TCase = {
  readonly id: string
  readonly riskFlagId: string
  readonly tier: "standard" | "critical"
  readonly aiSummary: string
  readonly companyName: string
  readonly ageMinutes: number
  readonly status: "open" | "assigned" | "in_followup" | "re_escalated"
  readonly primaryAssignee: string | null
}

type RiskQueueTableProps = {
  readonly cases: readonly TCase[]
}

export const RiskQueueTable = ({ cases }: RiskQueueTableProps) => (
  <Table data-testid="risk-queue-table">
    <TableHeader>
      <TableRow>
        <TableHead>Tier</TableHead>
        <TableHead>AI summary</TableHead>
        <TableHead>Company</TableHead>
        <TableHead>Age</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Assignee</TableHead>
        <TableHead></TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {cases.length === 0 ? (
        <TableRow>
          <TableCell colSpan={7} className="text-center text-gray-500 py-8" data-testid="empty-state">
            No active cases — nice work
          </TableCell>
        </TableRow>
      ) : (
        cases.map((c) => (
          <TableRow
            key={c.id}
            data-testid={`case-row-${c.id}`}
            className={c.tier === "critical" ? "bg-red-50" : ""}
          >
            <TableCell>
              <Badge variant={c.tier === "critical" ? "destructive" : "default"} data-testid={`tier-${c.id}`}>
                {c.tier}
              </Badge>
            </TableCell>
            <TableCell className="max-w-md truncate">{c.aiSummary}</TableCell>
            <TableCell>{c.companyName}</TableCell>
            <TableCell>{c.ageMinutes}m</TableCell>
            <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
            <TableCell>{c.primaryAssignee ?? "Unassigned"}</TableCell>
            <TableCell>
              <Button size="sm" asChild>
                <a href={`/risk-queue/${c.id}`} data-testid={`open-case-${c.id}`}>Open</a>
              </Button>
            </TableCell>
          </TableRow>
        ))
      )}
    </TableBody>
  </Table>
)
```

**Spec — `TierTabs.tsx`:**

```typescript
type TierTabsProps = {
  readonly activeTab: "critical" | "standard"
  readonly onChange: (tab: "critical" | "standard") => void
  readonly criticalCount: number
  readonly standardCount: number
}

export const TierTabs = ({ activeTab, onChange, criticalCount, standardCount }: TierTabsProps) => (
  <div data-testid="tier-tabs" className="flex border-b mb-4">
    <button
      data-testid="tab-critical"
      onClick={() => onChange("critical")}
      className={`px-4 py-2 ${activeTab === "critical" ? "border-b-2 border-red-500 font-semibold" : "text-gray-500"}`}
    >
      Critical <Badge variant="destructive" className="ml-1">{criticalCount}</Badge>
    </button>
    <button
      data-testid="tab-standard"
      onClick={() => onChange("standard")}
      className={`px-4 py-2 ${activeTab === "standard" ? "border-b-2 border-blue-500 font-semibold" : "text-gray-500"}`}
    >
      Standard <Badge className="ml-1">{standardCount}</Badge>
    </button>
  </div>
)
```

**Acceptance criteria — see A.3 Stage 2:**
- [ ] Two tabs: Critical (default), Standard
- [ ] Empty state when no cases
- [ ] Pagination for > 20 cases
- [ ] Critical cases visually emphasized
- [ ] Optimistic lock (RISK-13) prevents two staff opening same case

**Commit:** `feat(risk-queue): queue page with tier tabs and case table`

### Task D.2.2 — Case detail page (Stage 3, 3b, 7, 8)

**Files:**
- Create: `apps/website/src/pages/risk-queue/[id].astro`
- Create: `apps/website/src/components/risk-queue/CaseDetail.tsx`
- Create: `apps/website/src/components/risk-queue/AssignDialog.tsx`
- Create: `apps/website/src/components/risk-queue/DismissDialog.tsx`
- Create: `apps/website/src/components/risk-queue/EmergencyEscalationDialog.tsx`
- Create: `apps/website/src/components/risk-queue/ResolutionDialog.tsx`

**Spec — `CaseDetail.tsx`:**

```typescript
import { Card } from "@treonstudio/bungas-core/ui/card"
import { Button } from "@treonstudio/bungas-core/ui/button"
import { Badge } from "@treonstudio/bungas-core/ui/badge"

type CaseDetailProps = {
  readonly case_: TCase
  readonly canResolve: boolean  // true if user has senior clinical staff role
  readonly currentUserId: string
  readonly onAssign: () => void
  readonly onDismiss: () => void
  readonly onEmergency: () => void
  readonly onResolve: () => void
}

export const CaseDetail = ({ case_, canResolve, onAssign, onDismiss, onEmergency, onResolve }: CaseDetailProps) => {
  const canEscalateToEmergency = case_.tier === "critical" && !case_.resolvedAt

  return (
    <div data-testid="case-detail" className="space-y-4 max-w-4xl">
      <Card>
        <h2 className="font-semibold mb-2">AI summary</h2>
        <p data-testid="ai-summary" className="text-gray-700">{case_.aiSummary}</p>
      </Card>

      <Card>
        <h2 className="font-semibold mb-2">Session transcript</h2>
        <details>
          <summary className="cursor-pointer">View full transcript (anonymized)</summary>
          <pre className="text-xs mt-2 p-2 bg-gray-50 overflow-x-auto">{case_.transcript ?? "Not available"}</pre>
        </details>
      </Card>

      <Card>
        <h2 className="font-semibold mb-2">Actions</h2>
        <div className="flex flex-col gap-2">
          <Button data-testid="assign-psychologist" onClick={onAssign}>
            Assign to psychologist
          </Button>
          <Button variant="destructive" data-testid="dismiss" onClick={onDismiss}>
            Dismiss (false positive)
          </Button>
          {canEscalateToEmergency && (
            <Button variant="destructive" data-testid="escalate-emergency" onClick={onEmergency}>
              Escalate to emergency services
            </Button>
          )}
          {canResolve && (
            <Button data-testid="mark-resolved" onClick={onResolve}>
              Mark resolved
            </Button>
          )}
          {!canResolve && (
            <p className="text-xs text-gray-500">Marking resolved requires senior clinical staff role</p>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold mb-2">Follow-up attempts</h2>
        {/* ... render follow-up log ... */}
      </Card>
    </div>
  )
}
```

**Spec — `EmergencyEscalationDialog.tsx` (RISK-12):**

```typescript
import { useState } from "react"
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@treonstudio/bungas-core/ui/dialog"
import { Button } from "@treonstudio/bungas-core/ui/button"

const EMERGENCY_CHECKLIST = [
  { id: "location", label: "Confirm employee location if known" },
  { id: "call_119", label: "Call 119 emergency services" },
  { id: "log_call", label: "Log call time + outcome" },
  { id: "notify_senior", label: "Notify senior clinical staff" },
  { id: "document", label: "Document all actions in case record" },
] as const

type EmergencyEscalationDialogProps = {
  readonly open: boolean
  readonly onComplete: () => void
  readonly onCancel: () => void
}

export const EmergencyEscalationDialog = ({ open, onComplete, onCancel }: EmergencyEscalationDialogProps) => {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const allChecked = checked.size === EMERGENCY_CHECKLIST.length

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent data-testid="emergency-escalation-dialog">
        <DialogTitle>Escalate to emergency services</DialogTitle>
        <DialogDescription>
          This will activate the 119 emergency services protocol. All steps must be completed.
        </DialogDescription>
        <div className="space-y-2 my-4">
          {EMERGENCY_CHECKLIST.map((step) => (
            <label key={step.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                data-testid={`checklist-${step.id}`}
                onChange={(e) => {
                  const next = new Set(checked)
                  if (e.target.checked) next.add(step.id)
                  else next.delete(step.id)
                  setChecked(next)
                }}
              />
              {step.label}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} data-testid="emergency-cancel">Cancel</Button>
          <Button
            variant="destructive"
            disabled={!allChecked}
            data-testid="confirm-emergency"
            onClick={onComplete}
          >
            Confirm emergency escalation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Test cases — see A.3 Stage 3, 7, 8:**
- [ ] AI summary shown
- [ ] Full anonymized transcript available
- [ ] Assign psychologist dialog works
- [ ] Dismiss requires reason code (RISK-4)
- [ ] Critical tier can escalate to emergency
- [ ] Emergency checklist must be 100% complete
- [ ] Mark resolved disabled for non-senior staff (RISK-20)
- [ ] Resolution requires reason + free text

**Commit:** `feat(risk-queue): case detail with assign/dismiss/emergency/resolution actions`

### Task D.2.3 — Optimistic case lock (RISK-13)

**Files:**
- Create: `apps/website/src/domain/escalation/escalation.lock.ts`
- Create: `apps/website/src/pages/api/risk-queue/cases/[id]/claim.ts`
- Migration: add `locked_by`, `lock_expires_at` to `escalation_cases`

**Migration:**

```sql
-- apps/website/supabase/migrations/20260625000020_add_case_lock.sql
alter table public.escalation_cases add column if not exists locked_by uuid references auth.users(id);
alter table public.escalation_cases add column if not exists lock_expires_at timestamptz;
```

**Spec — `escalation.lock.ts`:**

```typescript
import { Effect } from "effect"
import { Data } from "effect"
import { IEscalationsRepository } from "./escalation.repository"

export class CaseLockedError extends Data.TaggedError("CaseLockedError")<{
  readonly message: string
  readonly lockedBy: string
  readonly expiresAt: string
}> {}

export class CaseNotFoundError extends Data.TaggedError("CaseNotFoundError")<{
  readonly message: string
}> {}

const LOCK_DURATION_MS = 10 * 60 * 1000  // 10 min

export const claimCaseProgram = (caseId: string, userId: string): Effect.Effect<
  { readonly lockExpiresAt: string },
  CaseLockedError | CaseNotFoundError,
  IEscalationsRepository
> =>
  Effect.gen(function* () {
    const case_ = yield* IEscalationsRepository.pipe(Effect.flatMap((r) => r.findById(caseId)))

    if (case_.lockedBy && case_.lockedBy !== userId && new Date(case_.lockExpiresAt ?? 0) > new Date()) {
      return yield* Effect.fail(
        new CaseLockedError({
          message: "Case is locked by another staff member",
          lockedBy: case_.lockedBy,
          expiresAt: case_.lockExpiresAt!,
        }),
      )
    }

    const lockExpiresAt = new Date(Date.now() + LOCK_DURATION_MS).toISOString()
    yield* IEscalationsRepository.pipe(Effect.flatMap((r) => r.setLock(caseId, userId, lockExpiresAt)))

    return { lockExpiresAt }
  })
```

**Test cases — see A.3 Stage 2.5:**
- [ ] Two staff open same case → second sees read-only + "claimed by X"
- [ ] Lock auto-releases after 10 min
- [ ] Lock can be re-claimed after expiry

**Commit:** `feat(escalation): optimistic case lock with 10-min auto-release (RISK-13)`

### Task D.2.4 — Assign + Dismiss + Resolve programs

**Files:**
- Create: `apps/website/src/domain/escalation/escalation.programs.ts`
- Test: `apps/website/src/domain/escalation/__tests__/escalation.programs.test.ts`

**Spec — key programs (full implementation in actual file):**

```typescript
// assignCaseProgram (RISK-18)
export const assignCaseProgram = (input: {
  caseId: string
  primaryAssignee: string
  backupAssignee: string
  actorId: string
}): Effect.Effect<...> => ...

// dismissFlagProgram (RISK-4)
export const dismissFlagProgram = (input: {
  flagId: string
  reasonCode: string
  reasonText?: string
  actorId: string
}): Effect.Effect<...> => ...

// markResolvedProgram (RISK-20) — requires senior role
export const markResolvedProgram = (input: {
  caseId: string
  outcome: 'reached' | 'unreachable' | 'referred' | 'emergency' | 'no_action'
  reason: string
  actorId: string  // must have senior clinical staff role
}): Effect.Effect<...> => ...

// escalateToEmergencyProgram (RISK-12) — requires checklist completion
export const escalateToEmergencyProgram = (input: {
  caseId: string
  checklistData: { locationConfirmed: boolean; call119Made: boolean; callTime: string; outcome: string }
  actorId: string
}): Effect.Effect<...> => ...
```

**Test cases — see A.3 Stage 3b, 7, 8:**
- [ ] Dismiss with reason → logged, dismissal reason required
- [ ] Critical flag dismiss blocked (non-senior cannot)
- [ ] Resolution by non-senior → blocked
- [ ] Resolution by senior → succeeds, employee gets in-app message
- [ ] Emergency escalation requires all 5 checklist items

**Commit:** `feat(escalation): assign/dismiss/resolve/emergency-escalate programs`

---

## D.3 — Case Resolved Notification (RISK-16)

### Task D.3.1 — Employee case-closed message

**Files:**
- Create: `apps/website/src/components/chat/CaseClosedBanner.tsx`
- Modify: `apps/website/blocks/chat/components/Header.tsx`

**Spec — `CaseClosedBanner.tsx`:**

```typescript
export const CaseClosedBanner = ({ onDismiss }: { onDismiss: () => void }) => (
  <div data-testid="case-closed-banner" className="bg-blue-50 border-l-4 border-blue-500 p-3">
    <p className="text-sm text-blue-900">
      Your recent conversation has been reviewed and closed. We're here whenever you want to talk again.
    </p>
    <button onClick={onDismiss} className="text-xs text-blue-700 mt-1">Dismiss</button>
  </div>
)
```

**Integration in markResolvedProgram:**

```typescript
// In markResolvedProgram, after marking resolved:
yield* INotificationsRepository.pipe(
  Effect.flatMap((n) => n.notifyEmployeeOfCaseResolution(input.caseId)),
)
```

**Commit:** `feat(escalation): employee case-closed in-app message (RISK-16)`

---

## D.4 — Journey C + E E2E Test Suites

### Task D.4.1 — Playwright tests for Journey C

**Files:**
- Create: `apps/website/tests/e2e/journey-c-clinical-staff.spec.ts`

**Spec — 9 scenarios from A.7:**

```typescript
import { test, expect } from "@playwright/test"

test.describe("Journey C: Clinical Staff", () => {
  test("happy path: notification → triage → assign → follow-up → resolve", async ({ page }) => { /* ... */ })
  test("dismiss false positive: dismiss with reason → logged", async ({ page }) => { /* ... */ })
  test("backup assignee: primary no ack 15min → backup notified", async ({ page }) => { /* ... */ })
  test("shift handover: open cases at end of shift → handover notes required", async ({ page }) => { /* ... */ })
  test("pattern detection: 2+ in 7d same company → pattern alert", async ({ page }) => { /* ... */ })
  test("re-escalation: post-follow-up, worse → RISK-12", async ({ page }) => { /* ... */ })
  test("resolution by non-senior: block", async ({ page }) => { /* ... */ })
  test("resolution by senior: case closed + employee notified", async ({ page }) => { /* ... */ })
  test("deactivation blocked: open cases → block", async ({ page }) => { /* ... */ })
})
```

### Task D.4.2 — Playwright tests for Journey E

**Files:**
- Create: `apps/website/tests/e2e/journey-e-psychologist.spec.ts`

**Spec — 8 scenarios from A.7:**

```typescript
test.describe("Journey E: Psychologist", () => {
  test("happy path: assigned → review → contact → log → outcome → senior resolves", async ({ page }) => { /* ... */ })
  test("employee unreachable: 3 attempts / 48h → auto-escalate", async ({ page }) => { /* ... */ })
  test("re-escalation to emergency: RISK-12 checklist", async ({ page }) => { /* ... */ })
  test("conflict of interest: declare + recuse", async ({ page }) => { /* ... */ })
  test("wrong number: log + escalate", async ({ page }) => { /* ... */ })
  test("employee refuses contact: log + no further attempts", async ({ page }) => { /* ... */ })
  test("assignment outside shift: notification queued", async ({ page }) => { /* ... */ })
  test.skip("skill assignment (Phase 2): SKL-6 pins skill", async ({ page }) => { /* ... */ })
})
```

**Run:** `pnpm playwright test journey-c-clinical-staff journey-e-psychologist`
**Expected:** 16 of 17 PASS (1 skipped for Phase 2)

**Commit:** `test(e2e): Journey C + E comprehensive test suites (17 scenarios)`

---

## D.5 — Journey C + E Acceptance Criteria Summary

| PRD Story | Implementation | Test |
|---|---|---|
| RISK-1 | D.2.1 | C + E happy path |
| RISK-2 | D.1.3 | Unit |
| RISK-3 | (privacy boundary, enforced in RLS) | Unit |
| RISK-4 | D.2.4 dismiss | Journey C dismiss |
| RISK-5 | (D.1.3 SLA timer) | Unit |
| RISK-6 | D.2.1 (tier tabs) | Journey C happy path |
| RISK-7 | (admin view) | Unit |
| RISK-8 | D.2.2 (AI summary) | Journey C happy path |
| RISK-9 | (Phase 2 outcome tracking) | Phase 2 |
| RISK-10 | D.1.x (backup assignee) | Journey C backup |
| RISK-11 | (D.2.1 pattern alert) | Journey C pattern |
| RISK-12 | D.2.2 + D.2.4 (emergency) | Journey C + E re-escalation |
| RISK-13 | D.2.3 (lock) | Unit |
| RISK-14 | (B.6.6 deactivation guard) | Unit |
| RISK-15 | (B.4.3 crisis card) | Journey A |
| RISK-16 | D.3.1 (case-closed banner) | Journey C resolution |
| RISK-17 | D.1.3 (notification) | Journey C happy path |
| RISK-18 | D.2.4 (assign) | Journey E happy path |
| RISK-19 | (escalation on unreachable) | Journey E unreachable |
| RISK-20 | D.2.4 (senior-only resolve) | Journey C resolution |

**Journeys C + E "shipped" when:** All D.x tasks committed, all unit tests pass, all D.4 E2E pass, manual smoke: triage → assign → follow-up → resolve flow works end-to-end.
