# Neon Adapter Architecture Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all 15 remaining Supabase-shim repository implementations with pure Neon raw SQL adapters, using DDD Adapter Architecture (Port/Adapter pattern). Auth domain is already migrated.

**Architecture:** Each domain keeps its interface (`*.repository.ts`) as the Port. A new `makeNeonXxxRepository(context)` factory in `*.repository.neon.ts` is the Infrastructure Adapter using `@/lib/neon/client`'s `query()` for raw parameterized SQL. Session auth uses `verifySession` from `@/lib/auth/session` (same as existing `auth.repository.neon.ts`). `api-helpers.ts` is updated to instantiate Neon repos instead of Supabase ones.

**Tech Stack:** `@neondatabase/serverless`, Effect-TS Context tags, raw parameterized SQL, `verifySession` from `@/lib/auth/session`.

---

## Shared Infrastructure

### Task 1: Create `getCurrentUserId` shared helper

**Files:**
- Create: `apps/website/src/lib/neon/session.ts`

- [ ] **Step 1: Write the helper**

Create `apps/website/src/lib/neon/session.ts` with this content:

```typescript
import { Effect } from "effect"
import { verifySession } from "@/lib/auth/session"
import { UnauthorizedError } from "@/shared/types/errors"

const getSessionToken = (context: any): string | null => {
  if (context?.cookies?.get) {
    try {
      const cookie = context.cookies.get("tenang-session")
      if (cookie?.value) return cookie.value
    } catch (e) {
      // Ignore and fallback
    }
  }
  if (context?.request?.headers) {
    const headers = context.request.headers
    const cookieHeader =
      headers instanceof Headers
        ? headers.get("cookie")
        : headers["cookie"]
    if (cookieHeader) {
      const match = cookieHeader.match(/tenang-session=([^;]+)/)
      if (match) return match[1]
    }
  }
  return null
}

export const getCurrentUserId = (
  context: any,
  effect: Effect.Effect<any, any, any>,
): Effect.Effect<string, UnauthorizedError> =>
  Effect.gen(function* () {
    const token = getSessionToken(context)
    if (!token) {
      return yield* Effect.fail(
        new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" }),
      )
    }
    const payload = yield* Effect.tryPromise({
      try: () => verifySession(token),
      catch: () => null,
    })
    if (!payload?.userId) {
      return yield* Effect.fail(
        new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" }),
      )
    }
    return payload.userId as string
  }).pipe(Effect.flatMap(() => effect))
```

**Wait — simpler version.** The `getCurrentUserId` does not need to be wrapped in an Effect pipeline. Each repository method already wraps in `Effect.tryPromise`. Just make a sync helper:

```typescript
// apps/website/src/lib/neon/session.ts
import { verifySession } from "@/lib/auth/session"

const getSessionToken = (context: any): string | null => {
  if (context?.cookies?.get) {
    try {
      const cookie = context.cookies.get("tenang-session")
      if (cookie?.value) return cookie.value
    } catch (_) {}
  }
  if (context?.request?.headers) {
    const headers = context.request.headers
    const cookieHeader =
      headers instanceof Headers
        ? headers.get("cookie")
        : headers["cookie"]
    if (cookieHeader) {
      const match = cookieHeader.match(/tenang-session=([^;]+)/)
      if (match) return match[1]
    }
  }
  return null
}

export const getCurrentUserId = (context: any): string => {
  const token = getSessionToken(context)
  if (!token) throw new Error("NO_TOKEN")
  const payload = verifySession(token)
  if (!payload?.userId) throw new Error("INVALID_SESSION")
  return payload.userId as string
}
```

- [ ] **Step 2: Verify file creates without error**

Run: `cd apps/website && pnpm tsc --noEmit src/lib/neon/session.ts` (or use `pnpm check`)
Expected: No new errors introduced.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/lib/neon/session.ts
git commit -m "feat(website): add getCurrentUserId session helper for Neon repos"
```

---

## Migration Phases

Each phase migrates 3-4 domains. For each domain, the same pattern applies:

### Pattern per domain

**1. Create `domain/<name>/<name>.repository.neon.ts`**:
- Import `Effect` from `effect`
- Import `query` from `@/lib/neon/client`
- Import `getCurrentUserId` from `@/lib/neon/session`
- Import the domain errors and types
- Import the repository interface (`IXxxRepository`)
- Create `makeNeonXxxRepository(context)` factory returning `IXxxRepository["Type"]`
- Replace every `supabase.auth.getSession()` with `getCurrentUserId(context)` wrapped in try/catch returning `UnauthorizedError`
- Replace every `supabase.from("table").insert(...).select().single()` with `query("INSERT INTO table (...) VALUES ($1, ...) RETURNING *", [...])`
- Replace every `supabase.from("table").select("*").eq(...).order(...)` with `query("SELECT * FROM table WHERE ... ORDER BY ...", [...])`
- Replace `.update(...).eq("id", id).select().single()` with `query("UPDATE table SET ... WHERE id = $1 RETURNING *", [...])`
- Replace `.delete().eq(...)` with `query("DELETE FROM table WHERE ...", [...])`
- Keep ALL error types and return types identical to supabase version

**2. Update `domain/<name>/index.ts`**:
- Remove `export * from "./<name>.repository.supabase"`
- Add `export * from "./<name>.repository.neon"`

**3. Update `api-helpers.ts`** (done once at the end of all phases):
- Replace `makeSupabaseXxxRepository(supabase)` with `makeNeonXxxRepository(context)`
- Remove `createSupabaseServerClient(context)` call (no longer needed for any domain)
- Remove `@supabase/supabase-js` imports where they were only used for repository injection

---

### Task 2: Phase 1 — Migrate `projects`, `skills`, `prompts`

**Files:**
- Create: `apps/website/src/domain/projects/projects.repository.neon.ts`
- Create: `apps/website/src/domain/skills/skills.repository.neon.ts`
- Create: `apps/website/src/domain/prompts/prompts.repository.neon.ts`
- Modify: `apps/website/src/domain/projects/index.ts`
- Modify: `apps/website/src/domain/skills/index.ts`
- Modify: `apps/website/src/domain/prompts/index.ts`
- Delete: `apps/website/src/domain/projects/projects.repository.supabase.ts`
- Delete: `apps/website/src/domain/skills/skills.repository.supabase.ts`
- Delete: `apps/website/src/domain/prompts/prompts.repository.supabase.ts`

- [ ] **Step 1: Create `projects.repository.neon.ts`**

```typescript
import { Effect } from "effect"
import { IProjectsRepository } from "./projects.repository"
import type { TProject } from "./projects.types"
import { ProjectCreationError, ProjectFetchError, UnauthorizedError } from "./projects.errors"
import { query } from "@/lib/neon/client"
import { getCurrentUserId } from "@/lib/neon/session"

const mapProjectData = (data: any): TProject => ({
  id: data.id,
  name: data.name,
  userId: data.user_id,
  companyId: data.company_id ?? null,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
})

export const makeNeonProjectsRepository = (
  context: any,
): IProjectsRepository["Type"] => ({
  createProject: (name, companyId) =>
    Effect.tryPromise({
      try: async () => {
        let userId: string
        try {
          userId = getCurrentUserId(context)
        } catch {
          throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
        }

        const res = await query(
          `INSERT INTO public.projects (name, user_id, company_id)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [name, userId, companyId ?? null],
        )

        const row = res.rows[0]
        if (!row) throw new ProjectCreationError({ message: "Gagal membuat proyek" })
        return mapProjectData(row)
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof ProjectCreationError) return err
        return new ProjectCreationError({ message: err?.message || "Unknown error occurred" })
      },
    }),

  getProjects: (companyId) =>
    Effect.tryPromise({
      try: async () => {
        try {
          getCurrentUserId(context)
        } catch {
          throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
        }

        let res
        if (companyId) {
          res = await query(
            `SELECT * FROM public.projects WHERE company_id = $1 ORDER BY created_at DESC`,
            [companyId],
          )
        } else {
          res = await query(
            `SELECT * FROM public.projects WHERE company_id IS NULL ORDER BY created_at DESC`,
            [],
          )
        }

        return res.rows.map(mapProjectData)
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof ProjectFetchError) return err
        return new ProjectFetchError({ message: err?.message || "Unknown error occurred" })
      },
    }),
})
```

- [ ] **Step 2: Create `skills.repository.neon.ts`** (similar pattern, table `public.skills`)

- [ ] **Step 3: Create `prompts.repository.neon.ts`** (similar pattern, table `public.prompts`)

- [ ] **Step 4: Update index files** — remove supabase export, add neon export for all 3 domains.

- [ ] **Step 5: Delete supabase files** for all 3 domains.

- [ ] **Step 6: Run tests**

Run: `cd apps/website && pnpm test`
Expected: All existing tests pass (same behavior, different implementation).

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/domain/projects/ apps/website/src/domain/skills/ apps/website/src/domain/prompts/
git commit -m "feat(website): migrate projects, skills, prompts to Neon raw SQL adapters"
```

---

### Task 3: Phase 2 — Migrate `companies`, `invitations`, `notifications`

**Files:**
- Create: `apps/website/src/domain/companies/companies.repository.neon.ts`
- Create: `apps/website/src/domain/invitations/invitations.repository.neon.ts`
- Create: `apps/website/src/domain/notifications/notifications.repository.neon.ts`
- Modify: `apps/website/src/domain/companies/index.ts`
- Modify: `apps/website/src/domain/invitations/index.ts`
- Modify: `apps/website/src/domain/notifications/index.ts`
- Delete: `apps/website/src/domain/companies/companies.repository.supabase.ts`
- Delete: `apps/website/src/domain/invitations/invitations.repository.supabase.ts`
- Delete: `apps/website/src/domain/notifications/notifications.repository.supabase.ts`

**Note:** `companies` has a transaction (create company + add owner membership). Use `transaction()` from `@/lib/neon/client`. `invitations` has a JOIN query for `verifyInvitation` (select invitation + join companies). Use raw SQL JOIN.

- [ ] **Step 1: Create `companies.repository.neon.ts` with `transaction()`** for `createCompany` (create company then add owner membership).

- [ ] **Step 2: Create `invitations.repository.neon.ts`** — the `verifyInvitation` maps to a JOIN query:
  ```sql
  SELECT i.*, c.name as company_name FROM public.invitations i
  JOIN public.companies c ON c.id = i.company_id
  WHERE i.token_hash = $1
  ```

- [ ] **Step 3: Create `notifications.repository.neon.ts`** — `broadcastAnnouncement` needs `transaction()` or batch insert.

- [ ] **Step 4: Update index files, delete supabase files, run tests, commit** (same as Task 2 steps 4-7).

---

### Task 4: Phase 3 — Migrate `billing`, `branding`, `safety`, `analytics`

**Files:**
- Create: `apps/website/src/domain/billing/billing.repository.neon.ts`
- Create: `apps/website/src/domain/branding/branding.repository.neon.ts`
- Create: `apps/website/src/domain/safety/safety.repository.neon.ts`
- Create: `apps/website/src/domain/analytics/analytics.repository.neon.ts`
- Modify: `apps/website/src/domain/billing/index.ts`
- Modify: `apps/website/src/domain/branding/index.ts`
- Modify: `apps/website/src/domain/safety/index.ts`
- Modify: `apps/website/src/domain/analytics/index.ts`
- Delete: `apps/website/src/domain/billing/billing.repository.supabase.ts`
- Delete: `apps/website/src/domain/branding/branding.repository.supabase.ts`
- Delete: `apps/website/src/domain/safety/safety.repository.supabase.ts`
- Delete: `apps/website/src/domain/analytics/analytics.repository.supabase.ts`

**Notes:**
- `billing.getBillingInfo` does not call `supabase.auth.getSession()` — no auth check needed. Uses `query("SELECT id, session_quota, sessions_used FROM public.companies WHERE id = $1", [companyId])`.
- `billing.incrementSessionUsage` does two queries — use `transaction()`.
- `analytics.getDailyActiveUsers` — the in-memory grouping by date should be done via SQL `DATE(created_at)` GROUP BY:
  ```sql
  SELECT DATE(created_at) as date, COUNT(DISTINCT user_id) as active_users
  FROM public.session_metrics
  WHERE company_id = $1
  GROUP BY DATE(created_at)
  ORDER BY date DESC
  LIMIT $2
  ```
- `safety.flagRisk` with `tier === "critical"` creates a follow-up `escalation_cases` row — use `transaction()`.

- [ ] **Step 1-4: Create all 4 Neon repos** following patterns above.

- [ ] **Step 5: Update index files, delete supabase files, run tests, commit**.

---

### Task 5: Phase 4 — Migrate `super-admin`, `super-admin-ops`, `company-admin-ops`, `agents`

**Files:**
- Create: `apps/website/src/domain/super-admin/super-admin.repository.neon.ts`
- Create: `apps/website/src/domain/super-admin-ops/super-admin-ops.repository.neon.ts`
- Create: `apps/website/src/domain/company-admin-ops/company-admin-ops.repository.neon.ts`
- Modify: `apps/website/src/domain/super-admin/index.ts`
- Modify: `apps/website/src/domain/super-admin-ops/index.ts`
- Modify: `apps/website/src/domain/company-admin-ops/index.ts`
- Delete: `apps/website/src/domain/super-admin/super-admin.repository.supabase.ts`
- Delete: `apps/website/src/domain/super-admin-ops/super-admin-ops.repository.supabase.ts`
- Delete: `apps/website/src/domain/company-admin-ops/company-admin-ops.repository.supabase.ts`
- **Split**: `apps/website/src/domain/agents/agents.repository.ts` (combined interface + supabase impl) → create new `apps/website/src/domain/agents/agents.repository.neon.ts`, update `agents.repository.ts` to keep only the interface.

**Notes:**
- `super-admin` methods check for `role = 'super_admin'` in `company_memberships` — add that SQL check in the Neon repo.
- `super-admin.provisionTenant` creates a company + inserts handoff artefact — use `transaction()`.
- `agents` is special: `agents.repository.ts` currently has both the `AgentsRepository` tag AND the `createSupabaseAgentsRepository` factory in the same file. Split into:
  - `agents.repository.ts` — keep only the `AgentsRepository` interface tag
  - `agents.repository.neon.ts` — new `makeNeonAgentsRepository(context)` factory
  - Update `agents/index.ts` to export only the interface and neon repo

- [ ] **Step 1: Create `super-admin.repository.neon.ts`** — verify super admin via SQL:
  ```sql
  SELECT id FROM public.company_memberships
  WHERE user_id = $1 AND role = 'super_admin' AND status = 'active'
  LIMIT 1
  ```
  Then throw `UnauthorizedError` if no rows.

- [ ] **Step 2: Create `super-admin-ops.repository.neon.ts`** and `company-admin-ops.repository.neon.ts`.

- [ ] **Step 3: Split `agents.repository.ts`** into interface-only + new neon adapter.

- [ ] **Step 4: Update index files, delete supabase files, run tests, commit**.

---

### Task 6: Update `api-helpers.ts`

**Files:**
- Modify: `apps/website/src/lib/api-helpers.ts`

- [ ] **Step 1: Replace all `makeSupabaseXxxRepository(supabase)` calls**

In every `runXxxEffect` function, replace:
```typescript
// OLD
const supabase = createSupabaseServerClient(context)!
const supabaseRepo = makeSupabaseProjectsRepository(supabase)
```

With:
```typescript
// NEW
const neonRepo = makeNeonProjectsRepository(context)
```

And in `Effect.provideService`, change the second argument:
```typescript
// OLD
Effect.provideService(IProjectsRepository, supabaseRepo),
// NEW
Effect.provideService(IProjectsRepository, neonRepo),
```

Replace in ALL these functions: `runAuthEffect`, `runProjectsEffect`, `runSkillsEffect`, `runPromptsEffect`, `runAgentsEffect`, `runInvitationsEffect`, `runProfilesEffect`, `runCompaniesEffect`, `runSuperAdminEffect`, `runBrandingEffect`, `runBillingEffect`, `runSafetyEffect`, `runAnalyticsEffect`, `runSuperAdminOpsEffect`, `runCompanyAdminOpsEffect`, `runNotificationsEffect`.

For `runAuthEffect`: keep `makeNeonAuthRepository(context)` (already migrated).
For `runAgentsEffect`: replace `createSupabaseAgentsRepository(supabase)` with `makeNeonAgentsRepository(context)`.

- [ ] **Step 2: Remove `createSupabaseServerClient` import and usage**

Remove `import { createSupabaseServerClient } from "@/lib/supabase/server"` at the top.
Remove `const supabase = createSupabaseServerClient(context)!;` from every `runXxxEffect` function.

- [ ] **Step 3: Run type check**

Run: `cd apps/website && pnpm check`
Expected: No new TypeScript errors. Any errors about missing exports — fix the corresponding `index.ts` file.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/lib/api-helpers.ts
git commit -m "refactor(website): switch all runXxxEffect to use Neon adapters"
```

---

### Task 7: Delete all Supabase repository files and clean up

**Files to delete:**
- `apps/website/src/domain/projects/projects.repository.supabase.ts`
- `apps/website/src/domain/skills/skills.repository.supabase.ts`
- `apps/website/src/domain/prompts/prompts.repository.supabase.ts`
- `apps/website/src/domain/companies/companies.repository.supabase.ts`
- `apps/website/src/domain/invitations/invitations.repository.supabase.ts`
- `apps/website/src/domain/notifications/notifications.repository.supabase.ts`
- `apps/website/src/domain/billing/billing.repository.supabase.ts`
- `apps/website/src/domain/branding/branding.repository.supabase.ts`
- `apps/website/src/domain/safety/safety.repository.supabase.ts`
- `apps/website/src/domain/analytics/analytics.repository.supabase.ts`
- `apps/website/src/domain/super-admin/super-admin.repository.supabase.ts`
- `apps/website/src/domain/super-admin-ops/super-admin-ops.repository.supabase.ts`
- `apps/website/src/domain/company-admin-ops/company-admin-ops.repository.supabase.ts`
- `apps/website/src/lib/supabase/server.ts` (if only used for repository injection; verify first with grep)

- [ ] **Step 1: Grep to check if `lib/supabase/server.ts` is used anywhere else**

Run: `rg "from \"@/lib/supabase/server\"" apps/website/src/`
If nothing else imports it, it can be deleted too.

- [ ] **Step 2: Delete all supabase repository files**

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(website): remove all Supabase repository adapters, pure Neon-only"
```

---

### Task 8: Final verification

**Files:**
- Test: `apps/website/` (full test suite)

- [ ] **Step 1: Run full test suite**

Run: `cd apps/website && pnpm test`
Expected: 223 tests pass (same as baseline).

- [ ] **Step 2: Run type check**

Run: `cd apps/website && pnpm check`
Expected: No TypeScript errors.

- [ ] **Step 3: Run build**

Run: `cd apps/website && pnpm build`
Expected: Build succeeds.

- [ ] **Step 4: Run ESLint**

Run: `pnpm lint` (root)
Expected: No new lint errors introduced by migration.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(website): final verification — all tests pass, build succeeds"
```

---

## Appendix: SQL Identifier Mapping Reference

| Supabase call | Raw SQL equivalent |
|---|---|
| `.from("projects").insert({name, user_id}).select().single()` | `INSERT INTO public.projects (name, user_id) VALUES ($1, $2) RETURNING *` |
| `.from("projects").select("*").eq("company_id", id)` | `SELECT * FROM public.projects WHERE company_id = $1` |
| `.from("projects").update({name}).eq("id", id).select().single()` | `UPDATE public.projects SET name = $1 WHERE id = $2 RETURNING *` |
| `.from("projects").delete().eq("id", id)` | `DELETE FROM public.projects WHERE id = $1` |
| `.from("invitations").select("*, companies(name)").eq("token_hash", h).single()` | `SELECT i.*, c.name AS company_name FROM public.invitations i JOIN public.companies c ON c.id = i.company_id WHERE i.token_hash = $1` |
| `.from("memberships").select("*", {count:"exact", head:true}).eq(...)` | `SELECT COUNT(*) FROM public.company_memberships WHERE company_id = $1 AND status = 'active'` |
| `supabase.auth.getSession()` | `getCurrentUserId(context)` → `verifySession(cookieToken).userId` |

## Key Error Handling Patterns

Every `Effect.tryPromise` catch block must preserve domain error types:
```typescript
catch: (err: any) => {
  if (err instanceof UnauthorizedError) return err
  if (err instanceof DomainSpecificError) return err
  return new DomainSpecificError({ message: err?.message || "Unknown error occurred" })
}
```