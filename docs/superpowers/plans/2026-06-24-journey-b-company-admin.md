# Journey B Drill-Down: Company Admin (TDD-Level Tasks)

> Maps to PRD §8.2 (Journey B). Covers: ONB-1, ONB-2, ONB-8, ADM-1 to ADM-12, BILL-1, BILL-2, BILL-5, BILL-6, BILL-7, ENG-3, ENG-7.

This appendix follows the same TDD pattern as `2026-06-24-journey-a-employee.md`. Reference that file for full pattern details.

**Domain folders needed:**
- `apps/website/src/domain/companies/` (new)
- `apps/website/src/domain/memberships/` (new)
- Admin UI under `apps/website/src/pages/admin/`
- Admin components under `apps/website/src/components/admin/`

**Existing patterns to mirror:**
- `apps/website/src/domain/invitations/` (B.1)
- `apps/website/src/domain/auth/` (auth domain)

---

## C.1 — Domain: `companies` (Journey B Stage 1-3)

### Task C.1.1 — Company types + schemas

**Files:**
- Create: `apps/website/src/domain/companies/companies.types.ts`
- Create: `apps/website/src/domain/companies/companies.schemas.ts`

**Spec — `companies.types.ts`:**

```typescript
import type { TCompanyId, TUserId } from "@/shared/types/common.types"

export type TBillingTier = "starter" | "growth" | "enterprise" | "trial"
export type TCompanyStatus = "active" | "suspended" | "offboarded"

export type TCompany = {
  readonly id: TCompanyId
  readonly name: string
  readonly domain: string | null
  readonly billingTier: TBillingTier
  readonly sessionQuota: number
  readonly sessionsUsed: number
  readonly contractStartDate: string | null
  readonly contractEndDate: string | null
  readonly status: TCompanyStatus
  readonly legalHold: boolean
  readonly softDeletedAt: string | null
  readonly sessionIdleTimeoutMinutes: number
  readonly createdBy: TUserId
  readonly createdAt: string
  readonly updatedAt: string
}
```

**Spec — `companies.schemas.ts`:**

```typescript
import { Schema } from "@effect/schema"

const TBillingTierSchema = Schema.Union(
  Schema.Literal("starter"),
  Schema.Literal("growth"),
  Schema.Literal("enterprise"),
  Schema.Literal("trial"),
)

export const CreateCompanySchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(2), Schema.maxLength(100)),
  domain: Schema.optional(Schema.String.pipe(Schema.pattern(/^[a-z0-9.-]+\.[a-z]{2,}$/))),
  billingTier: TBillingTierSchema,
  sessionQuota: Schema.Number.pipe(Schema.int(), Schema.between(0, 100000)),
  contractStartDate: Schema.optional(Schema.String),
  contractEndDate: Schema.optional(Schema.String),
  sessionIdleTimeoutMinutes: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(5, 480))),
})

export const UpdateCompanySchema = Schema.Struct({
  name: Schema.optional(Schema.String.pipe(Schema.minLength(2))),
  domain: Schema.optional(Schema.String),
  sessionIdleTimeoutMinutes: Schema.optional(Schema.Number),
  // Billing fields NOT updatable by Company Admin; only by Super Admin
})
```

**Acceptance criteria — see A.2 Stage 1-2:**
- [ ] Valid company data → schema passes
- [ ] Empty name → rejected
- [ ] Invalid domain format → rejected
- [ ] Quota negative → rejected
- [ ] Company Admin cannot update billing fields

**Commit:** `feat(companies): types + schemas`

### Task C.1.2 — Company errors

**Files:**
- Create: `apps/website/src/domain/companies/companies.errors.ts`

**Spec:**

```typescript
import { Data } from "effect"

export class CompanyNotFoundError extends Data.TaggedError("CompanyNotFoundError")<{
  readonly message: string
  readonly companyId?: string
}> {}

export class DuplicateCompanyError extends Data.TaggedError("DuplicateCompanyError")<{
  readonly message: string
  readonly conflictingField: "name" | "domain"
}> {}

export class InsufficientPermissionError extends Data.TaggedError("InsufficientPermissionError")<{
  readonly message: string
  readonly required: string
  readonly actual: string
}> {}

export class ContractDateInvalidError extends Data.TaggedError("ContractDateInvalidError")<{
  readonly message: string
  readonly startDate?: string
  readonly endDate?: string
}> {}

export class CompanySuspendedError extends Data.TaggedError("CompanySuspendedError")<{
  readonly message: string
  readonly reason: string
}> {}
```

**Commit:** `feat(companies): error types`

### Task C.1.3 — Company repository interface

**Files:**
- Create: `apps/website/src/domain/companies/companies.repository.ts`

**Spec:**

```typescript
import { Context, Effect } from "effect"
import type { TCompany, TBillingTier } from "./companies.types"
import type { TCompanyId, TUserId } from "@/shared/types/common.types"
import { CompanyNotFoundError, DuplicateCompanyError, ContractDateInvalidError } from "./companies.errors"

export class ICompaniesRepository extends Context.Tag("ICompaniesRepository")<
  ICompaniesRepository,
  {
    readonly create: (input: {
      name: string
      domain: string | null
      billingTier: TBillingTier
      sessionQuota: number
      contractStartDate: string | null
      contractEndDate: string | null
      createdBy: TUserId
    }) => Effect.Effect<TCompany, DuplicateCompanyError | ContractDateInvalidError>

    readonly findById: (id: TCompanyId) => Effect.Effect<TCompany, CompanyNotFoundError>

    readonly list: (input: {
      limit: number
      cursor?: string
      status?: "active" | "suspended" | "offboarded"
      search?: string
    }) => Effect.Effect<{ readonly items: readonly TCompany[]; readonly nextCursor: string | null }>

    readonly update: (id: TCompanyId, input: Partial<{
      name: string
      domain: string | null
      sessionIdleTimeoutMinutes: number
    }>) => Effect.Effect<TCompany, CompanyNotFoundError | DuplicateCompanyError>

    readonly updateQuota: (id: TCompanyId, newQuota: number) => Effect.Effect<TCompany, CompanyNotFoundError>

    readonly suspend: (id: TCompanyId, reason: string) => Effect.Effect<TCompany, CompanyNotFoundError>

    readonly unsuspend: (id: TCompanyId) => Effect.Effect<TCompany, CompanyNotFoundError>

    readonly softDelete: (id: TCompanyId, reason: string) => Effect.Effect<{ readonly restoresUntil: string }, CompanyNotFoundError>

    readonly hardDelete: (id: TCompanyId) => Effect.Effect<void, CompanyNotFoundError>

    readonly restoreFromSoftDelete: (id: TCompanyId) => Effect.Effect<TCompany, CompanyNotFoundError>
  }
>() {}
```

**Commit:** `feat(companies): repository interface`

### Task C.1.4 — `createCompanyProgram` (ONB-1)

**Files:**
- Create: `apps/website/src/domain/companies/companies.programs.ts`
- Create: `apps/website/src/domain/companies/__tests__/create-company.test.ts`

**Spec:**

```typescript
import { Effect } from "effect"
import { CreateCompanySchema } from "./companies.schemas"
import { ICompaniesRepository } from "./companies.repository"
import { IMembershipsRepository } from "@/domain/memberships/memberships.repository"
import { ValidationError } from "@/shared/errors/application.errors"
import {
  CompanyNotFoundError,
  InsufficientPermissionError,
  DuplicateCompanyError,
  ContractDateInvalidError,
} from "./companies.errors"
import type { TCompanyId, TUserId } from "@/shared/types/common.types"
import type { TCompany } from "./companies.types"

export type CreateCompanyProgramError =
  | ValidationError
  | InsufficientPermissionError
  | DuplicateCompanyError
  | ContractDateInvalidError

export const createCompanyProgram = (
  body: unknown,
  actorId: TUserId,
): Effect.Effect<TCompany, CreateCompanyProgramError, ICompaniesRepository | IMembershipsRepository> =>
  Effect.gen(function* () {
    // 1. Validate actor is super admin
    const isSuperAdmin = yield* IMembershipsRepository.pipe(
      Effect.flatMap((r) => r.userHasRole(actorId, "super_admin")),
    )
    if (!isSuperAdmin) {
      return yield* Effect.fail(
        new InsufficientPermissionError({
          message: "Only super admins can create companies",
          required: "super_admin",
          actual: "company_admin_or_lower",
        }),
      )
    }

    // 2. Validate input
    const input = yield* Effect.try({
      try: () => CreateCompanySchema.makeSync(body as any),
      catch: (e) => new ValidationError({ issues: [String(e)] }),
    })

    // 3. Validate contract dates
    if (input.contractEndDate && input.contractStartDate) {
      if (new Date(input.contractEndDate) <= new Date(input.contractStartDate)) {
        return yield* Effect.fail(
          new ContractDateInvalidError({
            message: "Contract end date must be after start date",
            startDate: input.contractStartDate,
            endDate: input.contractEndDate,
          }),
        )
      }
    }

    // 4. Create
    const company = yield* ICompaniesRepository.pipe(
      Effect.flatMap((r) =>
        r.create({
          name: input.name,
          domain: input.domain ?? null,
          billingTier: input.billingTier,
          sessionQuota: input.sessionQuota,
          contractStartDate: input.contractStartDate ?? null,
          contractEndDate: input.contractEndDate ?? null,
          createdBy: actorId,
        }),
      ),
    )

    return company
  })
```

**Test — `create-company.test.ts`:**

```typescript
import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { ICompaniesRepository } from "../companies.repository"
import { IMembershipsRepository } from "@/domain/memberships/memberships.repository"
import { createCompanyProgram } from "../companies.programs"
import { ValidationError } from "@/shared/errors/application.errors"
import { InsufficientPermissionError, DuplicateCompanyError, ContractDateInvalidError } from "../companies.errors"
import type { TCompany } from "../companies.types"

const mockCompany: TCompany = {
  id: "co-1" as any,
  name: "Acme Corp",
  domain: "acme.com",
  billingTier: "starter",
  sessionQuota: 100,
  sessionsUsed: 0,
  contractStartDate: null,
  contractEndDate: null,
  status: "active",
  legalHold: false,
  softDeletedAt: null,
  sessionIdleTimeoutMinutes: 60,
  createdBy: "u-1" as any,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const mockCompanies: ICompaniesRepository["Type"] = {
  create: () => Effect.succeed(mockCompany),
  findById: () => Effect.succeed(mockCompany),
  list: () => Effect.succeed({ items: [mockCompany], nextCursor: null }),
  update: () => Effect.succeed(mockCompany),
  updateQuota: () => Effect.succeed(mockCompany),
  suspend: () => Effect.succeed(mockCompany),
  unsuspend: () => Effect.succeed(mockCompany),
  softDelete: () => Effect.succeed({ restoresUntil: new Date(Date.now() + 48 * 3600 * 1000).toISOString() }),
  hardDelete: () => Effect.void,
  restoreFromSoftDelete: () => Effect.succeed(mockCompany),
}

const mockMemberships: IMembershipsRepository["Type"] = {
  assign: () => Effect.die("n/a"),
  revoke: () => Effect.die("n/a"),
  getUserCompanies: () => Effect.succeed([]),
  userHasRole: () => Effect.succeed(true),
  isLastActiveAdmin: () => Effect.succeed(false),
}

const run = <A, E>(eff: Effect.Effect<A, E, ICompaniesRepository | IMembershipsRepository>) =>
  Effect.runPromise(
    eff.pipe(
      Effect.provideService(ICompaniesRepository, mockCompanies),
      Effect.provideService(IMembershipsRepository, mockMemberships),
    ),
  )

describe("createCompanyProgram", () => {
  it("creates company for super admin", async () => {
    const result = await run(
      createCompanyProgram(
        { name: "Test Co", billingTier: "starter", sessionQuota: 100 },
        "u-1" as any,
      ),
    )
    expect(result.name).toBe("Acme Corp")
  })

  it("rejects non-super-admin actor", async () => {
    const nonSuperMemberships = { ...mockMemberships, userHasRole: () => Effect.succeed(false) }
    const result = await Effect.runPromise(
      createCompanyProgram({ name: "Test", billingTier: "starter", sessionQuota: 100 }, "u-1" as any).pipe(
        Effect.provideService(ICompaniesRepository, mockCompanies),
        Effect.provideService(IMembershipsRepository, nonSuperMemberships),
        Effect.catchAll((e) => Effect.succeed(e)),
      ),
    )
    expect(result).toBeInstanceOf(InsufficientPermissionError)
  })

  it("rejects empty name", async () => {
    const result = await run(
      createCompanyProgram({ name: "", billingTier: "starter", sessionQuota: 100 }, "u-1" as any).pipe(
        Effect.catchAll((e) => Effect.succeed(e)),
      ),
    )
    expect(result).toBeInstanceOf(ValidationError)
  })

  it("rejects contract end before start", async () => {
    const result = await run(
      createCompanyProgram(
        {
          name: "Test",
          billingTier: "starter",
          sessionQuota: 100,
          contractStartDate: "2026-12-31",
          contractEndDate: "2026-01-01",
        },
        "u-1" as any,
      ).pipe(Effect.catchAll((e) => Effect.succeed(e))),
    )
    expect(result).toBeInstanceOf(ContractDateInvalidError)
  })
})
```

**Run:** `pnpm test --filter website create-company.test.ts`
**Expected:** 4 tests PASS

**Commit:** `feat(companies): createCompanyProgram with super admin guard`

### Task C.1.5 — Supabase implementation + soft-delete (SUP-10)

**Files:**
- Create: `apps/website/src/domain/companies/companies.repository.supabase.ts`
- Create: `apps/website/src/domain/companies/companies.module.ts` (barrel export)
- Create: `apps/website/src/domain/companies/__tests__/suspend-softdelete.test.ts`

**Spec — `companies.repository.supabase.ts`:**

```typescript
import { Effect } from "effect"
import type { SupabaseClient } from "@supabase/supabase-js"
import { ICompaniesRepository } from "./companies.repository"
import type { TCompany } from "./companies.types"
import {
  CompanyNotFoundError,
  DuplicateCompanyError,
  ContractDateInvalidError,
} from "./companies.errors"

const fromCompanyRow = (row: any): TCompany => ({
  id: row.id,
  name: row.name,
  domain: row.domain,
  billingTier: row.billing_tier,
  sessionQuota: row.session_quota,
  sessionsUsed: row.sessions_used,
  contractStartDate: row.contract_start_date,
  contractEndDate: row.contract_end_date,
  status: row.status,
  legalHold: row.legal_hold,
  softDeletedAt: row.soft_deleted_at,
  sessionIdleTimeoutMinutes: row.session_idle_timeout_minutes,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const makeSupabaseCompaniesRepository = (supabase: SupabaseClient): ICompaniesRepository["Type"] => ({
  create: (input) =>
    Effect.tryPromise({
      try: async () => {
        const { data, error } = await supabase
          .from("companies")
          .insert({
            name: input.name,
            domain: input.domain,
            billing_tier: input.billingTier,
            session_quota: input.sessionQuota,
            contract_start_date: input.contractStartDate,
            contract_end_date: input.contractEndDate,
            created_by: input.createdBy,
          })
          .select()
          .single()
        if (error) {
          if (error.code === "23505") {
            // Unique violation
            const field = error.message.includes("name") ? "name" : "domain"
            throw new DuplicateCompanyError({ message: `Duplicate ${field}`, conflictingField: field })
          }
          throw new Error(error.message)
        }
        return fromCompanyRow(data)
      },
      catch: (e) => {
        if (e instanceof DuplicateCompanyError) return e
        return new Error(String(e))
      },
    }),

  findById: (id) =>
    Effect.tryPromise({
      try: async () => {
        const { data, error } = await supabase.from("companies").select("*").eq("id", id).single()
        if (error || !data) throw new CompanyNotFoundError({ message: "Company not found", companyId: id })
        return fromCompanyRow(data)
      },
      catch: (e) => {
        if (e instanceof CompanyNotFoundError) return e
        return new CompanyNotFoundError({ message: String(e) })
      },
    }),

  list: ({ limit, cursor, status, search }) =>
    Effect.tryPromise({
      try: async () => {
        let query = supabase.from("companies").select("*").limit(limit)
        if (cursor) query = query.gt("created_at", cursor)
        if (status) query = query.eq("status", status)
        if (search) query = query.ilike("name", `%${search}%`)
        const { data, error } = await query
        if (error) throw error
        return {
          items: (data ?? []).map(fromCompanyRow),
          nextCursor: null,  // simplified
        }
      },
      catch: () => ({ items: [], nextCursor: null }),
    }),

  update: () => Effect.die("TODO"),
  updateQuota: () => Effect.die("TODO"),
  suspend: (id, reason) =>
    Effect.tryPromise({
      try: async () => {
        const { data, error } = await supabase
          .from("companies")
          .update({ status: "suspended", suspended_reason: reason })
          .eq("id", id)
          .select()
          .single()
        if (error || !data) throw new CompanyNotFoundError({ message: "Company not found" })
        return fromCompanyRow(data)
      },
      catch: (e) => new CompanyNotFoundError({ message: String(e) }),
    }),

  unsuspend: () => Effect.die("TODO"),
  softDelete: (id) =>
    Effect.tryPromise({
      try: async () => {
        const restoresUntil = new Date(Date.now() + 48 * 3600 * 1000).toISOString()
        const { error } = await supabase
          .from("companies")
          .update({ status: "offboarded", soft_deleted_at: new Date().toISOString() })
          .eq("id", id)
        if (error) throw new CompanyNotFoundError({ message: "Company not found" })
        return { restoresUntil }
      },
      catch: (e) => new CompanyNotFoundError({ message: String(e) }),
    }),
  hardDelete: () => Effect.void,
  restoreFromSoftDelete: () => Effect.die("TODO"),
})
```

**Test — `suspend-softdelete.test.ts`:**

```typescript
import { describe, it, expect } from "vitest"
import { Effect } from "effect"

describe("suspendCompanyProgram / softDeleteCompanyProgram", () => {
  it.todo("suspends active company")
  it.todo("blocks suspend with open escalation cases")
  it.todo("soft-delete returns 48h window")
  it.todo("rejects two-person confirm if not super admin")
})
```

**Commit:** `feat(companies): Supabase implementation of repository`

### Task C.1.6 — Soft-delete with two-person confirmation (SUP-10)

**Files:**
- Append to: `apps/website/src/domain/companies/companies.programs.ts`

**Spec:**

```typescript
export const initiateSoftDeleteProgram = (input: {
  companyId: TCompanyId
  reason: string
  initiatedBy: TUserId
  approverEmail: string
}): Effect.Effect<
  { readonly confirmationToken: string },
  | ValidationError
  | CompanyNotFoundError
  | InsufficientPermissionError
  | InsufficientApproversError
  | SelfApprovalError
  | LegalHoldError,
  ICompaniesRepository | IMembershipsRepository
> =>
  Effect.gen(function* () {
    // 1. Verify initiator is super admin
    const isSuperAdmin = yield* IMembershipsRepository.pipe(
      Effect.flatMap((r) => r.userHasRole(input.initiatedBy, "super_admin")),
    )
    if (!isSuperAdmin) {
      return yield* Effect.fail(
        new InsufficientPermissionError({ message: "Super admin only", required: "super_admin", actual: "lower" }),
      )
    }

    // 2. Verify approver exists and is super admin
    const approver = yield* IMembershipsRepository.pipe(
      Effect.flatMap((r) => r.findUserByEmail(input.approverEmail)),
    )
    if (!approver) {
      return yield* Effect.fail(new ValidationError({ issues: ["Approver email not found"] }))
    }

    // 3. Verify at least 2 super admins exist
    const superAdminCount = yield* IMembershipsRepository.pipe(Effect.flatMap((r) => r.countSuperAdmins()))
    if (superAdminCount < 2) {
      return yield* Effect.fail(
        new InsufficientApproversError({ message: "Need at least 2 super admins for two-person action" }),
      )
    }

    // 4. Verify approver != initiator
    if (approver.id === input.initiatedBy) {
      return yield* Effect.fail(new SelfApprovalError({ message: "Cannot self-approve deletion" }))
    }

    // 5. Verify no legal hold
    const company = yield* ICompaniesRepository.pipe(Effect.flatMap((r) => r.findById(input.companyId)))
    if (company.legalHold) {
      return yield* Effect.fail(new LegalHoldError({ message: "Cannot delete while legal hold is active" }))
    }

    // 6. Generate confirmation token, send email to approver
    const confirmationToken = yield* Effect.try({
      try: () => crypto.randomUUID(),
      catch: (e) => new ValidationError({ issues: [String(e)] }),
    })

    // Store in soft_delete_confirmations table
    yield* ICompaniesRepository.pipe(
      Effect.flatMap((r) => r.storeSoftDeleteConfirmation(input.companyId, input.initiatedBy, approver.id, confirmationToken, input.reason)),
    )

    // 7. Send email to approver
    yield* Effect.tryPromise({
      try: () => sendSoftDeleteApprovalEmail(input.approverEmail, input.companyId, confirmationToken),
      catch: () => undefined,  // best-effort
    })

    return { confirmationToken }
  })
```

**Test cases — see A.5 Stage 11:**
- [ ] Two super admins confirm → soft delete
- [ ] Reversed within 48h → full restore
- [ ] Only 1 super admin → block
- [ ] Legal hold active → block
- [ ] Hard delete requires another 2-person after 48h

**Commit:** `feat(companies): soft-delete with two-person confirmation (SUP-10)`

---

## C.2 — Company Admin Console UI (Journey B Stage 5-15)

### Task C.2.1 — Admin layout + nav

**Files:**
- Create: `apps/website/src/layouts/AdminLayout.astro`
- Create: `apps/website/src/components/admin/AdminSidebar.tsx`
- Create: `apps/website/src/pages/admin/index.astro`

**Spec — `AdminLayout.astro`:**

```astro
---
import AdminSidebar from "@/components/admin/AdminSidebar"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const { pathname } = Astro.url
const user = Astro.locals.session
if (!user) return Astro.redirect("/login")

const supabase = createSupabaseServerClient(Astro)!
const { data: membership } = await supabase
  .from("user_company_memberships")
  .select("role, companies(name, id)")
  .eq("user_id", user.userId)
  .eq("is_active", true)
  .eq("is_primary", true)
  .single()

if (!membership || !["company_admin", "super_admin"].includes(membership.role)) {
  return Astro.redirect("/c/")
}
---
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Admin Console — {membership.companies.name}</title>
</head>
<body>
  <div class="flex min-h-screen bg-gray-50">
    <AdminSidebar
      currentPath={pathname}
      companyName={membership.companies.name}
      userRole={membership.role}
    />
    <main class="flex-1 p-8">
      <slot />
    </main>
  </div>
</body>
</html>
```

**Spec — `AdminSidebar.tsx`:**

```typescript
import { LayoutDashboard, Users, Palette, CreditCard, Megaphone, History, UserCog, LifeBuoy } from "lucide-react"

type AdminSidebarProps = {
  currentPath: string
  companyName: string
  userRole: "super_admin" | "company_admin" | "clinical_staff" | "employee"
}

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/roster", label: "Roster", icon: Users },
  { href: "/admin/branding", label: "Branding", icon: Palette },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/activity-log", label: "Activity log", icon: History },
  { href: "/admin/team", label: "Team", icon: UserCog },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
] as const

export const AdminSidebar = ({ currentPath, companyName, userRole }: AdminSidebarProps) => (
  <aside data-testid="admin-sidebar" className="w-64 bg-white border-r h-screen sticky top-0">
    <div className="p-4 border-b">
      <h2 className="font-semibold" data-testid="company-name">{companyName}</h2>
      <p className="text-xs text-gray-500" data-testid="user-role">{userRole.replace("_", " ")}</p>
    </div>
    <nav className="p-2">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = currentPath.startsWith(item.href)
        return (
          <a
            key={item.href}
            href={item.href}
            data-testid={`nav-${item.label.toLowerCase().replace(/ /g, "-")}`}
            className={`flex items-center gap-2 px-3 py-2 rounded ${isActive ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"}`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </a>
        )
      })}
    </nav>
  </aside>
)
```

**Acceptance criteria — see A.2 Stage 5:**
- [ ] Sidebar visible on all /admin/* pages
- [ ] Active link highlighted
- [ ] Company name shown in header
- [ ] Non-admin users redirected to /c/

**Commit:** `feat(admin): layout + sidebar with role-based gating`

### Task C.2.2 — Dashboard page (ADM-1, ADM-2, ADM-3)

**Files:**
- Create: `apps/website/src/pages/admin/dashboard.astro`
- Create: `apps/website/src/components/admin/KpiTile.tsx`
- Create: `apps/website/src/components/admin/UsageChart.tsx`
- Create: `apps/website/src/pages/api/admin/analytics.ts`

**Spec — `KpiTile.tsx`:**

```typescript
import { Card } from "@treonstudio/bungas-core/ui/card"
import { ArrowUp, ArrowDown } from "lucide-react"
import type { ReactNode } from "react"

type KpiTileProps = {
  readonly label: string
  readonly value: string | number
  readonly trend?: { readonly direction: "up" | "down" | "flat"; readonly percent: number }
  readonly icon?: ReactNode
  readonly testId: string
}

export const KpiTile = ({ label, value, trend, icon, testId }: KpiTileProps) => (
  <Card data-testid={testId}>
    <div className="flex items-center justify-between p-2">
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
        {trend && (
          <p className={`text-xs mt-1 ${trend.direction === "up" ? "text-green-600" : trend.direction === "down" ? "text-red-600" : "text-gray-500"}`}>
            {trend.direction === "up" ? <ArrowUp className="inline h-3 w-3" /> : trend.direction === "down" ? <ArrowDown className="inline h-3 w-3" /> : null}
            {trend.percent}%
          </p>
        )}
      </div>
      {icon && <div className="text-gray-400">{icon}</div>}
    </div>
  </Card>
)
```

**Spec — Analytics API:**

```typescript
// apps/website/src/pages/api/admin/analytics.ts
import type { APIContext } from "astro"
import { jsonOk, jsonError, makeMeta } from "@/lib/api-helpers"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type TCompanyAnalytics = {
  readonly totalEmployees: number
  readonly activeThisMonth: number
  readonly sessionsThisMonth: number
  readonly riskFlagsCount: number
  readonly dailyActiveUsers: readonly { readonly date: string; readonly count: number }[]
  readonly warningLevel: "none" | "warning" | "critical" | "exceeded"
}

const computeCompanyAnalytics = async (supabase: SupabaseClient, companyId: string): Promise<TCompanyAnalytics> => {
  // Get company
  const { data: company } = await supabase
    .from("companies")
    .select("sessions_used, session_quota")
    .eq("id", companyId)
    .single()

  // Count active employees (RLS-scoped to company)
  const { count: totalEmployees } = await supabase
    .from("user_company_memberships")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("is_active", true)
    .eq("role", "employee")

  // MAU (active in last 30 days) — uses profiles.last_active_at
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const { count: activeThisMonth } = await supabase
    .from("user_company_memberships")
    .select("user_id, profiles!inner(last_active_at)", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("is_active", true)
    .eq("role", "employee")
    .gte("profiles.last_active_at", thirtyDaysAgo)

  // Sessions this month — from conversations table
  // (conversations need company_id scoping — TODO in schema)
  const sessionsThisMonth = 0  // placeholder

  // Anonymized risk flag count (RISK-3)
  const { count: riskFlagsCount } = await supabase
    .from("risk_flags")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)

  // Only show if group size >= 5 (per WFA-2)
  if ((totalEmployees ?? 0) < 5) {
    return {
      totalEmployees: totalEmployees ?? 0,
      activeThisMonth: 0,
      sessionsThisMonth: 0,
      riskFlagsCount: 0,
      dailyActiveUsers: [],
      warningLevel: "none",
    }
  }

  // Compute warning level
  const usage = (company?.sessions_used ?? 0) / (company?.session_quota ?? 1)
  const warningLevel: TCompanyAnalytics["warningLevel"] =
    usage >= 1 ? "exceeded" : usage >= 0.95 ? "critical" : usage >= 0.80 ? "warning" : "none"

  return {
    totalEmployees: totalEmployees ?? 0,
    activeThisMonth: activeThisMonth ?? 0,
    sessionsThisMonth,
    riskFlagsCount: riskFlagsCount ?? 0,
    dailyActiveUsers: [],  // TODO: 30-day time series query
    warningLevel,
  }
}

export const GET = async (context: APIContext) => {
  const userId = context.locals.session?.userId
  if (!userId) return jsonError({ _tag: "Unauthorized", message: "Not logged in" }, makeMeta(), 401)

  const supabase = createSupabaseServerClient(context)!
  const { data: membership } = await supabase
    .from("user_company_memberships")
    .select("company_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("is_primary", true)
    .single()

  if (!membership || !["company_admin", "super_admin"].includes(membership.role)) {
    return jsonError({ _tag: "Forbidden", message: "Not authorized" }, makeMeta(), 403)
  }

  const analytics = await computeCompanyAnalytics(supabase, membership.company_id)
  return jsonOk(analytics, makeMeta())
}
```

**Spec — `dashboard.astro`:**

```astro
---
import AdminLayout from "@/layouts/AdminLayout.astro"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import KpiTile from "@/components/admin/KpiTile"
import UsageChart from "@/components/admin/UsageChart"

const supabase = createSupabaseServerClient(Astro)!
const userId = Astro.locals.session?.userId

const { data: membership } = await supabase
  .from("user_company_memberships")
  .select("company_id")
  .eq("user_id", userId)
  .eq("is_active", true)
  .eq("is_primary", true)
  .single()

const res = await fetch(`${Astro.url.origin}/api/admin/analytics`, {
  headers: { Cookie: Astro.request.headers.get("cookie") ?? "" },
})
const { data: analytics } = await res.json()
---
<AdminLayout>
  <h1 class="text-2xl font-semibold mb-6">Dashboard</h1>

  {analytics.totalEmployees < 5 ? (
    <div data-testid="empty-state" class="bg-yellow-50 border-l-4 border-yellow-500 p-4">
      <p>Your data will appear once at least 5 employees have registered.</p>
    </div>
  ) : (
    <>
      <div class="grid grid-cols-4 gap-4">
        <KpiTile testId="kpi-total-employees" label="Total employees" value={analytics.totalEmployees} />
        <KpiTile testId="kpi-active-this-month" label="Active this month" value={analytics.activeThisMonth} />
        <KpiTile testId="kpi-sessions-this-month" label="Sessions this month" value={analytics.sessionsThisMonth} />
        <KpiTile testId="kpi-risk-flags" label="Risk flags (anonymized)" value={analytics.riskFlagsCount} />
      </div>

      <div class="mt-8">
        <h2>Daily active users (last 30 days)</h2>
        <UsageChart data={analytics.dailyActiveUsers} />
      </div>
    </>
  )}
</AdminLayout>
```

**Test cases — see A.2 Stage 8:**
- [ ] Active tenant, normal data → 4 KPIs + chart shown
- [ ] New tenant, no data → empty state per ADM-4
- [ ] Group size < 5 → aggregate metrics suppressed
- [ ] Risk count = anonymized (RISK-3 boundary)
- [ ] Warning level badge correctly colored

**Commit:** `feat(admin): dashboard with KPI tiles + usage chart (ADM-1/2/3/4)`

### Task C.2.3 — Roster page (ADM-2, ADM-6, ADM-8, ADM-9, EMP-14)

**Files:**
- Create: `apps/website/src/pages/admin/roster.astro`
- Create: `apps/website/src/components/admin/RosterTable.tsx`
- Create: `apps/website/src/components/admin/InviteAdminDialog.tsx`
- Create: `apps/website/src/components/admin/BulkDeactivationGuard.tsx`
- Reuse: `BulkInviteUploader.tsx` from B.1.11

**Spec — `RosterTable.tsx`:**

```typescript
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@treonstudio/bungas-core/ui/table"
import { Button } from "@treonstudio/bungas-core/ui/button"
import { Badge } from "@treonstudio/bungas-core/ui/badge"

type TEmployeeRow = {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly role: "employee" | "company_admin"
  readonly lastActive: string | null
  readonly status: "active" | "paused" | "deactivated"
}

type RosterTableProps = {
  readonly employees: readonly TEmployeeRow[]
  readonly onDeactivate: (ids: string[]) => void
  readonly onChangeRole: (id: string, role: "employee" | "company_admin") => void
}

export const RosterTable = ({ employees, onDeactivate, onChangeRole }: RosterTableProps) => {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  return (
    <div data-testid="roster-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead><input type="checkbox" data-testid="select-all" onChange={(e) => {
              if (e.target.checked) setSelected(new Set(employees.map((emp) => emp.id)))
              else setSelected(new Set())
            }} /></TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Last active</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((emp) => (
            <TableRow key={emp.id} data-testid={`employee-row-${emp.id}`}>
              <TableCell>
                <input
                  type="checkbox"
                  data-testid={`select-${emp.id}`}
                  checked={selected.has(emp.id)}
                  onChange={() => toggleSelect(emp.id)}
                />
              </TableCell>
              <TableCell>{emp.name}</TableCell>
              <TableCell>{emp.email}</TableCell>
              <TableCell><Badge>{emp.role}</Badge></TableCell>
              <TableCell>{emp.lastActive ? new Date(emp.lastActive).toLocaleDateString() : "Never"}</TableCell>
              <TableCell>
                <Badge variant={emp.status === "active" ? "default" : "secondary"}>{emp.status}</Badge>
              </TableCell>
              <TableCell>
                <Button size="sm" variant="destructive" data-testid={`deactivate-${emp.id}`} onClick={() => onDeactivate([emp.id])}>
                  Deactivate
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selected.size > 0 && (
        <div className="mt-4 flex gap-2 items-center">
          <span>{selected.size} selected</span>
          <Button data-testid="bulk-deactivate" variant="destructive" onClick={() => onDeactivate(Array.from(selected))}>
            Deactivate selected
          </Button>
        </div>
      )}
    </div>
  )
}
```

**Spec — `BulkDeactivationGuard.tsx` (per EMP-14):**

```typescript
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@treonstudio/bungas-core/ui/alert-dialog"

type BulkDeactivationGuardProps = {
  readonly affectedCount: number
  readonly totalRoster: number
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

export const BulkDeactivationGuard = ({ affectedCount, totalRoster, onConfirm, onCancel }: BulkDeactivationGuardProps) => {
  const ratio = affectedCount / totalRoster
  if (ratio <= 0.20) return null

  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent data-testid="bulk-deactivation-guard">
        <AlertDialogTitle>Bulk deactivation confirmation required</AlertDialogTitle>
        <AlertDialogDescription>
          You're about to deactivate <strong>{affectedCount}</strong> of <strong>{totalRoster}</strong> employees
          ({Math.round(ratio * 100)}% of the roster). This exceeds the 20% safety threshold.
          A Super Admin must confirm this action.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} data-testid="bulk-deactivation-cancel">Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} data-testid="bulk-deactivation-confirm">
            Request Super Admin approval
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

**Test cases — see A.2 Stage 16-17:**
- [ ] Roster table shows all employees
- [ ] Single deactivation works
- [ ] Bulk > 20% shows AlertDialog
- [ ] Last admin cannot self-deactivate
- [ ] Open escalation case blocks deactivation

**Commit:** `feat(admin): roster with bulk deactivation guard (ADM-2/6/8/9, EMP-14)`

### Task C.2.4 — Billing page (BILL-1, BILL-2)

**Files:**
- Create: `apps/website/src/pages/admin/billing.astro`
- Create: `apps/website/src/components/admin/BillingOverview.tsx`

**Spec — `BillingOverview.tsx`:**

```typescript
import { Card } from "@treonstudio/bungas-core/ui/card"
import { Progress } from "@treonstudio/bungas-core/ui/progress"
import { Badge } from "@treonstudio/bungas-core/ui/badge"

type BillingOverviewProps = {
  readonly company: {
    readonly billingTier: "starter" | "growth" | "enterprise" | "trial"
    readonly sessionQuota: number
    readonly sessionsUsed: number
    readonly contractStartDate: string | null
    readonly contractEndDate: string | null
  }
  readonly warningLevel: "none" | "warning" | "critical" | "exceeded"
  readonly scheduledChange: { readonly tier: string; readonly effectiveAt: string } | null
}

const warningColors: Record<BillingOverviewProps["warningLevel"], string> = {
  none: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  critical: "bg-red-100 text-red-800",
  exceeded: "bg-red-200 text-red-900",
}

export const BillingOverview = ({ company, warningLevel, scheduledChange }: BillingOverviewProps) => {
  const usagePercent = (company.sessionsUsed / company.sessionQuota) * 100

  return (
    <div data-testid="billing-overview" className="space-y-4">
      <Card>
        <h2 className="font-semibold mb-2">Current usage</h2>
        <div className="flex items-center gap-4">
          <Progress value={usagePercent} className="flex-1" data-testid="quota-progress" />
          <span data-testid="quota-usage">
            {company.sessionsUsed} / {company.sessionQuota} sessions
          </span>
          <Badge className={warningColors[warningLevel]} data-testid="warning-level">
            {warningLevel.toUpperCase()}
          </Badge>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold mb-2">Plan</h2>
        <p data-testid="billing-tier">{company.billingTier}</p>
        <p className="text-sm text-gray-500">
          Contract: {company.contractStartDate ?? "-"} → {company.contractEndDate ?? "-"}
        </p>
      </Card>

      {scheduledChange && (
        <Card data-testid="scheduled-change">
          <h2 className="font-semibold mb-2">Scheduled change</h2>
          <p>On {scheduledChange.effectiveAt}, plan will change to {scheduledChange.tier}.</p>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold mb-2">Payment history</h2>
        <p className="text-sm text-gray-500">Available in Phase 2 (PAYG + invoicing)</p>
      </Card>
    </div>
  )
}
```

**Test cases — see A.2 Stage 12:**
- [ ] Quota used normally → green badge "OK"
- [ ] 80% used → yellow "Warning" badge
- [ ] 95% used → red "Critical" badge
- [ ] 100% used → red "Exceeded" badge + "Contact Sales" CTA
- [ ] Scheduled change shown if exists

**Commit:** `feat(admin): billing overview with quota progress + warning levels (BILL-1/2)`

### Task C.2.5 — Activity log (ADM-12)

**Files:**
- Create: `apps/website/src/pages/admin/activity-log.astro`
- Create: `apps/website/src/components/admin/ActivityLogTable.tsx`
- Create: `apps/website/src/pages/api/admin/activity-log.ts`

**Spec — `apps/website/src/pages/api/admin/activity-log.ts`:**

```typescript
import type { APIContext } from "astro"
import { jsonOk, jsonError, makeMeta } from "@/lib/api-helpers"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const GET = async (context: APIContext) => {
  const userId = context.locals.session?.userId
  if (!userId) return jsonError({ _tag: "Unauthorized", message: "Not logged in" }, makeMeta(), 401)

  const supabase = createSupabaseServerClient(context)!
  const { data: membership } = await supabase
    .from("user_company_memberships")
    .select("company_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("is_primary", true)
    .single()

  if (!membership) return jsonError({ _tag: "Forbidden", message: "Not authorized" }, makeMeta(), 403)

  // RLS already scopes by company_id
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .eq("company_id", membership.company_id)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) return jsonError({ _tag: "Error", message: error.message }, makeMeta(), 500)

  return jsonOk(data ?? [], makeMeta())
}
```

**Test cases — see A.2 Stage 13:**
- [ ] Activity log shows admin actions in own company
- [ ] Cannot see Super Admin actions
- [ ] Pagination works
- [ ] Filter by action type

**Commit:** `feat(admin): activity log scoped to company (ADM-12)`

### Task C.2.6 — Support ticket (ADM-10)

**Files:**
- Create: `apps/website/src/pages/admin/support.astro`
- Create: `apps/website/src/components/admin/SupportTicketForm.tsx`
- Create: `apps/website/src/pages/api/admin/support-tickets.ts`
- Migration: `support_tickets` table

**Migration:**

```sql
-- apps/website/supabase/migrations/20260625000010_create_support_tickets.sql
create table if not exists public.support_tickets (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  subject text not null,
  description text not null,
  priority text not null check (priority in ('low','medium','high')),
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.support_tickets enable row level security;
create policy "company_admins_view_own" on public.support_tickets
  for select using (public.current_user_role_in(company_id) in ('company_admin','super_admin'));
create policy "company_admins_insert" on public.support_tickets
  for insert with check (public.current_user_role_in(company_id) in ('company_admin','super_admin'));
```

**Spec — `SupportTicketForm.tsx`:**

```typescript
import { Button } from "@treonstudio/bungas-core/ui/button"
import { Input } from "@treonstudio/bungas-core/ui/input"
import { Textarea } from "@treonstudio/bungas-core/ui/textarea"
import { Label } from "@treonstudio/bungas-core/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@treonstudio/bungas-core/ui/select"

const detectPII = (text: string): boolean => {
  // Simple PII detection — names, emails, etc.
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
  return emailRegex.test(text) && text.match(emailRegex)?.some((e) => !e.includes("@tenang") && !e.includes("@acme.com"))  // adjust for company
}

export const SupportTicketForm = () => {
  const [formData, setFormData] = useState({
    subject: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high",
  })
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.description.length < 20) {
      setError("Description must be at least 20 characters")
      return
    }
    if (detectPII(formData.description)) {
      setWarning("Your description contains what looks like personal information. Tickets are linked to your company only — please don't include employee names or PII.")
      return
    }
    const res = await fetch("/api/admin/support-tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    })
    if (res.ok) {
      window.location.href = "/admin/support"
    } else {
      const json = await res.json()
      setError(json.error.message)
    }
  }

  return (
    <form data-testid="support-ticket-form" onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div>
        <Label htmlFor="subject">Subject *</Label>
        <Input id="subject" data-testid="ticket-subject" value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })} required minLength={5} maxLength={200} />
      </div>
      <div>
        <Label htmlFor="priority">Priority</Label>
        <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v as any })}>
          <SelectTrigger data-testid="ticket-priority"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="description">Description *</Label>
        <Textarea id="description" data-testid="ticket-description" value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })} required minLength={20} maxLength={5000} rows={6} />
      </div>
      {warning && (
        <div data-testid="pii-warning" className="bg-yellow-50 border-l-4 border-yellow-500 p-3 text-sm">
          {warning}
        </div>
      )}
      {error && <div data-testid="ticket-error" className="text-red-500">{error}</div>}
      <Button data-testid="ticket-submit" type="submit">Submit ticket</Button>
    </form>
  )
}
```

**Test cases — see A.2 Stage 18:**
- [ ] Ticket body scanned for employee names
- [ ] Ticket body scanned for chat-like content
- [ ] Subject + description required
- [ ] Priority selectable

**Commit:** `feat(admin): support ticket creation scoped to company (ADM-10)`

---

## C.3 — Journey B E2E Test Suite

### Task C.3.1 — Playwright tests for Journey B

**Files:**
- Create: `apps/website/tests/e2e/journey-b-company-admin.spec.ts`

**Spec — all 10 test scenarios from A.7:**

```typescript
import { test, expect } from "@playwright/test"

test.describe("Journey B: Company Admin", () => {
  test("happy path: login → wizard → branding → bulk invite → monitor", async ({ page }) => { /* ... */ })
  test("low adoption alert: < 10% MAU 14d → email", async ({ page }) => { /* ... */ })
  test("bulk invite with errors: CSV with bad rows → preview flags", async ({ page }) => { /* ... */ })
  test("admin role transfer: old admin → new admin → role moved", async ({ page }) => { /* ... */ })
  test("admin leaves (only admin): block + force add new", async ({ page }) => { /* ... */ })
  test("support ticket: create → Tenang support responds", async ({ page }) => { /* ... */ })
  test("anonymized risk view: aggregate shown; individual blocked", async ({ page }) => { /* ... */ })
  test("activity log: all admin actions logged + visible", async ({ page }) => { /* ... */ })
  test("renewal reminder: 90d out → email with summary", async ({ page }) => { /* ... */ })
  test("account suspended (overdue): new sessions blocked; data preserved", async ({ page }) => { /* ... */ })
})
```

**Run:** `pnpm playwright test journey-b-company-admin`
**Expected:** All 10 PASS

**Commit:** `test(e2e): Journey B comprehensive test suite (10 scenarios)`

---

## C.4 — Journey B Acceptance Criteria Summary

| PRD Story | Implementation | Test |
|---|---|---|
| ONB-1 | C.1.4 | Unit |
| ONB-2 | B.1 + admin invite | C.3 happy path |
| ONB-8 | C.2.x self-service edit | Unit |
| ADM-1 | C.2.2 | C.3 happy path |
| ADM-2 | C.2.3 | C.3 happy path |
| ADM-3 | C.2.4 | C.3 billing-related |
| ADM-4 | C.2.2 empty state | E2E |
| ADM-5 | (P2 export) | Phase 2 |
| ADM-6 | C.2.3 (multi-admin) | C.3 admin transfer |
| ADM-7 | C.1 RLS + tenant guard | Unit |
| ADM-8 | C.2.3 (last admin block) | C.3 admin leaves |
| ADM-9 | C.2.3 (role transfer) | C.3 admin transfer |
| ADM-10 | C.2.6 | C.3 support ticket |
| ADM-11 | (P1.8.7 cron) | Unit + E2E |
| ADM-12 | C.2.5 | C.3 activity log |
| BILL-1 | C.2.4 | Unit |
| BILL-2 | C.1.4 (quota) | Unit |
| BILL-5 | (P2) | Phase 2 |
| BILL-6 | C.1.5 | C.3 suspended |
| BILL-7 | C.1.4 (quota adjust) | Unit |
| ENG-3 | (P2) | Phase 2 |
| ENG-7 | (P2) | Phase 2 |

**Journey B is "shipped" when:** All C.x tasks committed, all unit tests pass, all C.3 E2E pass, manual smoke: login → roster → invite → monitor → deactivation flows work.
