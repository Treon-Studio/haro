# Super Admin Security & Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full Super Admin security, per-tenant feature flags, platform status banner, and automated crons.

**Architecture:** We use an Effect-TS domain-driven design. We write migrations, create separate folders for `feature-flags` and `status` domains, set up REST routes mapping domain programs, and build beautiful, responsive React 19 UI modules.

**Tech Stack:** Astro 5, React 19, Supabase RLS, Effect-TS, Lucide Icons, Tailwind CSS v4.

---

## File Structure & Touch-Map

```
apps/website/
  supabase/migrations/
    20260624000011_create_super_admin_automation.sql
  src/
    domain/
      super-admin-ops/ (types, errors, repository, repository.supabase, programs, index)
    pages/
      api/
        super-admin/
          features.ts
          status.ts
      super-admin/
        tenants/[id]/features.astro
    components/
      PlatformStatusBanner.tsx
    blocks/
      super-admin/
        FeatureFlagToggler.tsx
    lib/
      api-helpers.ts
```

---

## Task Decompositions

### Task P2.13: Super Admin Automation Migration (EPIC-09)

**Files:**
- Create: `apps/website/supabase/migrations/20260624000011_create_super_admin_automation.sql`

- [ ] **Step 1: Write migration SQL**
Create `tenant_feature_flags` and `platform_status` tables. Configure RLS: `tenant_feature_flags` is managed exclusively by super admins; `platform_status` can be read by anyone but only modified by super admins.

```sql
-- Create Tenant Feature Flags Table
create table if not exists public.tenant_feature_flags (
  company_id uuid not null references public.companies(id) on delete cascade,
  flag text not null,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (company_id, flag)
);

-- Enable RLS
alter table public.tenant_feature_flags enable row level security;

create policy "Super admins can manage feature flags" on public.tenant_feature_flags
  for all using (
    exists (
      select 1 from public.company_memberships
      where user_id = auth.uid()
        and role = 'super_admin'
        and status = 'active'
    )
  );

create policy "Members can view their company feature flags" on public.tenant_feature_flags
  for select using (
    exists (
      select 1 from public.company_memberships
      where company_id = tenant_feature_flags.company_id
        and user_id = auth.uid()
        and status = 'active'
    )
  );


-- Create Platform Status Banner Table (Single active row)
create table if not exists public.platform_status (
  id uuid default gen_random_uuid() primary key,
  message text not null,
  is_active boolean not null default true,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  expected_resolution text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.platform_status enable row level security;

create policy "Super admins can manage platform status" on public.platform_status
  for all using (
    exists (
      select 1 from public.company_memberships
      where user_id = auth.uid()
        and role = 'super_admin'
        and status = 'active'
    )
  );

create policy "Anyone can read platform status" on public.platform_status
  for select using (true);

-- Triggers for updated_at
create trigger handle_tenant_feature_flags_updated_at
  before update on public.tenant_feature_flags
  for each row
  execute procedure public.handle_updated_at();

create trigger handle_platform_status_updated_at
  before update on public.platform_status
  for each row
  execute procedure public.handle_updated_at();
```

- [ ] **Step 2: Commit**
```bash
git add apps/website/supabase/migrations/20260624000011_create_super_admin_automation.sql
git commit -m "migration: create_super_admin_automation"
```

---

### Task P2.14: Super Admin Ops Domain Layer (EPIC-09)

**Files:**
- Create: `apps/website/src/domain/super-admin-ops/super-admin-ops.types.ts`
- Create: `apps/website/src/domain/super-admin-ops/super-admin-ops.errors.ts`
- Create: `apps/website/src/domain/super-admin-ops/super-admin-ops.repository.ts`
- Create: `apps/website/src/domain/super-admin-ops/super-admin-ops.repository.supabase.ts`
- Create: `apps/website/src/domain/super-admin-ops/super-admin-ops.programs.ts`
- Create: `apps/website/src/domain/super-admin-ops/index.ts`
- Test: `apps/website/src/domain/super-admin-ops/__tests__/super-admin-ops.programs.test.ts`

- [ ] **Step 1: Create types, errors, and repository interfaces**

`super-admin-ops.types.ts`:
```typescript
export type TFeatureFlag = {
  readonly companyId: string
  readonly flag: string
  readonly enabled: boolean
  readonly config: Record<string, any>
  readonly updatedAt: string
}

export type TPlatformStatus = {
  readonly id: string
  readonly message: string
  readonly isActive: boolean
  readonly severity: "info" | "warning" | "critical"
  readonly expectedResolution: string | null
  readonly createdAt: string
  readonly updatedAt: string
}
```

`super-admin-ops.errors.ts`:
```typescript
import { Data } from "effect"
export class OpsFetchError extends Data.TaggedError("OpsFetchError")<{ readonly message: string }> {}
export class OpsUpdateError extends Data.TaggedError("OpsUpdateError")<{ readonly message: string }> {}
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{ readonly message: string }> {}
```

`super-admin-ops.repository.ts`:
```typescript
import { Context, Effect } from "effect"
import type { TFeatureFlag, TPlatformStatus } from "./super-admin-ops.types"
import { OpsFetchError, OpsUpdateError, UnauthorizedError } from "./super-admin-ops.errors"

export class ISuperAdminOpsRepository extends Context.Tag("ISuperAdminOpsRepository")<
  ISuperAdminOpsRepository,
  {
    readonly getFeatureFlags: (companyId: string) => Effect.Effect<readonly TFeatureFlag[], OpsFetchError | UnauthorizedError>
    readonly updateFeatureFlag: (companyId: string, flag: string, enabled: boolean) => Effect.Effect<TFeatureFlag, OpsUpdateError | UnauthorizedError>
    readonly getPlatformStatus: () => Effect.Effect<TPlatformStatus | null, OpsFetchError>
    readonly updatePlatformStatus: (message: string, isActive: boolean, severity: "info" | "warning" | "critical", expectedResolution?: string | null) => Effect.Effect<TPlatformStatus, OpsUpdateError | UnauthorizedError>
  }
> () {}
```

- [ ] **Step 2: Create Supabase repository implementation**

`super-admin-ops.repository.supabase.ts`:
```typescript
import { Effect } from "effect"
import type { SupabaseClient } from "@supabase/supabase-js"
import { ISuperAdminOpsRepository } from "./super-admin-ops.repository"
import type { TFeatureFlag, TPlatformStatus } from "./super-admin-ops.types"
import { OpsFetchError, OpsUpdateError, UnauthorizedError } from "./super-admin-ops.errors"

const mapFlagData = (data: any): TFeatureFlag => ({
  companyId: data.company_id,
  flag: data.flag,
  enabled: data.enabled,
  config: data.config || {},
  updatedAt: data.updated_at,
})

const mapStatusData = (data: any): TPlatformStatus => ({
  id: data.id,
  message: data.message,
  isActive: data.is_active,
  severity: data.severity as "info" | "warning" | "critical",
  expectedResolution: data.expected_resolution,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
})

export const makeSupabaseSuperAdminOpsRepository = (
  supabase: SupabaseClient,
): ISuperAdminOpsRepository["Type"] => ({
  getFeatureFlags: (companyId) =>
    Effect.tryPromise({
      try: async () => {
        const { data, error } = await supabase
          .from("tenant_feature_flags")
          .select("*")
          .eq("company_id", companyId)

        if (error) throw new OpsFetchError({ message: error.message })
        if (!data) return []

        return data.map(mapFlagData)
      },
      catch: (err: any) => {
        if (err instanceof OpsFetchError) return err
        return new OpsFetchError({ message: err?.message || "Unknown error" })
      },
    }),

  updateFeatureFlag: (companyId, flag, enabled) =>
    Effect.tryPromise({
      try: async () => {
        const { data, error } = await supabase
          .from("tenant_feature_flags")
          .upsert({ company_id: companyId, flag, enabled })
          .select()
          .single()

        if (error || !data) throw new OpsUpdateError({ message: error?.message || "Failed to update flag" })
        return mapFlagData(data)
      },
      catch: (err: any) => {
        if (err instanceof OpsUpdateError) return err
        return new OpsUpdateError({ message: err?.message || "Unknown error" })
      },
    }),

  getPlatformStatus: () =>
    Effect.tryPromise({
      try: async () => {
        const { data, error } = await supabase
          .from("platform_status")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)

        if (error) throw new OpsFetchError({ message: error.message })
        if (!data || data.length === 0) return null

        return mapStatusData(data[0])
      },
      catch: (err: any) => {
        if (err instanceof OpsFetchError) return err
        return new OpsFetchError({ message: err?.message || "Unknown error" })
      },
    }),

  updatePlatformStatus: (message, isActive, severity, expectedResolution) =>
    Effect.tryPromise({
      try: async () => {
        // Disable old statuses
        await supabase.from("platform_status").update({ is_active: false }).eq("is_active", true)

        const { data, error } = await supabase
          .from("platform_status")
          .insert({
            message,
            is_active: isActive,
            severity,
            expected_resolution: expectedResolution || null,
          })
          .select()
          .single()

        if (error || !data) throw new OpsUpdateError({ message: error?.message || "Failed to update status" })
        return mapStatusData(data)
      },
      catch: (err: any) => {
        if (err instanceof OpsUpdateError) return err
        return new OpsUpdateError({ message: err?.message || "Unknown error" })
      },
    }),
})
```

- [ ] **Step 3: Create programs & barrel index**

`super-admin-ops.programs.ts`:
```typescript
import { Effect, pipe } from "effect"
import { ISuperAdminOpsRepository } from "./super-admin-ops.repository"
import type { TFeatureFlag, TPlatformStatus } from "./super-admin-ops.types"
import { OpsFetchError, OpsUpdateError, UnauthorizedError } from "./super-admin-ops.errors"

export type OpsProgramError = OpsFetchError | OpsUpdateError | UnauthorizedError

export const getFeatureFlagsProgram = (
  companyId: string,
): Effect.Effect<readonly TFeatureFlag[], OpsProgramError, ISuperAdminOpsRepository> =>
  pipe(
    ISuperAdminOpsRepository,
    Effect.flatMap((repo) => repo.getFeatureFlags(companyId)),
  )

export const updateFeatureFlagProgram = (
  companyId: string,
  flag: string,
  enabled: boolean,
): Effect.Effect<TFeatureFlag, OpsProgramError, ISuperAdminOpsRepository> =>
  pipe(
    ISuperAdminOpsRepository,
    Effect.flatMap((repo) => repo.updateFeatureFlag(companyId, flag, enabled)),
  )

export const getPlatformStatusProgram = (): Effect.Effect<TPlatformStatus | null, OpsProgramError, ISuperAdminOpsRepository> =>
  pipe(
    ISuperAdminOpsRepository,
    Effect.flatMap((repo) => repo.getPlatformStatus()),
  )

export const updatePlatformStatusProgram = (
  message: string,
  isActive: boolean,
  severity: "info" | "warning" | "critical",
  expectedResolution?: string | null,
): Effect.Effect<TPlatformStatus, OpsProgramError, ISuperAdminOpsRepository> =>
  pipe(
    ISuperAdminOpsRepository,
    Effect.flatMap((repo) => repo.updatePlatformStatus(message, isActive, severity, expectedResolution)),
  )
```

`index.ts`:
```typescript
export * from "./super-admin-ops.types"
export * from "./super-admin-ops.errors"
export * from "./super-admin-ops.repository"
export * from "./super-admin-ops.repository.supabase"
export * from "./super-admin-ops.programs"
```

- [ ] **Step 4: Write failing unit test**

`__tests__/super-admin-ops.programs.test.ts`:
```typescript
import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { ISuperAdminOpsRepository } from "../super-admin-ops.repository"
import { getFeatureFlagsProgram, updateFeatureFlagProgram, getPlatformStatusProgram, updatePlatformStatusProgram } from "../super-admin-ops.programs"
import type { TFeatureFlag, TPlatformStatus } from "../super-admin-ops.types"

const mockFlag: TFeatureFlag = {
  companyId: "company-1",
  flag: "self_guided_content",
  enabled: true,
  config: {},
  updatedAt: "now",
}

const mockStatus: TPlatformStatus = {
  id: "status-1",
  message: "Maintenance scheduled",
  isActive: true,
  severity: "warning",
  expectedResolution: "2 hours",
  createdAt: "now",
  updatedAt: "now",
}

const mockRepo = {
  getFeatureFlags: (companyId: string) => Effect.succeed([{ ...mockFlag, companyId }]),
  updateFeatureFlag: (companyId: string, flag: string, enabled: boolean) =>
    Effect.succeed({ ...mockFlag, companyId, flag, enabled }),
  getPlatformStatus: () => Effect.succeed(mockStatus),
  updatePlatformStatus: (message: string, isActive: boolean, severity: "info" | "warning" | "critical", expectedResolution?: string | null) =>
    Effect.succeed({ ...mockStatus, message, isActive, severity, expectedResolution: expectedResolution || null }),
} satisfies ISuperAdminOpsRepository["Type"]

const runWithRepo = (effect: any): Promise<any> =>
  Effect.runPromise(effect.pipe(Effect.provideService(ISuperAdminOpsRepository, mockRepo)))

describe("getFeatureFlagsProgram", () => {
  it("fetches corporate B2B feature flags", async () => {
    const result = await runWithRepo(getFeatureFlagsProgram("company-1"))
    expect(result).toHaveLength(1)
    expect(result[0].flag).toBe("self_guided_content")
    expect(result[0].enabled).toBe(true)
  })
})

describe("updateFeatureFlagProgram", () => {
  it("updates and toggles a B2B company feature flag", async () => {
    const result = await runWithRepo(updateFeatureFlagProgram("company-1", "bookmarks", false))
    expect(result.companyId).toBe("company-1")
    expect(result.flag).toBe("bookmarks")
    expect(result.enabled).toBe(false)
  })
})

describe("getPlatformStatusProgram", () => {
  it("fetches active system-wide maintenance banners", async () => {
    const result = await runWithRepo(getPlatformStatusProgram())
    expect(result?.message).toBe("Maintenance scheduled")
    expect(result?.severity).toBe("warning")
  })
})

describe("updatePlatformStatusProgram", () => {
  it("creates and broadcasts new platform statuses", async () => {
    const result = await runWithRepo(updatePlatformStatusProgram("Major database upgrade", true, "critical", "1 hour"))
    expect(result.message).toBe("Major database upgrade")
    expect(result.severity).toBe("critical")
    expect(result.expectedResolution).toBe("1 hour")
  })
})
```

- [ ] **Step 5: Run tests and verify they pass**
Run: `pnpm test src/domain/super-admin-ops/`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git add apps/website/src/domain/super-admin-ops/
git commit -m "feat(domain): super admin platform automation and flags domain"
```

---

### Task P2.15: Super Admin Automation REST Routes & API Helpers (EPIC-09)

**Files:**
- Modify: `apps/website/src/lib/api-helpers.ts`
- Create: `apps/website/src/pages/api/super-admin/features.ts`
- Create: `apps/website/src/pages/api/super-admin/status.ts`

- [ ] **Step 1: Update API helpers with `runSuperAdminOpsEffect`**
Add `ISuperAdminOpsRepository` and `makeSupabaseSuperAdminOpsRepository` imports and append `runSuperAdminOpsEffect`.

```typescript
import { ISuperAdminOpsRepository, makeSupabaseSuperAdminOpsRepository } from "@/domain/super-admin-ops/index"

export const runSuperAdminOpsEffect = <A>(
  context: APIContext,
  effect: Effect.Effect<A, any, ISuperAdminOpsRepository>,
): Promise<A> => {
  const supabase = createSupabaseServerClient(context)!
  const supabaseRepo = makeSupabaseSuperAdminOpsRepository(supabase)
  const logger = context.locals.logger
  const traced = effect.pipe(Effect.provideService(ISuperAdminOpsRepository, supabaseRepo))
  return logger?.withSpan
    ? Effect.runPromise(logger.withSpan("super-admin-ops", () => traced))
    : Effect.runPromise(traced)
}
```

- [ ] **Step 2: Create B2B feature flags REST route**

`api/super-admin/features.ts`:
```typescript
import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { getFeatureFlagsProgram, updateFeatureFlagProgram } from "@/domain/super-admin-ops/super-admin-ops.programs"
import { makeMeta, jsonOk, jsonError, runSuperAdminOpsEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { ValidationError } from "@/shared/errors/application.errors"

export const GET: APIRoute = async (context) => {
  const meta = makeMeta()
  const url = new URL(context.request.url)
  const companyId = url.searchParams.get("companyId")

  if (!companyId) {
    return jsonError({ _tag: "ValidationError", message: "companyId query param is required" }, meta, HTTP_STATUS.BAD_REQUEST)
  }

  const program = pipe(
    getFeatureFlagsProgram(companyId),
    Effect.map((data) => jsonOk(data, meta)),
    Effect.catchTags({
      UnauthorizedError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
      OpsFetchError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runSuperAdminOpsEffect(context, program)
}

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: () => new ValidationError({ issues: "Invalid JSON body" }),
    }),
    Effect.flatMap((body: any) => {
      if (!body.companyId || !body.flag || body.enabled === undefined) {
        return Effect.fail(new ValidationError({ issues: "companyId, flag, and enabled are required" }))
      }
      return updateFeatureFlagProgram(body.companyId, body.flag, body.enabled)
    }),
    Effect.map((data) => jsonOk(data, meta)),
    Effect.catchTags({
      ValidationError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.issues }, meta, HTTP_STATUS.BAD_REQUEST)),
      UnauthorizedError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
      OpsUpdateError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runSuperAdminOpsEffect(context, program)
}
```

- [ ] **Step 3: Create Platform status REST route**

`api/super-admin/status.ts`:
```typescript
import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { getPlatformStatusProgram, updatePlatformStatusProgram } from "@/domain/super-admin-ops/super-admin-ops.programs"
import { makeMeta, jsonOk, jsonError, runSuperAdminOpsEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { ValidationError } from "@/shared/errors/application.errors"

export const GET: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    getPlatformStatusProgram(),
    Effect.map((data) => jsonOk(data, meta)),
    Effect.catchTags({
      OpsFetchError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runSuperAdminOpsEffect(context, program)
}

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: () => new ValidationError({ issues: "Invalid JSON body" }),
    }),
    Effect.flatMap((body: any) => {
      if (!body.message || body.isActive === undefined || !body.severity) {
        return Effect.fail(new ValidationError({ issues: "message, isActive, and severity are required" }))
      }
      return updatePlatformStatusProgram(body.message, body.isActive, body.severity, body.expectedResolution)
    }),
    Effect.map((data) => jsonOk(data, meta)),
    Effect.catchTags({
      ValidationError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.issues }, meta, HTTP_STATUS.BAD_REQUEST)),
      UnauthorizedError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
      OpsUpdateError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runSuperAdminOpsEffect(context, program)
}
```

- [ ] **Step 4: Run type check**
Run: `pnpm check`
Expected: SUCCESS

- [ ] **Step 5: Commit**
```bash
git add apps/website/src/lib/api-helpers.ts apps/website/src/pages/api/super-admin/
git commit -m "feat(api): super admin platform automation and features REST endpoints"
```

---

### Task P2.16: Real-time Feature Flags and Global Status Banner UI (EPIC-09)

**Files:**
- Create: `apps/website/blocks/super-admin/FeatureFlagToggler.tsx`
- Create: `apps/website/src/components/PlatformStatusBanner.tsx`
- Modify: `apps/website/src/layouts/BaseLayout.astro`
- Create: `apps/website/src/pages/super-admin/tenants/[id]/features.astro`

- [ ] **Step 1: Build Feature Flag Toggler block**

`blocks/super-admin/FeatureFlagToggler.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@treonstudio/bungas-core/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react'

type TFlag = {
  flag: string
  enabled: boolean
}

export function FeatureFlagToggler({ companyId }: { companyId: string }) {
  const [flags, setFlags] = useState<TFlag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null) // flag currently toggling

  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchFlags = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/super-admin/features?companyId=${companyId}`)
      const result = await res.json()
      if (result.success && result.data) {
        setFlags(result.data)
      }
    } catch (err) {
      console.error('Error fetching flags', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchFlags()
  }, [companyId])

  const handleToggle = async (flag: string, currentEnabled: boolean) => {
    setIsSubmitting(flag)
    setSuccess(null)
    setError(null)

    try {
      const res = await fetch('/api/super-admin/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, flag, enabled: !currentEnabled })
      })
      const result = await res.json()
      if (result.success) {
        setSuccess(`Sukses merubah status fitur "${flag}"!`)
        fetchFlags()
      } else {
        setError(result.error?.message || 'Gagal mengubah fitur')
      }
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setIsSubmitting(null)
    }
  }

  // Pre-configured B2B extended list of modular features (Mood tracker, bookmarks, goals, custom agents etc.)
  const ALL_B2B_FLAGS = [
    { key: 'mood_checkin', label: 'Clinical Mood Check-Ins (EPIC-14)', desc: 'Mengaktifkan form popup perasaan harian bagi karyawan saat chat dimulai.' },
    { key: 'goals_library', label: 'Mental Wellness Goals (EPIC-15)', desc: 'Membuka tab target perbaikan kebiasaan harian tim.' },
    { key: 'bookmarks', label: 'Bookmark & Favorite Messages', desc: 'Mengizinkan pengguna menyimpan pesan klinis penenang ke arsip pribadi.' },
    { key: 'skills_library', label: 'Clinical Self-Guided Exercises', desc: 'Membuka pustaka modul meditasi dan pernapasan mandiri bagi tim.' }
  ]

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center min-h-[300px]">
        <Loader2 className="h-10 w-10 text-brand-primary animate-spin mb-4" />
        <h3 className="font-bold">Memuat Fitur Tenant...</h3>
      </div>
    )
  }

  return (
    <Card className="bg-surface-primary border-border-primary text-text-primary">
      <CardHeader>
        <CardTitle className="text-xl font-bold">B2B Feature Toggles</CardTitle>
        <CardDescription className="text-text-secondary text-xs">Aktifkan atau matikan kapabilitas fungsionalitas modul-modul modular khusus untuk tenant B2B ini.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {success && (
          <div className="flex items-center gap-2 rounded bg-green-500/10 border border-green-500/20 p-3 text-xs text-green-500">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-500">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="divide-y divide-border-primary">
          {ALL_B2B_FLAGS.map((f) => {
            const matchedFlag = flags.find(row => row.flag === f.key)
            const isEnabled = matchedFlag ? matchedFlag.enabled : false

            return (
              <div key={f.key} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div className="space-y-1 pr-4">
                  <h4 className="font-bold text-sm text-text-primary">{f.label}</h4>
                  <p className="text-xs text-text-secondary leading-relaxed">{f.desc}</p>
                </div>

                <Button
                  onClick={() => handleToggle(f.key, isEnabled)}
                  disabled={isSubmitting !== null}
                  className={cn(
                    "text-xs font-bold px-3 py-1.5 h-8 border-none text-white",
                    isEnabled
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-green-600 hover:bg-green-700"
                  )}
                >
                  {isSubmitting === f.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isEnabled ? (
                    'Disable fiture'
                  ) : (
                    'Enable fiture'
                  )}
                </Button>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Build Global Platform Status Banner component**

`components/PlatformStatusBanner.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Info, ShieldAlert, X } from 'lucide-react'
import { cn } from '@treonstudio/bungas-core/lib/utils'

type TPlatformStatus = {
  id: string
  message: string
  is_active: boolean
  severity: 'info' | 'warning' | 'critical'
  expected_resolution: string | null
}

export function PlatformStatusBanner() {
  const [status, setStatus] = useState<TPlatformStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/super-admin/status')
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data) {
          setStatus(result.data)
        }
      })
      .catch(() => {})
  }, [])

  if (!status || dismissed) return null

  const bgClass =
    status.severity === 'critical' ? 'bg-red-600 text-white' :
    status.severity === 'warning' ? 'bg-amber-500 text-black' :
    'bg-blue-600 text-white'

  const Icon =
    status.severity === 'critical' ? ShieldAlert :
    status.severity === 'warning' ? AlertTriangle :
    Info

  return (
    <div className={cn("w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold leading-relaxed shrink-0 shadow-sm z-50", bgClass)}>
      <div className="flex items-center gap-2 mx-auto">
        <Icon className="h-4 w-4 shrink-0" />
        <span>
          {status.message}
          {status.expected_resolution && ` (Estimasi perbaikan: ${status.expected_resolution})`}
        </span>
      </div>
      <button onClick={() => setDismissed(true)} className="p-1 hover:bg-black/10 rounded-full border-none bg-transparent cursor-pointer text-inherit shrink-0">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Render Platform Status Banner inside layout shell**
Add `<PlatformStatusBanner client:only="react" />` to the top of `src/layouts/BaseLayout.astro`.

`layouts/BaseLayout.astro`:
```astro
---
import '@/styles/globals.css'
import { PlatformStatusBanner } from '@/components/PlatformStatusBanner'

export interface Props {
    title?: string
    description?: string
}

const { title = 'Tenang - Build Better', description = 'A modern marketing site built with Astro' } = Astro.props
---

<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={description} />
    </head>
    <body class="flex flex-col min-h-screen overflow-x-hidden">
        <!-- Render globally on all pages -->
        <PlatformStatusBanner client:only="react" />
        <div class="flex-1 flex flex-col">
          <slot />
        </div>
    </body>
</html>
```

- [ ] **Step 4: Create tenant feature configuration page**

`src/pages/super-admin/tenants/[id]/features.astro`:
```astro
---
import SuperAdminLayout from '@/layouts/SuperAdminLayout.astro'
import { FeatureFlagToggler } from '@/../blocks/super-admin/FeatureFlagToggler'

const companyId = Astro.params.id

if (!companyId) {
  return Astro.redirect('/super-admin/tenants')
}
---

<SuperAdminLayout title="Features Configuration - Super Admin Console">
  <div class="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
    <div>
      <h1 class="text-3xl font-extrabold tracking-tight">Tenant Module Configuration</h1>
      <p class="text-sm text-text-secondary">Ubah ketersediaan fungsionalitas modul-modul modular khusus untuk tenant B2B ini.</p>
    </div>

    <FeatureFlagToggler companyId={companyId} client:load />
  </div>
</SuperAdminLayout>
```

- [ ] **Step 5: Verify global diagnostics**
Run: `pnpm check && pnpm test`
Expected: SUCCESS

- [ ] **Step 6: Commit**
```bash
git add apps/website/blocks/super-admin/FeatureFlagToggler.tsx apps/website/src/components/PlatformStatusBanner.tsx apps/website/src/layouts/BaseLayout.astro apps/website/src/pages/super-admin/tenants/
git commit -m "feat(ui): per-tenant feature toggles and global platform maintenance banners"
```
