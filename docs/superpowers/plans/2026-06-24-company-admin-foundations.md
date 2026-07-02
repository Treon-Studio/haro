# Company Admin Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the remaining B2B Company Admin Console features: tenant-scoped Activity Logs and Support Tickets.

**Architecture:** We use an Effect-TS domain-driven design. We write migrations, create separate folders for `activity-logs` and `support` domains, set up REST routes mapping domain programs, and build beautiful, responsive React 19 UI modules.

**Tech Stack:** Astro 5, React 19, Supabase RLS, Effect-TS, Lucide Icons, Tailwind CSS v4.

---

## File Structure & Touch-Map

```
apps/website/
  supabase/migrations/
    20260624000012_create_support_tickets.sql
  src/
    domain/
      company-admin-ops/ (types, errors, repository, repository.supabase, programs, index)
    pages/
      api/
        companies/[id]/activity-log.ts
        companies/[id]/support.ts
      admin/
        activity-log.astro
        support.astro
    blocks/
      admin/
        ActivityLogTable.tsx
        SupportTicketLogger.tsx
    lib/
      api-helpers.ts
```

---

## Task Decompositions

### Task P2.17: Support Tickets Migration (EPIC-05)

**Files:**
- Create: `apps/website/supabase/migrations/20260624000012_create_support_tickets.sql`

- [ ] **Step 1: Write migration SQL**
Create `support_tickets` table linked to `company_id`. Configure RLS: only company owners and administrators can manage (view, create) support tickets for their company.

```sql
-- Create B2B Support Tickets Table
create table if not exists public.support_tickets (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  subject text not null,
  description text not null,
  priority text not null check (priority in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.support_tickets enable row level security;

-- Indexing for speed
create index idx_support_tickets_company_id on public.support_tickets(company_id);

-- RLS: select/insert/update restricted to corporate owners and admins
create policy "Admins can manage support tickets" on public.support_tickets
  for all using (
    exists (
      select 1 from public.company_memberships
      where company_id = support_tickets.company_id
        and user_id = auth.uid()
        and role in ('owner', 'admin', 'super_admin')
        and status = 'active'
    )
  );

-- Triggers for updated_at
create trigger handle_support_tickets_updated_at
  before update on public.support_tickets
  for each row
  execute procedure public.handle_updated_at();
```

- [ ] **Step 2: Commit**
```bash
git add apps/website/supabase/migrations/20260624000012_create_support_tickets.sql
git commit -m "migration: create_support_tickets"
```

---

### Task P2.18: Company Admin Ops Domain Layer (EPIC-05)

**Files:**
- Create: `apps/website/src/domain/company-admin-ops/company-admin-ops.types.ts`
- Create: `apps/website/src/domain/company-admin-ops/company-admin-ops.errors.ts`
- Create: `apps/website/src/domain/company-admin-ops/company-admin-ops.repository.ts`
- Create: `apps/website/src/domain/company-admin-ops/company-admin-ops.repository.supabase.ts`
- Create: `apps/website/src/domain/company-admin-ops/company-admin-ops.programs.ts`
- Create: `apps/website/src/domain/company-admin-ops/index.ts`
- Test: `apps/website/src/domain/company-admin-ops/__tests__/company-admin-ops.programs.test.ts`

- [ ] **Step 1: Create types, errors, and repository interfaces**

`company-admin-ops.types.ts`:
```typescript
import type { TAuditLogDto } from "@/domain/super-admin/index" // reuse audit DTO shape

export type TSupportTicket = {
  readonly id: string
  readonly companyId: string
  readonly subject: string
  readonly description: string
  readonly priority: "low" | "medium" | "high"
  readonly status: "open" | "in_progress" | "resolved" | "closed"
  readonly createdAt: string
  readonly updatedAt: string
}

export type TSupportTicketDto = {
  readonly id: string
  readonly company_id: string
  readonly subject: string
  readonly description: string
  readonly priority: string
  readonly status: string
  readonly created_at: string
  readonly updated_at: string
}

export const toSupportTicketDto = (ticket: TSupportTicket): TSupportTicketDto => ({
  id: ticket.id,
  company_id: ticket.companyId,
  subject: ticket.subject,
  description: ticket.description,
  priority: ticket.priority,
  status: ticket.status,
  created_at: ticket.createdAt,
  updated_at: ticket.updatedAt,
})
```

`company-admin-ops.errors.ts`:
```typescript
import { Data } from "effect"
export class AdminOpsFetchError extends Data.TaggedError("AdminOpsFetchError")<{ readonly message: string }> {}
export class AdminOpsUpdateError extends Data.TaggedError("AdminOpsUpdateError")<{ readonly message: string }> {}
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{ readonly message: string }> {}
```

`company-admin-ops.repository.ts`:
```typescript
import { Context, Effect } from "effect"
import type { TSupportTicket } from "./company-admin-ops.types"
import type { THandoff } from "@/domain/super-admin/super-admin.types" // reuse audit type
import { AdminOpsFetchError, AdminOpsUpdateError, UnauthorizedError } from "./company-admin-ops.errors"

export class ICompanyAdminOpsRepository extends Context.Tag("ICompanyAdminOpsRepository")<
  ICompanyAdminOpsRepository,
  {
    readonly getActivityLogs: (companyId: string) => Effect.Effect<readonly any[], AdminOpsFetchError | UnauthorizedError>
    readonly createSupportTicket: (companyId: string, subject: string, description: string, priority: "low" | "medium" | "high") => Effect.Effect<TSupportTicket, AdminOpsUpdateError | UnauthorizedError>
    readonly getSupportTickets: (companyId: string) => Effect.Effect<readonly TSupportTicket[], AdminOpsFetchError | UnauthorizedError>
  }
> () {}
```

- [ ] **Step 2: Create Supabase repository implementation**

`company-admin-ops.repository.supabase.ts`:
```typescript
import { Effect } from "effect"
import type { SupabaseClient } from "@supabase/supabase-js"
import { ICompanyAdminOpsRepository } from "./company-admin-ops.repository"
import type { TSupportTicket } from "./company-admin-ops.types"
import { AdminOpsFetchError, AdminOpsUpdateError, UnauthorizedError } from "./company-admin-ops.errors"

const mapTicketData = (data: any): TSupportTicket => ({
  id: data.id,
  companyId: data.company_id,
  subject: data.subject,
  description: data.description,
  priority: data.priority as "low" | "medium" | "high",
  status: data.status as "open" | "in_progress" | "resolved" | "closed",
  createdAt: data.created_at,
  updatedAt: data.updated_at,
})

export const makeSupabaseCompanyAdminOpsRepository = (
  supabase: SupabaseClient,
): ICompanyAdminOpsRepository["Type"] => ({
  getActivityLogs: (companyId) =>
    Effect.tryPromise({
      try: async () => {
        // Fetch audit logs scoped to companyId
        const { data, error } = await supabase
          .from("audit_log")
          .select("*")
          .eq("company_id", companyId)
          .order("timestamp", { ascending: false })

        if (error) throw new AdminOpsFetchError({ message: error.message })
        return data || []
      },
      catch: (err: any) => {
        if (err instanceof AdminOpsFetchError) return err
        return new AdminOpsFetchError({ message: err?.message || "Unknown error" })
      },
    }),

  createSupportTicket: (companyId, subject, description, priority) =>
    Effect.tryPromise({
      try: async () => {
        const { data, error } = await supabase
          .from("support_tickets")
          .insert({
            company_id: companyId,
            subject,
            description,
            priority,
          })
          .select()
          .single()

        if (error || !data) throw new AdminOpsUpdateError({ message: error?.message || "Failed to create ticket" })
        return mapTicketData(data)
      },
      catch: (err: any) => {
        if (err instanceof AdminOpsUpdateError) return err
        return new AdminOpsUpdateError({ message: err?.message || "Unknown error" })
      },
    }),

  getSupportTickets: (companyId) =>
    Effect.tryPromise({
      try: async () => {
        const { data, error } = await supabase
          .from("support_tickets")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })

        if (error) throw new AdminOpsFetchError({ message: error.message })
        if (!data) return []

        return data.map(mapTicketData)
      },
      catch: (err: any) => {
        if (err instanceof AdminOpsFetchError) return err
        return new AdminOpsFetchError({ message: err?.message || "Unknown error" })
      },
    }),
})
```

- [ ] **Step 3: Create programs & barrel index**

`company-admin-ops.programs.ts`:
```typescript
import { Effect, pipe } from "effect"
import { ICompanyAdminOpsRepository } from "./company-admin-ops.repository"
import { toSupportTicketDto } from "./company-admin-ops.types"
import type { TSupportTicketDto } from "./company-admin-ops.types"
import { AdminOpsFetchError, AdminOpsUpdateError, UnauthorizedError } from "./company-admin-ops.errors"

export type AdminOpsProgramError = AdminOpsFetchError | AdminOpsUpdateError | UnauthorizedError

export const getActivityLogsProgram = (
  companyId: string,
): Effect.Effect<readonly any[], AdminOpsProgramError, ICompanyAdminOpsRepository> =>
  pipe(
    ICompanyAdminOpsRepository,
    Effect.flatMap((repo) => repo.getActivityLogs(companyId)),
  )

export const createSupportTicketProgram = (
  companyId: string,
  subject: string,
  description: string,
  priority: "low" | "medium" | "high",
): Effect.Effect<TSupportTicketDto, AdminOpsProgramError, ICompanyAdminOpsRepository> =>
  pipe(
    ICompanyAdminOpsRepository,
    Effect.flatMap((repo) => repo.createSupportTicket(companyId, subject, description, priority)),
    Effect.map(toSupportTicketDto),
  )

export const getSupportTicketsProgram = (
  companyId: string,
): Effect.Effect<readonly TSupportTicketDto[], AdminOpsProgramError, ICompanyAdminOpsRepository> =>
  pipe(
    ICompanyAdminOpsRepository,
    Effect.flatMap((repo) => repo.getSupportTickets(companyId)),
    Effect.map((tickets) => tickets.map(toSupportTicketDto)),
  )
```

`index.ts`:
```typescript
export * from "./company-admin-ops.types"
export * from "./company-admin-ops.errors"
export * from "./company-admin-ops.repository"
export * from "./company-admin-ops.repository.supabase"
export * from "./company-admin-ops.programs"
```

- [ ] **Step 4: Write failing unit test**

`__tests__/company-admin-ops.programs.test.ts`:
```typescript
import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { ICompanyAdminOpsRepository } from "../company-admin-ops.repository"
import { getActivityLogsProgram, createSupportTicketProgram, getSupportTicketsProgram } from "../company-admin-ops.programs"
import type { TSupportTicket } from "../company-admin-ops.types"

const mockTicket: TSupportTicket = {
  id: "ticket-1",
  companyId: "company-1",
  subject: "Billing issue",
  description: "Unable to upgrade plan",
  priority: "high",
  status: "open",
  createdAt: "now",
  updatedAt: "now",
}

const mockRepo = {
  getActivityLogs: (companyId: string) => Effect.succeed([{ message: "test audit log", company_id: companyId }]),
  createSupportTicket: (companyId: string, subject: string, description: string, priority: "low" | "medium" | "high") =>
    Effect.succeed({ ...mockTicket, companyId, subject, description, priority }),
  getSupportTickets: (companyId: string) => Effect.succeed([mockTicket]),
} satisfies ICompanyAdminOpsRepository["Type"]

const runWithRepo = (effect: any): Promise<any> =>
  Effect.runPromise(effect.pipe(Effect.provideService(ICompanyAdminOpsRepository, mockRepo)))

describe("getActivityLogsProgram", () => {
  it("fetches corporate B2B activity logs", async () => {
    const result = await runWithRepo(getActivityLogsProgram("company-1"))
    expect(result).toHaveLength(1)
    expect(result[0].company_id).toBe("company-1")
    expect(result[0].message).toBe("test audit log")
  })
})

describe("createSupportTicketProgram", () => {
  it("creates a support ticket for company admin", async () => {
    const result = await runWithRepo(createSupportTicketProgram("company-1", "Upgrade plan error", "Error code X-12", "medium"))
    expect(result.company_id).toBe("company-1")
    expect(result.subject).toBe("Upgrade plan error")
    expect(result.priority).toBe("medium")
    expect(result.status).toBe("open")
  })
})

describe("getSupportTicketsProgram", () => {
  it("fetches corporate support tickets", async () => {
    const result = await runWithRepo(getSupportTicketsProgram("company-1"))
    expect(result).toHaveLength(1)
    expect(result[0].company_id).toBe("company-1")
  })
})
```

- [ ] **Step 5: Run tests and verify they pass**
Run: `pnpm test src/domain/company-admin-ops/`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git add apps/website/src/domain/company-admin-ops/
git commit -m "feat(domain): B2B company admin activity log and support ticket domain"
```

---

### Task P2.19: Company Admin REST Routes & API Helpers (EPIC-05)

**Files:**
- Modify: `apps/website/src/lib/api-helpers.ts`
- Create: `apps/website/src/pages/api/companies/[id]/activity-log.ts`
- Create: `apps/website/src/pages/api/companies/[id]/support.ts`

- [ ] **Step 1: Update API helpers with `runCompanyAdminOpsEffect`**
Add `ICompanyAdminOpsRepository` and `makeSupabaseCompanyAdminOpsRepository` imports and append `runCompanyAdminOpsEffect`.

```typescript
import { ICompanyAdminOpsRepository, makeSupabaseCompanyAdminOpsRepository } from "@/domain/company-admin-ops/index"

export const runCompanyAdminOpsEffect = <A>(
  context: APIContext,
  effect: Effect.Effect<A, any, ICompanyAdminOpsRepository>,
): Promise<A> => {
  const supabase = createSupabaseServerClient(context)!
  const supabaseRepo = makeSupabaseCompanyAdminOpsRepository(supabase)
  const logger = context.locals.logger
  const traced = effect.pipe(Effect.provideService(ICompanyAdminOpsRepository, supabaseRepo))
  return logger?.withSpan
    ? Effect.runPromise(logger.withSpan("company-admin-ops", () => traced))
    : Effect.runPromise(traced)
}
```

- [ ] **Step 2: Create B2B activity logs REST route**

`api/companies/[id]/activity-log.ts`:
```typescript
import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { getActivityLogsProgram } from "@/domain/company-admin-ops/company-admin-ops.programs"
import { makeMeta, jsonOk, jsonError, runCompanyAdminOpsEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"

export const GET: APIRoute = async (context) => {
  const meta = makeMeta()
  const companyId = context.params.id

  if (!companyId) {
    return jsonError({ _tag: "ValidationError", message: "Company ID is required" }, meta, HTTP_STATUS.BAD_REQUEST)
  }

  const program = pipe(
    getActivityLogsProgram(companyId),
    Effect.map((data) => jsonOk(data, meta)),
    Effect.catchTags({
      UnauthorizedError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
      AdminOpsFetchError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runCompanyAdminOpsEffect(context, program)
}
```

- [ ] **Step 3: Create Support tickets REST route**

`api/companies/[id]/support.ts`:
```typescript
import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { createSupportTicketProgram, getSupportTicketsProgram } from "@/domain/company-admin-ops/company-admin-ops.programs"
import { makeMeta, jsonOk, jsonError, runCompanyAdminOpsEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { ValidationError } from "@/shared/errors/application.errors"

export const GET: APIRoute = async (context) => {
  const meta = makeMeta()
  const companyId = context.params.id

  if (!companyId) {
    return jsonError({ _tag: "ValidationError", message: "Company ID is required" }, meta, HTTP_STATUS.BAD_REQUEST)
  }

  const program = pipe(
    getSupportTicketsProgram(companyId),
    Effect.map((data) => jsonOk(data, meta)),
    Effect.catchTags({
      UnauthorizedError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
      AdminOpsFetchError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runCompanyAdminOpsEffect(context, program)
}

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()
  const companyId = context.params.id

  if (!companyId) {
    return jsonError({ _tag: "ValidationError", message: "Company ID is required" }, meta, HTTP_STATUS.BAD_REQUEST)
  }

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: () => new ValidationError({ issues: "Invalid JSON body" }),
    }),
    Effect.flatMap((body: any) => {
      if (!body.subject || !body.description || !body.priority) {
        return Effect.fail(new ValidationError({ issues: "subject, description, and priority are required" }))
      }
      return createSupportTicketProgram(companyId, body.subject, body.description, body.priority)
    }),
    Effect.map((data) => jsonOk(data, meta, HTTP_STATUS.CREATED)),
    Effect.catchTags({
      ValidationError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.issues }, meta, HTTP_STATUS.BAD_REQUEST)),
      UnauthorizedError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
      AdminOpsUpdateError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runCompanyAdminOpsEffect(context, program)
}
```

- [ ] **Step 4: Run type check**
Run: `pnpm check`
Expected: SUCCESS

- [ ] **Step 5: Commit**
```bash
git add apps/website/src/lib/api-helpers.ts apps/website/src/pages/api/companies/
git commit -m "feat(api): B2B company admin activity log and support ticket REST endpoints"
```

---

### Task P2.20: Activity Log & Support Ticket UI Blocks (EPIC-05)

**Files:**
- Create: `apps/website/blocks/admin/ActivityLogTable.tsx`
- Create: `apps/website/blocks/admin/SupportTicketLogger.tsx`
- Create: `apps/website/src/pages/admin/activity-log.astro`
- Create: `apps/website/src/pages/admin/support.astro`

- [ ] **Step 1: Create B2B Activity Log Table block**

`blocks/admin/ActivityLogTable.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@treonstudio/bungas-core/ui/card'
import { Badge } from '@treonstudio/bungas-core/ui/badge'
import { Loader2, Terminal, Calendar } from 'lucide-react'

type TLog = {
  id: string
  timestamp: string
  message: string
  context: Record<string, any>
  environment: string
}

export function ActivityLogTable({ companyId }: { companyId: string }) {
  const [logs, setLogs] = useState<TLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/companies/${companyId}/activity-log`)
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data) {
          setLogs(result.data)
        }
      })
      .catch(err => console.error('Error fetching activity logs', err))
      .finally(() => setIsLoading(false))
  }, [companyId])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center min-h-[300px]">
        <Loader2 className="h-10 w-10 text-brand-primary animate-spin mb-4" />
        <h3 className="font-bold">Memuat Log Aktivitas...</h3>
      </div>
    )
  }

  return (
    <Card className="bg-surface-primary border-border-primary text-text-primary">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <Terminal className="h-5 w-5 text-brand-primary" />
          Log Aktivitas Tenant B2B
        </CardTitle>
        <CardDescription className="text-text-secondary text-xs">Rekam jejak tindakan administratif dan event operasional yang terjadi di lingkup organisasi Anda.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {logs.length > 0 ? (
          <div className="divide-y divide-border-primary">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-surface-secondary/20 transition-colors flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div className="space-y-1">
                  <div className="font-bold text-sm flex items-center gap-2">
                    {log.message}
                    <Badge className="bg-surface-tertiary text-text-secondary border-none text-[9px] uppercase font-bold">{log.environment}</Badge>
                  </div>
                  <p className="text-xs text-text-secondary">Actor ID: {log.context?.userId || log.context?.changedBy || 'system'}</p>
                </div>
                <div className="text-xs text-text-secondary flex items-center gap-1.5 shrink-0 self-end sm:self-center font-mono">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(log.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-text-secondary text-xs border border-dashed border-border-primary rounded-xl m-6 bg-surface-primary">Belum ada catatan aktivitas organisasi.</div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Create B2B Support Ticket Logger block**

`blocks/admin/SupportTicketLogger.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@treonstudio/bungas-core/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@treonstudio/bungas-core/ui/label'
import { Textarea } from '@treonstudio/bungas-core/ui/textarea'
import { Badge } from '@treonstudio/bungas-core/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@treonstudio/bungas-core/ui/select'
import { Loader2, CheckCircle, AlertTriangle, Plus, Ticket } from 'lucide-react'
import { cn } from '@treonstudio/bungas-core/lib/utils'

type TTicket = {
  id: string
  subject: string
  description: string
  priority: 'low' | 'medium' | 'high'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  created_at: string
}

export function SupportTicketLogger({ companyId }: { companyId: string }) {
  const [tickets, setTickets] = useState<TTicket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form State
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('low')

  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchTickets = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/companies/${companyId}/support`)
      const result = await res.json()
      if (result.success && result.data) {
        setTickets(result.data)
      }
    } catch (err) {
      console.error('Error fetching tickets', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [companyId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setSuccess(null)
    setError(null)

    try {
      const res = await fetch(`/api/companies/${companyId}/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, description, priority })
      })
      const result = await res.json()
      if (result.success) {
        setSuccess('Tiket bantuan berhasil dicatat! Tim teknis kami akan segera menindaklanjuti.')
        setSubject('')
        setDescription('')
        setPriority('low')
        fetchTickets()
      } else {
        setError(result.error?.message || 'Gagal mengirimkan tiket bantuan')
      }
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Create form */}
      <Card className="bg-surface-primary border-border-primary text-text-primary lg:col-span-1 h-fit">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Plus className="h-5 w-5 text-brand-primary" />
            Buat Tiket Bantuan
          </CardTitle>
          <CardDescription className="text-text-secondary text-xs">Butuh bantuan teknis atau operasional? Kirimkan aduan Anda secara aman.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="space-y-2">
              <Label htmlFor="sub" className="text-xs font-semibold uppercase text-text-secondary">Subjek Aduan</Label>
              <Input id="sub" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Masalah Penagihan Kuota" required className="border-border-primary bg-transparent text-text-primary" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pri" className="text-xs font-semibold uppercase text-text-secondary">Tingkat Prioritas</Label>
              <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                <SelectTrigger className="border-border-primary bg-transparent text-text-primary">
                  <SelectValue placeholder="Prioritas" />
                </SelectTrigger>
                <SelectContent className="bg-surface-primary text-text-primary border-border-primary">
                  <SelectItem value="low">Low (Normal)</SelectItem>
                  <SelectItem value="medium">Medium (Penting)</SelectItem>
                  <SelectItem value="high">High (Kritis)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc" className="text-xs font-semibold uppercase text-text-secondary">Deskripsi & Detail Masalah</Label>
              <Textarea id="desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Jelaskan secara rinci permasalahan yang terjadi..." required className="border-border-primary bg-transparent text-text-primary min-h-[100px]" />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Ticket className="mr-1 h-4 w-4" />}
              Kirim Tiket
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* List of outstanding tickets */}
      <div className="lg:col-span-2 space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Ticket className="h-5 w-5 text-brand-primary" />
          Status Tiket Bantuan Anda
        </h2>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-20 animate-pulse bg-surface-secondary rounded" />
            ))}
          </div>
        ) : tickets.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {tickets.map((t) => (
              <Card key={t.id} className="bg-surface-primary border-border-primary text-text-primary">
                <div className="p-4 flex justify-between items-start gap-4">
                  <div className="space-y-1 pr-4">
                    <h3 className="font-extrabold text-base flex items-center gap-2 flex-wrap">
                      {t.subject}
                      <Badge className={cn("border-none text-[9px] uppercase font-bold tracking-wider", t.priority === 'high' ? "bg-red-500/10 text-red-500" : t.priority === 'medium' ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500")}>
                        {t.priority}
                      </Badge>
                      <Badge className="bg-surface-tertiary text-text-secondary border-none text-[9px] uppercase font-bold">
                        {t.status.replace('_', ' ')}
                      </Badge>
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed">{t.description}</p>
                    <p className="text-[10px] text-text-secondary pt-2">Dikirim pada {new Date(t.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-dashed border-border-primary rounded-xl bg-surface-primary text-xs text-text-secondary">Belum ada aduan tiket bantuan.</div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create Astro layout pages**

`src/pages/admin/activity-log.astro`:
```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro'
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ActivityLogTable } from '@/../blocks/admin/ActivityLogTable'

const supabase = createSupabaseServerClient(Astro)
if (!supabase) {
  return Astro.redirect('/login')
}

const { data: { session } } = await supabase.auth.getSession()
if (!session) {
  return Astro.redirect('/login')
}

// Security: Verify user is B2B Owner/Admin
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

<BaseLayout title="Activity Logs - TenangAI" description="Rekam jejak tindakan administratif B2B.">
  <div class="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
    <div>
      <h1 class="text-3xl font-extrabold tracking-tight text-text-primary">Audit Log Trail</h1>
      <p class="text-sm text-text-secondary">Analisis, tinjau, dan pantau rekam jejak aktivitas admin di lingkup organisasi Anda.</p>
    </div>

    <ActivityLogTable companyId={companyId} client:load />
  </div>
</BaseLayout>
```

`src/pages/admin/support.astro`:
```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro'
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { SupportTicketLogger } from '@/../blocks/admin/SupportTicketLogger'

const supabase = createSupabaseServerClient(Astro)
if (!supabase) {
  return Astro.redirect('/login')
}

const { data: { session } } = await supabase.auth.getSession()
if (!session) {
  return Astro.redirect('/login')
}

// Security: Verify user is B2B Owner/Admin
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

<BaseLayout title="Support Tickets - TenangAI" description="Hubungi bantuan operasional B2B kami secara aman.">
  <div class="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
    <div>
      <h1 class="text-3xl font-extrabold tracking-tight text-text-primary">Aduan & Bantuan Teknis</h1>
      <p class="text-sm text-text-secondary">Log, pantau, dan ajukan tiket bantuan teknis atau operasional khusus dari HR untuk tim kami.</p>
    </div>

    <SupportTicketLogger companyId={companyId} client:load />
  </div>
</BaseLayout>
```

- [ ] **Step 4: Verify type check**
Run: `pnpm check && pnpm test`
Expected: SUCCESS

- [ ] **Step 5: Commit**
```bash
git add apps/website/blocks/admin/ apps/website/src/pages/admin/
git commit -m "feat(ui): B2B company admin activity log and support ticket dashboard"
```
