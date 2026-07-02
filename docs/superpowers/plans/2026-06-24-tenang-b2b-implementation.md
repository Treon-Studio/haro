# Tenang for Business — Phased Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current B2C Tenang repo into a multi-tenant B2B mental wellness platform matching the PRD at `docs/PRD.md` (Draft v1.1, 22 June 2026), with one design-partner pilot client ready for Phase 1 launch in Q3 2026.

**Architecture:** Add a multi-tenant data layer on top of the existing Supabase + Astro 5 + React 19 + Cloudflare Workers stack. Tenant context flows via `company_id` column on every business table + RLS + Effect-TS domain layer. Reuse existing shadcn primitives from `packages/core/src/ui/`, existing auth flow from `apps/website/src/domain/auth/`, existing chat island from `apps/website/blocks/chat/`, and existing block patterns from `apps/website/blocks/`. Add one new route group `/admin/` for Company Admin, `/super-admin/` for Super Admin, and gate `/sign-up` behind invitation tokens.

**Tech Stack:** Astro 5 (server output, Cloudflare adapter), React 19, TypeScript ~5.8, Tailwind v4 (`@theme inline` in `apps/website/src/styles/globals.css`), Supabase (Postgres + Auth + Storage + RLS), Effect-TS (`@effect/schema` + programs), pnpm + turbo, Vitest, Resend (email), Xendit (payments, Phase 1 quota), Mailjet/Resend (transactional email).

**Plan alignment:** Every epic in PRD Section 11 mapped to a specific task. PRD Open Questions (Section 17) listed as Phase 0 prerequisites. Phase numbering matches PRD Section 14.

---

## Conventions Used In This Plan

- All file paths are repo-relative.
- Migrations are `apps/website/supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`. Latest in repo: `20260622000005_create_agents.sql`. New ones continue the sequence.
- Domain folder convention: `apps/website/src/domain/<feature>/` with files: `index.ts`, `<feature>.types.ts`, `<feature>.schemas.ts`, `<feature>.errors.ts`, `<feature>.repository.ts`, `<feature>.repository.supabase.ts`, `<feature>.programs.ts`, `__tests__/<feature>.programs.test.ts`. See `apps/website/src/domain/auth/` for the canonical example.
- API route convention: `apps/website/src/pages/api/<feature>/<action>.ts`. POST JSON body, return `{ success, data, meta }` via `jsonOk`/`jsonError` from `apps/website/src/lib/api-helpers.ts`.
- Block convention: `apps/website/blocks/<section>/<variant>/index.tsx` rendered from `apps/website/src/pages/index.astro` (marketing) or `apps/website/src/pages/<route>.astro` (functional).
- New shadcn primitives install via `pnpm dlx shadcn@latest add <name>` into `packages/core/src/ui/`.
- Commit messages: Conventional Commits (`feat:`, `chore:`, `test:`, `docs:`, `refactor:`).

---

# PHASE 0 — Prerequisites (Week 1, all parallel)

These three workstreams run in parallel and gate everything in Phase 1. The PRD itself (§15.3) names "Step 1a — Legal/compliance review + written escalation & privacy policy" as the actual bottleneck.

## Phase 0 Workstream A — Legal & Policy (Owner: Legal + Clinical Lead)

**Deliverables:**
1. **Written escalation & privacy policy** — covers EPIC-04 RISK-3 anonymization, RISK-12 emergency escalation, RISK-19 unreachable, RISK-20 resolution authority, SUP-7 breach notification (UU PDP Art. 46).
2. **Employee Terms of Service (ToS)** — covers EMP-11 pause, EMP-9 idle timeout, CHAT-6 deletion rights, TEN-3 retention.
3. **Company Admin Master Service Agreement (MSA)** — covers data isolation, audit log access, billing, BILL-6 suspension terms, ADM-12 activity log scope.
4. **Clinical escalation governance document** — names the "senior clinical staff" role (PRD Open Q #12, #17), defines RISK-15 after-hours model (Open Q #10), defines psychologist contact SLA (Open Q #13).
5. **First-session AI greeting (CHAT-13) approved by clinical lead** (Open Q #11, #15).
6. **Re-engagement state (CHAT-15) approved by clinical lead.**
7. **Invitation email copy (EMP-16) approved by clinical + legal + marketing.**

**Status check:** Cannot start engineering on EPIC-04, EPIC-07, or any sales contract until this is signed off.

## Phase 0 Workstream B — Engineering Audit (Owner: Eng Lead)

**Goal:** Verify which PRD claims of "already in codebase" are actually in this repo (vs dev/staging branches vs adjacent repos like `mayapada-web`, `n2cias-fe`, `co-psychologist-ai`).

**Tasks:**
- [ ] Check `git branch -a` for all branches (main, dev, staging, mayapada, b2b, n2cias, ai-engine, etc.).
- [ ] For each branch, grep for: `company_id`, `tenant_id`, `SUPER_ADMIN_ROLE`, `INTERNAL_ROLE`, `highRiskUsers`, `send-to-psychologist`, `CompanyBillingConfigCard`, `getBillingInfo`, `getWarningLevel`, `useBilling`, `Mem0`, `co-psychologist-ai`, `psychologist`, `risk_flag`, `escalation_case`, `clinical_staff`.
- [ ] For each hit, record: branch, file, last commit date, whether merged to main, whether it builds.
- [ ] Produce a corrected appendix for `docs/PRD.md` distinguishing "in main" / "in dev/staging" / "in adjacent repo."
- [ ] Decision: which features need to be merged vs rebuilt.

## Phase 0 Workstream D — Observability Foundation (Owner: Eng Lead)

This is a **prerequisite for Phase 1** — every B2B API route, Effect program, and sensitive action must use the logger from day 1. See `2026-06-24-observability-logger.md` for full spec.

**Tasks:**
- [ ] Create `apps/website/src/lib/logger/` module per F.1-F.4
- [ ] Migrate `app_logs` table (F.2.3)
- [ ] Wire `Logger` service into all `run*Effect` helpers in `api-helpers.ts` (F.4.2)
- [ ] Add requestId middleware (F.3.1)
- [ ] Audit-helper module (F.5.1) and apply to all sensitive programs (F.5.2)
- [ ] Logs viewer at `/super-admin/logs` (F.7)
- [ ] No `console.log` left in BE code (replaced by logger)
- [ ] Tests pass (`pnpm test --filter website logger`)

**Estimated effort:** 1-2 days. Must be done before Phase 1 P1.1 starts.

## Phase 0 Workstream C — Architecture Decisions (Owner: CPO + Eng Lead)

---

# PHASE 1 — B2B MVP (Weeks 2-12, target launch Q3 2026)

> PRD reference: Section 14 Phase 1 + Section 15 Critical Path.

The phase is sequenced to **unblock the longest pole first (EPIC-07 multi-tenant infra)**, then build outward. EPICs are listed in dependency order, not PRD order.

## P1.1 — EPIC-07: Multi-Tenant Data Isolation (Weeks 2-3) — CRITICAL PATH

This epic blocks EPIC-01, 02, 05, 06, 09, 16, 17. Ship it first.

### Task P1.1.1 — Add shadcn primitives needed for admin

- [ ] Install missing primitives: `table`, `pagination`, `alert-dialog`, `breadcrumb`, `tabs`, `calendar` (for SUP-15 90-day trigger dates). Command from repo root:
  ```bash
  pnpm dlx shadcn@latest add table pagination alert-dialog breadcrumb tabs calendar
  ```
  Install target: `packages/core/src/ui/`. Components are auto-added by the CLI.

### Task P1.1.2 — Create migration: `companies` table

File: `apps/website/supabase/migrations/20260624000000_create_companies_and_memberships.sql`

```sql
-- Migration: Companies, memberships, branding, legal hold (EPIC-07 + EPIC-01 + EPIC-10 foundations)

-- 1. Companies table
create table if not exists public.companies (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  domain text, -- primary email domain for invitation validation
  billing_tier text not null default 'starter' check (billing_tier in ('starter','growth','enterprise','trial')),
  session_quota integer not null default 0, -- per billing cycle
  sessions_used integer not null default 0,
  contract_start_date date,
  contract_end_date date,
  status text not null default 'active' check (status in ('active','suspended','offboarded')),
  legal_hold boolean not null default false, -- TEN-6
  soft_deleted_at timestamptz, -- SUP-10 48h soft-delete window
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.companies enable row level security;

-- 2. User-company memberships (one user can belong to many companies — supports EMP-15 admin-as-employee)
create type public.company_role as enum ('super_admin','company_admin','clinical_staff','employee');

create table if not exists public.user_company_memberships (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role public.company_role not null,
  is_active boolean not null default true,
  is_primary boolean not null default false, -- for users in multiple companies
  assigned_at timestamptz not null default now(),
  deactivated_at timestamptz,
  unique (user_id, company_id, role)
);

create index idx_memberships_user on public.user_company_memberships(user_id) where is_active;
create index idx_memberships_company on public.user_company_memberships(company_id) where is_active;

alter table public.user_company_memberships enable row level security;

-- 3. Helper: get current user's active company_ids
create or replace function public.current_user_company_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.user_company_memberships
  where user_id = auth.uid() and is_active = true;
$$;

create or replace function public.current_user_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.user_company_memberships
    where user_id = auth.uid() and role = 'super_admin' and is_active = true
  );
$$;

create or replace function public.current_user_role_in(company uuid)
returns public.company_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_company_memberships
  where user_id = auth.uid() and company_id = company and is_active = true
  order by case role
    when 'super_admin' then 1
    when 'clinical_staff' then 2
    when 'company_admin' then 3
    when 'employee' then 4
  end
  limit 1;
$$;

-- 4. Companies RLS
create policy "super_admins_all_companies" on public.companies
  for all using (public.current_user_is_super_admin());

create policy "members_view_own_company" on public.companies
  for select using (id in (select public.current_user_company_ids()));

-- 5. Memberships RLS
create policy "super_admins_all_memberships" on public.user_company_memberships
  for all using (public.current_user_is_super_admin());

create policy "users_view_own_memberships" on public.user_company_memberships
  for select using (user_id = auth.uid());

create policy "company_admins_view_company_memberships" on public.user_company_memberships
  for select using (company_id in (
    select company_id from public.user_company_memberships
    where user_id = auth.uid() and role in ('company_admin','super_admin') and is_active
  ));

-- 6. Trigger for updated_at
create trigger handle_companies_updated_at
  before update on public.companies
  for each row execute procedure public.handle_updated_at();
```

### Task P1.1.3 — Add `company_id` to existing tables

File: `apps/website/supabase/migrations/20260624000001_add_company_id_to_existing_tables.sql`

```sql
-- Migration: Scope existing per-user tables to optional company_id (for B2B features)
-- Existing B2C data remains with company_id = NULL.

alter table public.projects add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.skills add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.prompts add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.agents add column if not exists company_id uuid references public.companies(id) on delete set null;

create index idx_projects_company on public.projects(company_id);
create index idx_skills_company on public.skills(company_id);
create index idx_prompts_company on public.prompts(company_id);
create index idx_agents_company on public.agents(company_id);

-- Update RLS: company_id-scoped access for members
create policy "members_view_company_projects" on public.projects
  for select using (
    company_id is null
    or company_id in (select public.current_user_company_ids())
  );
-- (similar policies for skills, prompts, agents)
```

### Task P1.1.4 — Cross-tenant isolation test (TEN-5)

File: `apps/website/supabase/tests/cross_tenant_isolation.test.sql` (run via `supabase test db` or pgTAP)

Smoke test: with two companies A and B, user in A must not be able to SELECT, INSERT, UPDATE, or DELETE any row in B's data. Repeat per table.

### Task P1.1.5 — Audit log table (SUP-4)

In the same migration file or a new one: `audit_log` table with `actor_id, company_id, action, resource_type, resource_id, before_json, after_json, created_at`. RLS: super_admin only.

### Task P1.1.6 — Effect-TS domain: `companies` and `memberships`

Create `apps/website/src/domain/companies/` mirroring the auth domain structure:
- `companies.types.ts` — `TCompany`, `TCompanyRole`, `TMembership`, `TBillingTier`
- `companies.schemas.ts` — `CreateCompanySchema`, `UpdateCompanySchema`
- `companies.errors.ts` — `CompanyNotFoundError`, `DuplicateCompanyError`, `InsufficientPermissionError`
- `companies.repository.ts` — `ICompaniesRepository` interface
- `companies.repository.supabase.ts` — Supabase implementation
- `companies.programs.ts` — `createCompanyProgram`, `getCompanyProgram`, `listCompaniesProgram` (super admin), `suspendCompanyProgram`, `softDeleteCompanyProgram` (SUP-10)
- `companies.module.ts` — barrel export
- `__tests__/companies.programs.test.ts` — Vitest

Test scaffolding (TDD): start with the failing test for `createCompanyProgram` rejection of duplicate names (PRD ONB-4).

**Commit after each file.** Reuse `IAuthRepository` pattern from `apps/website/src/domain/auth/auth.repository.ts`.

### Task P1.1.7 — Effect-TS domain: `memberships`

Same pattern at `apps/website/src/domain/memberships/`. Key programs:
- `assignRoleProgram(userId, companyId, role)` — SUP-3
- `revokeRoleProgram(userId, companyId, role)` — SUP-3
- `getUserCompaniesProgram(userId)` — for tenant switcher (EMP-15)
- `reassignCompanyAdminProgram(fromUserId, toUserId, companyId)` — ADM-8

### Task P1.1.8 — Server-side tenant guard helper

File: `apps/website/src/lib/tenant-guard.ts` (new):

```typescript
import type { APIContext } from "astro"
import { Effect } from "effect"
import { ICompaniesRepository, makeSupabaseCompaniesRepository } from "@/domain/companies"
import { currentUserRoleIn } from "@/lib/supabase/rpc"
import { ForbiddenError, UnauthorizedError } from "@/shared/errors/application.errors"

export const requireCompanyRole = (companyId: string, allowed: TCompanyRole[]) =>
  Effect.gen(function* () {
    const supabase = createSupabaseServerClient(...)
    const role = await supabase.rpc("current_user_role_in", { company: companyId })
    if (!role) return yield* new ForbiddenError({ message: "Not a member of this company" })
    if (!allowed.includes(role)) return yield* new ForbiddenError({ message: `Requires ${allowed.join("|")}, have ${role}` })
    return role
  })
```

Use this in every Company Admin and Super Admin API route. Bypass UI-level filtering — server enforces.

### Task P1.1.9 — Update middleware for tenant context

Modify `apps/website/src/middleware/auth.ts` to also load the user's primary `company_id` and active role into `context.locals` for protected routes. Routes that need it: `/admin/*` (company admin), `/super-admin/*` (super admin), `/c/*` (any authenticated user, picks active company from a cookie).

### Task P1.1.10 — Run the verification suite

- [ ] `pnpm check` (astro check + typecheck).
- [ ] `pnpm test` from `apps/website/` — all auth + new company/membership tests pass.
- [ ] Apply migrations to a local Supabase: `supabase db reset` then `supabase migration up`.
- [ ] Run the cross-tenant isolation test (Task P1.1.4). All assertions pass.
- [ ] `pnpm build` succeeds.

**Done when:** Every existing per-user table has a `company_id` column with RLS, `companies` + `user_company_memberships` exist with full RLS, audit log table exists, `requireCompanyRole` helper is used in every B2B route, cross-tenant test passes.

---

## P1.2 — EPIC-09: Super Admin Console — Tenant Provisioning Foundation (Weeks 3-4)

> PRD: SUP-1, SUP-2, SUP-3, SUP-4, SUP-5, SUP-6, SUP-12, SUP-13 (foundation only — full feature set in P1.5).

### Task P1.2.1 — Add `super_admin` bootstrap script

File: `apps/website/supabase/seed.sql` (or a new migration):

```sql
-- Bootstrap: promote an email to super_admin
-- Run manually with: supabase db execute --file seed_super_admin.sql
insert into public.user_company_memberships (user_id, company_id, role)
select
  u.id,
  (select id from public.companies limit 1), -- any company; super admin can see all
  'super_admin'
from auth.users u
where u.email = 'ops@tenang.id'
on conflict (user_id, company_id, role) do nothing;
```

### Task P1.2.2 — Super Admin layout + nav

New page: `apps/website/src/pages/super-admin/index.astro`. Use `Breadcrumb` + `Tabs` from `packages/core/src/ui/`.

```astro
---
import SuperAdminLayout from '@/layouts/SuperAdminLayout.astro'
import { requireCompanyRole } from '@/lib/tenant-guard'
// gate
---
<SuperAdminLayout>
  <h1>Super Admin</h1>
  <p>Welcome, ops@tenang.id</p>
</SuperAdminLayout>
```

### Task P1.2.3 — Tenant create form (SUP-1, ONB-1)

Page: `apps/website/src/pages/super-admin/tenants/new.astro`. Form fields: `name, domain, billing_tier, session_quota`. POST to `/api/super-admin/tenants`.

Reuse: `Input`, `Select`, `Card`, `Button` from `packages/core/src/ui/`. New: `apps/website/src/components/super-admin/CreateTenantForm.tsx` as a React island.

API route: `apps/website/src/pages/api/super-admin/tenants/index.ts` — POST handler runs `createCompanyProgram` with `requireCompanyRole(allowed=['super_admin'])`.

### Task P1.2.4 — Tenant list (SUP-2)

Page: `apps/website/src/pages/super-admin/tenants/index.astro`. Table view using `Table` primitive. Columns: name, tier, status, sessions_used/quota, contract_end, created_at. Link to detail page.

API: `GET /api/super-admin/tenants` returning paginated list.

### Task P1.2.5 — Sales handoff form (SUP-12)

File: `apps/website/src/pages/super-admin/handoff.astro`. Form fields per PRD SUP-12: `company_name, company_size, billing_model, company_admin_email, contract_terms, go_live_date, sales_contact`. Stored as `handoff_artefacts` table (add in P1.1.5 or new migration).

The form is gated behind a `sales_role` or temporarily just the super admin role. Block tenant provisioning if no handoff exists (SUP-13).

### Task P1.2.6 — Super Admin audit log viewer (SUP-4)

Page: `apps/website/src/pages/super-admin/audit-log.astro`. Searchable, append-only, paginated. Filter by actor, action, resource_type, date range.

### Task P1.2.7 — Verification

- [ ] `pnpm check` + `pnpm test` + `pnpm build` all pass.
- [ ] Manual: log in as `ops@tenang.id`, create a tenant, view it in the list, view it in audit log.

**Done when:** Super Admin can create a tenant via the handoff-driven flow, see it in the list, and the action is logged.

---

## P1.3 — EPIC-10: Company Branding (Weeks 4-5, parallel with P1.4-P1.6)

> PRD: BRAND-1 to BRAND-5. Smallest epic in Phase 1 — can run in parallel with everything else.

### Task P1.3.1 — Add `company_branding` table

File: `apps/website/supabase/migrations/20260624000002_create_company_branding.sql`

```sql
create table if not exists public.company_branding (
  company_id uuid primary key references public.companies(id) on delete cascade,
  logo_url text,
  primary_color text, -- hex; validated client-side for WCAG AA contrast
  welcome_message text,
  default_language text not null default 'id' check (default_language in ('id','en')),
  notification_settings jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.company_branding enable row level security;

create policy "members_view_branding" on public.company_branding
  for select using (company_id in (select public.current_user_company_ids()));

create policy "admins_manage_branding" on public.company_branding
  for all using (public.current_user_role_in(company_id) in ('company_admin','super_admin'));
```

### Task P1.3.2 — Supabase Storage bucket `company-assets`

Set up via Supabase dashboard or migration:
- Bucket `company-assets` (private).
- Storage policy: company admins can upload to `logos/{company_id}/*`, public read for `logos/{company_id}/current`.

### Task P1.3.3 — Effect-TS domain: `branding`

At `apps/website/src/domain/branding/`. Programs:
- `getBrandingProgram(companyId)` — used by employee chat UI to apply theme
- `updateBrandingProgram(companyId, input)` — Company Admin only
- `uploadLogoProgram(companyId, file)` — validates file size ≤ 1 MB, type = png/jpg/svg

### Task P1.3.4 — BrandingProvider (client)

File: `apps/website/src/components/branding/BrandingProvider.tsx`. Reads branding from `useBranding()` hook, injects CSS variables at the root:

```typescript
useEffect(() => {
  if (branding?.primary_color) {
    document.documentElement.style.setProperty("--primary", branding.primary_color)
  }
}, [branding])
```

Reuses Tailwind v4 `@theme inline` tokens in `globals.css:6-70`.

### Task P1.3.5 — Admin branding settings page

Page: `apps/website/src/pages/admin/branding.astro`. Sections: Logo upload, Color picker (with WCAG contrast preview), Welcome message (textarea), Default language (select), Notification settings (deferred to P2.1 ENG-4).

Reuse: `Input` (file), `Card`, `Textarea`, `Select`, `Button`. Color picker: install `react-colorful` (lightweight, 2KB) or build a swatch grid.

### Task P1.3.6 — Default branding fallback (BRAND-5)

In `BrandingProvider`, if no branding record exists, use the values in `apps/website/src/styles/globals.css:6-70` defaults (the existing earthy ochre `--primary: oklch(0.5967 0.0558 61.59)`). Update the marketing footer hardcode (`blocks/footer/one/index.tsx:87`) to use the company name from branding if present, else "Tenang".

### Task P1.3.7 — Verification

- [ ] Log in as company admin, upload a logo, set a brand color, see it in chat header (`/c/`) and in the invitation email.
- [ ] Log out, log in as employee in same company, see the custom branding applied.
- [ ] Log in as employee in unbranded company, see default Tenang branding.

**Done when:** Company Admin can configure logo + color; branding applies to chat UI + invitation emails; default fallback works.

---

## P1.4 — EPIC-01: Company Onboarding — Bulk Invite + Invitations (Weeks 4-5)

> PRD: ONB-1 to ONB-9. Depends on P1.1 (companies table) and P1.2 (super admin tenant creation).

### Task P1.4.1 — `invitations` table

File: `apps/website/supabase/migrations/20260624000003_create_invitations.sql`

```sql
create type public.invitation_status as enum ('pending','accepted','expired','revoked');

create table if not exists public.invitations (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  role public.company_role not null default 'employee',
  token_hash text not null unique, -- bcrypt-hashed JWT
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  status public.invitation_status not null default 'pending',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_invitations_company on public.invitations(company_id);
create index idx_invitations_email on public.invitations(email) where status = 'pending';

alter table public.invitations enable row level security;

create policy "admins_manage_invitations" on public.invitations
  for all using (public.current_user_role_in(company_id) in ('company_admin','super_admin'));
```

### Task P1.4.2 — Effect-TS domain: `invitations`

At `apps/website/src/domain/invitations/`. Programs:
- `createInvitationProgram(companyId, email, role)` — generates JWT (24h expiry), hashes, stores, sends email via Resend
- `verifyInvitationTokenProgram(token)` — returns invitation + company context if valid
- `acceptInvitationProgram(token, userId)` — creates membership, marks invitation accepted (EMP-1, EMP-3)
- `bulkInviteProgram(companyId, csvText)` — ONB-3, ONB-6: per-row validation, returns array of `{email, status, error?}`
- `previewBulkInviteProgram(companyId, csvText)` — ONB-9: dry-run, returns count + first 10 rows + flagged anomalies
- `revokeInvitationProgram(invitationId)` — for ADM-9 admin transfer

### Task P1.4.3 — Email pipeline setup (PRD Open Q decision)

Decision point from Phase 0. Recommended: **Resend** (best DX, Node SDK, free tier 100 emails/day, good deliverability for ID).

File: `apps/website/src/lib/email/resend.ts`:
```typescript
import { Resend } from "resend"
const resend = new Resend(import.meta.env.RESEND_API_KEY)

export const sendInvitationEmail = async (to: string, inviteUrl: string, companyName: string) =>
  resend.emails.send({
    from: "Tenang <noreply@tenang.id>",
    to,
    subject: `${companyName} invites you to Tenang — confidential mental wellness support`,
    html: invitationEmailHtml(inviteUrl, companyName), // content approved in Phase 0
  })
```

Invite URL: `${PUBLIC_SITE_URL}/sign-up?invitation=${token}`. Token is the unhashed JWT; only the hash is stored in the DB.

### Task P1.4.4 — Invitation email template (EMP-16)

File: `apps/website/src/lib/email/templates/invitation.tsx`. Content (approved by clinical + legal + marketing in Phase 0):
- Subject per Phase 0 deliverable
- Body explains: what Tenang is, what it is not (not therapy, not crisis line), that conversations are private from the employer
- Single CTA button: "Activate your account"
- Footer: company name, "You're receiving this because your employer subscribed to Tenang"

### Task P1.4.5 — Company Admin bulk-invite UI (ONB-3, ONB-6, ONB-9)

Page: `apps/website/src/pages/admin/roster.astro`. Components:
- `BulkInviteUploader.tsx` — file picker (CSV) + textarea fallback
- `BulkInvitePreview.tsx` — shows count, first 10 rows, anomalies (duplicates, non-domain emails, malformed addresses)
- Single confirm button posts to `/api/invitations/bulk`

CSV format: `email` (required), `department` (optional, for EPIC-16 WFA-2).

### Task P1.4.6 — Single admin invite (ONB-2)

Page: `apps/website/src/pages/admin/team.astro`. Form: email, role. POSTs to `/api/invitations`.

Reuse: existing admin layout pattern from P1.2. Use `Dialog` for "Invite sent" confirmation.

### Task P1.4.7 — Verification

- [ ] Company Admin uploads a 100-row CSV, previews, confirms, all 100 invitation emails sent (check Resend dashboard).
- [ ] One recipient clicks the link, lands on `/sign-up?invitation=<token>`, sees the company name + their role in the form, registers, lands in `/c/`.
- [ ] Invitation token expires after 24h (test with short-lived token).
- [ ] Bad-row CSV (malformed emails) returns errors for those rows only (ONB-6).

**Done when:** Company Admin can invite employees (single + bulk), invitation links are valid for 24h, employees can complete registration.

---

## P1.5 — EPIC-02: Employee Onboarding & Authentication (Weeks 5-6)

> PRD: EMP-1 to EMP-17. Depends on P1.1 + P1.4.

### Task P1.5.1 — Refactor `SignUpSchema` to accept invitation

Modify `apps/website/src/domain/auth/auth.schemas.ts`:

```typescript
export const SignUpSchema = Schema.Struct({
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  password: Schema.String.pipe(Schema.minLength(8)),
  invitationToken: Schema.optional(Schema.String), // present for B2B
  fullName: Schema.optional(Schema.String), // captured at profile, not signup
})
```

### Task P1.5.2 — Update `signUpProgram` to validate invitation

File: `apps/website/src/domain/auth/auth.programs.ts:26-41`. Before calling `repo.signUp`, if `invitationToken` is present:
1. Call `verifyInvitationTokenProgram` to confirm validity
2. Confirm email matches invitation
3. After successful signup, call `acceptInvitationProgram(token, userId)` to create the membership

If `invitationToken` is absent, this is a B2C signup (existing flow).

### Task P1.5.3 — Refactor `blocks/sign-up/one` for B2B mode

The block at `apps/website/blocks/sign-up/one/index.tsx` is reused with a conditional: if `?invitation=<token>` is in the URL, show a "Welcome to {companyName}" header above the form and pass the token on submit. The block becomes tenant-aware but its core is the same form.

### Task P1.5.4 — Add `/update-profile` page (EMP-2)

New page: `apps/website/src/pages/update-profile.astro`. Form fields (per EMP-2 + EMP-16): `age_range, language, notification_opt_in, gender_optional, pronouns_optional, phone_optional (PRD Open Q #16)`. Submit POSTs to `/api/auth/profile`.

After profile completion, redirect to `/onboarding/orientation` (next task).

### Task P1.5.5 — Orientation screen (EMP-16)

Page: `apps/website/src/pages/onboarding/orientation.astro`. One-screen explainer:
- "What Tenang can do: Listen, support, help you reflect, recommend exercises"
- "What Tenang cannot do: It's not a therapist, not a crisis line, not a replacement for emergency services"
- "What stays private: Your conversations are not visible to {companyName}. HR only sees aggregate, anonymized data."
- Two buttons: "Get started" (proceed to `/c/`) or "Re-read this later" (skip with confirmation)

Show only on first visit — track in `users.onboarding_completed_at` column (add via migration in P1.5.x or in P1.1.3). Skippable with confirmation per EMP-16 AC.

### Task P1.5.6 — B2C/B2B same-email conflict screen (EMP-17)

If a user signs up at `/sign-up?invitation=<token>` but the email is already registered as a B2C user (membership exists with role `null` or no membership), show an explanation screen:
- "You have an existing Tenang personal account with this email."
- "Your B2B account will be separate. Your personal conversations will not be visible to {companyName}."
- "Continue to link these accounts" → proceed with current flow
- "Use a different email" → back to form

This depends on the Phase 0 architecture decision (Open Q #3) — single-account-with-memberships is the assumed model.

### Task P1.5.7 — Add employee lifecycle programs

Extend `auth.programs.ts` (or new `auth.lifecycle.programs.ts`):
- `pauseAccountProgram(userId, reason?)` — EMP-11
- `unpauseAccountProgram(userId)` — EMP-11
- `changeEmailProgram(userId, newEmail)` — EMP-10: requires OTP re-verify on new email
- `requestOtpResendProgram(email)` — EMP-4: rate-limited 3/15min
- `deactivateAccountProgram(userId, reason)` — EMP-8

### Task P1.5.8 — Idle session timeout (EMP-9)

Modify `apps/website/src/middleware/auth.ts`: track `lastActivityAt` in cookie. If `now - lastActivityAt > IDLE_TIMEOUT_MS` (configurable per company via `companies.session_idle_timeout_minutes`, default 60), force re-auth.

### Task P1.5.9 — One-tap logout (EMP-12)

Add a persistent logout button to the chat header. In `apps/website/blocks/chat/components/Header.tsx`, add a `LogOut` icon button (Lucide) that calls `/api/auth/logout` and redirects to `/login`. Always visible.

### Task P1.5.10 — Verification

- [ ] Invite an employee via P1.4 flow. They click the link, sign up, complete profile, see orientation, land in chat.
- [ ] Log in as a B2C user (existing flow), get an invitation to a company with same email, see EMP-17 conflict screen.
- [ ] Pause account, verify notifications stop; unpause, verify they resume.
- [ ] Idle for 60 min, get forced re-auth.
- [ ] Logout button always visible in chat header.

**Done when:** Employees can register via invitation, complete profile, see orientation, use the chat with tenant branding. B2C/B2B conflict handled. Idle/pause/email-change work.

---

## P1.6 — EPIC-05: Company Admin Console — Foundations (Weeks 5-6, parallel with P1.5)

> PRD: ADM-1 to ADM-12 (V1 subset: dashboard, roster, billing view, branding — branding done in P1.3, roster done in P1.4). Focus here: dashboard + analytics + activity log.

### Task P1.6.1 — Admin layout

New page: `apps/website/src/pages/admin/index.astro` redirects to `/admin/dashboard`.

Layout component: `apps/website/src/layouts/AdminLayout.astro` — sidebar nav (Dashboard, Roster, Branding, Billing, Activity Log, Settings), top bar with company name + admin avatar.

### Task P1.6.2 — Analytics dashboard (ADM-1, ADM-2, ADM-3)

Page: `apps/website/src/pages/admin/dashboard.astro`. Sections:
- KPI tiles: Total employees, Active this month, Sessions this month, Risk flags (anonymized count, ADM-3 boundary)
- Time series: Daily active users (last 30 days) — uses `Chart` from `packages/core/src/ui/chart.tsx`
- Top skills/programs used (Phase 2 — placeholder for now)
- Empty state when no usage data yet (ADM-4)

Reuse: `Card`, `Chart` (Recharts), `Badge` for warning levels, `Progress` for quota bars.

### Task P1.6.3 — Roster view (ADM-2, ADM-6, ADM-8, ADM-9)

Page: `apps/website/src/pages/admin/roster.astro`. Table: name, email, role, last_active, status. Actions: Deactivate, Change role, Invite another admin (ADM-6).

Implement bulk deactivation guard (EMP-14): if selected count > 20% of roster, show `AlertDialog` requiring Super Admin confirmation.

### Task P1.6.4 — Activity log (ADM-12)

Page: `apps/website/src/pages/admin/activity-log.astro`. Read-only log scoped to `company_id`. Columns: actor, action, target, timestamp. Filter by action type.

Data source: extend `audit_log` table (P1.1.5) to log `invitations.sent, members.deactivated, branding.updated, announcements.sent, etc.`

### Task P1.6.5 — Support ticket stub (ADM-10)

Page: `apps/website/src/pages/admin/support.astro`. Form: subject, description, priority. On submit, creates a row in a new `support_tickets` table (linked to `company_id` only, no employee identity).

For V1, the ticket is just a row — no email/Slack integration. Phase 2 ties to ENG-12.

### Task P1.6.6 — Verification

- [ ] Log in as Company Admin, see dashboard with 4 KPI tiles + 1 chart.
- [ ] Roster table shows all invited/active employees, deactivation works.
- [ ] Bulk deactivation > 20% shows the AlertDialog.
- [ ] Activity log shows the last 5 admin actions.
- [ ] Submit a support ticket, see it in the list.

**Done when:** Company Admin has a working dashboard, roster management, activity log, and support ticket stub.

---

## P1.7 — EPIC-06: Subscription & Billing — Quota v1 (Weeks 6-7)

> PRD: BILL-1, BILL-2, BILL-4, BILL-6, BILL-7, BILL-8. PAYG + invoicing (BILL-3) deferred to Phase 2.

### Task P1.7.1 — Add quota tracking to chat session lifecycle

When a session is created (`apps/website/src/pages/api/chat.ts:1-151` or the AI Engine call), check `companies.sessions_used < companies.session_quota`. If exceeded:
- Block new session creation with quota-exhausted response
- For mid-session quota exhaustion, do NOT kill active session (BILL-8)

Add `session_started_at` and `session_id` to quota-check logic.

### Task P1.7.2 — Effect-TS domain: `billing`

At `apps/website/src/domain/billing/`. Programs:
- `getBillingInfoProgram(companyId)` — returns quota, used, warning level (none/warning/critical/exceeded)
- `getWarningLevelProgram(companyId)` — returns one of `'none' | 'warning' | 'critical' | 'exceeded'` based on usage %
- `incrementSessionUsageProgram(companyId)` — called on session start
- `updateQuotaProgram(companyId, newQuota)` — Super Admin only (BILL-2)
- `suspendCompanyProgram(companyId, reason)` — BILL-6

### Task P1.7.3 — Admin billing view (BILL-1)

Page: `apps/website/src/pages/admin/billing.astro`. Sections:
- Current quota: used / total, progress bar
- Warning level badge
- Billing tier
- Payment history (Phase 2 — empty state for V1)
- Scheduled changes (BILL-9 — Phase 2)

Reuse: `Card`, `Progress`, `Badge`, `Button`.

### Task P1.7.4 — Quota-exhausted screen (BILL-4)

Add to the chat island: when `/c/` returns "quota exhausted" state from API, render a dedicated screen instead of the chat form. Message: "Your company has reached its session limit for this cycle. Please contact {companyName} HR to increase your plan, or return next cycle."

Reuse: `Card`, `Button` (mailto link to admin).

### Task P1.7.5 — Xendit integration stub (Phase 2 will use, V1 only logs)

File: `apps/website/src/lib/payments/xendit.ts`. Stub: V1 just records billing events in `billing_events` table. Phase 2 wires actual Xendit API.

### Task P1.7.6 — Verification

- [ ] Set a company quota to 5. Have 5 employees each start a session. 6th employee sees the quota-exhausted screen.
- [ ] Mid-session: artificially exhaust quota. Active session continues to completion (BILL-8).
- [ ] Company Admin sees correct usage on `/admin/billing` with correct warning level.
- [ ] Super Admin updates quota, new quota is immediately effective.

**Done when:** Quota tracking is enforced at session start, mid-session is protected, billing dashboard is accurate.

---

## P1.8 — EPIC-09: Super Admin Console — Full (Weeks 7-8)

> PRD: SUP-7 to SUP-15. Adds safety + lifecycle automation.

### Task P1.8.1 — `feature_flags` table + per-tenant toggles (SUP-6)

```sql
create table if not exists public.tenant_feature_flags (
  company_id uuid not null references public.companies(id) on delete cascade,
  flag text not null,
  enabled boolean not null default false,
  config jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (company_id, flag)
);
```

UI: `/super-admin/tenants/[id]/features` with toggles for: mood_checkin, goals, self_guided_content, bookmarks, skills_library, pulse_survey, freemium, n2cias. (V1: most are off; UI exists for Phase 2.)

### Task P1.8.2 — Tenant detail page

Page: `/super-admin/tenants/[id].astro`. Tabs: Overview, Members, Branding, Billing, Activity, Settings. Use the `Tabs` primitive from P1.1.1.

### Task P1.8.3 — MFA enforcement for super admin (SUP-8)

Modify `/super-admin/*` routes to require 2FA. Reuse `apps/website/blocks/auth/two-factor.tsx`. Force re-auth for any super admin without 2FA enabled.

### Task P1.8.4 — Emergency-suspend super admin (SUP-8)

Action: any super admin can mark another as suspended. Logs action, removes all sessions, requires re-onboarding.

### Task P1.8.5 — Two-person tenant deletion (SUP-10)

Page: `/super-admin/tenants/[id]/delete.astro`. Form requires:
- Reason for deletion
- Confirmation typed in (tenant name)
- A second super admin's email who must approve via email link

After both confirmations, soft-delete sets `companies.soft_deleted_at = now()`. After 48h, a Cloudflare cron job hard-deletes (unless reversed within window). Hard-delete cascades through all RLS-protected data.

### Task P1.8.6 — Platform-wide status banner (SUP-11)

File: `apps/website/src/components/PlatformStatusBanner.tsx`. Reads from `public.platform_status` table (single row, super-admin-managed). Renders at top of all layouts when active. Includes "expected resolution time" field.

### Task P1.8.7 — Client health alert cron (SUP-14)

Cloudflare Cron Trigger (`wrangler.jsonc` updated) runs daily:
```typescript
// apps/website/src/pages/api/cron/client-health.ts
for each company:
  if MAU < threshold for 30 consecutive days:
    send email to super admin + sales contact with usage summary
    create row in client_health_alerts table
```

Use a `companies.utilization_30d` materialized view (refreshed daily).

### Task P1.8.8 — 90-day renewal reminder (SUP-15)

Cron runs daily:
```typescript
for each company:
  if contract_end_date - today == 90 days:
    send email to sales contact + super admin with usage summary
    include: MAU, session count, benchmark, outstanding flags
```

### Task P1.8.9 — Data incident report generator (SUP-7)

Page: `/super-admin/incidents/new.astro`. Form: incident date, affected data types, estimated scope, timeline, mitigation steps. Generates PDF from audit log + form data. Export.

### Task P1.8.10 — Verification

- [ ] Super Admin can toggle feature flags per tenant.
- [ ] Force-set a tenant to low utilization for 30 days, verify cron fires the health alert email.
- [ ] Set a tenant contract_end_date 90 days out, verify cron fires the renewal reminder.
- [ ] Delete a tenant with two-person confirmation, verify soft-delete state, then reverse within 48h, verify data is intact.
- [ ] Publish a platform status, see it on all tenant pages.

**Done when:** Super Admin has full operational control: feature flags, MFA, emergency suspend, two-person delete, status banner, client health alerts, renewal reminders, breach reports.

---

## P1.9 — EPIC-03: AI Psychologist Chat — v1 (Weeks 8-10)

> PRD: CHAT-1 to CHAT-16. The chat island is already mature — work here is gap-filling and AI Engine integration.

### Task P1.9.1 — First-session greeting (CHAT-13)

Modify `apps/website/blocks/chat/components/Landing.tsx`. Add a check: if `session_count = 1` (from a new `user_session_counts` view or user metadata), render a different greeting per the clinical-approved protocol from Phase 0 deliverable 5.

Approved greeting (placeholder — replace with actual approved copy):
- "Hi, I'm here to listen. Whatever's on your mind today, we can take it at your pace. How are you feeling right now?"

### Task P1.9.2 — Post-session summary (CHAT-14)

Add `apps/website/blocks/chat/components/PostSessionSummary.tsx`. Shows after a session ends:
- AI-generated 2-3 sentence summary
- Optional mood check-in (1-5 emoji scale) — connects to EPIC-14 (Phase 2)
- One content/skill recommendation (Phase 2 — placeholder card for V1)

Trigger: when user clicks "End conversation" in `ChatForm.tsx`, route to a post-session screen rather than straight back to `/c/`.

### Task P1.9.3 — Long-absence re-engagement (CHAT-15)

In `useChat.ts` (or a new `useEngagementState.ts`), track `lastSessionAt`. On session start, if `now - lastSessionAt >= 30 days`, inject a flag in the AI system prompt: "user is returning after an absence — greet warmly without pressure."

Approved re-engagement prompt (placeholder — replace with actual):
- "Welcome back. I remember some of what you shared before, but there's no rush to pick up where we left off. What's on your mind today?"

### Task P1.9.4 — In-session crisis resource card (CHAT-16)

Add `apps/website/blocks/chat/components/CrisisResourceCard.tsx`. Renders below the message input as a non-disruptive banner when a risk flag fires (event from AI Engine).

Card content (per Phase 0 deliverable 1):
- "If you're in crisis or need immediate support, please contact Into The Light Indonesia: 119 ext. 8"
- Optional: 1-2 additional hotlines
- Close button (employees can dismiss but card reappears in next session)

Session continues normally unless employee chooses to end (per CHAT-16 AC).

### Task P1.9.5 — Delete chat history (CHAT-6)

Extend `SettingsDialog.tsx` "Delete all conversations" to also:
- Delete Mem0 memories (when integrated, see P1.9.8)
- Delete Cloudflare KV `CONVERSATIONS` entries
- Confirm with `AlertDialog`

### Task P1.9.6 — Session length ceiling (CHAT-9)

In `useChat.ts`, track `sessionStartedAt`. If `now - sessionStartedAt > SESSION_MAX_MINUTES` (default 90), show a soft warning after 75 min: "We have about 15 minutes left — is there anything important to wrap up?" At the limit, gracefully end the session with a post-session summary.

### Task P1.9.7 — Prompt injection filter (CHAT-7)

Add a simple input filter in `apps/website/src/pages/api/chat.ts` that catches common jailbreak patterns (regex list of "ignore previous instructions", "DAN mode", etc.). Log attempts to `security_events` table.

### Task P1.9.8 — AI Engine integration (Open Q #4)

Two paths depending on Phase 0 decision:

**Path A (consume external `co-psychologist-ai`):**
- Replace `pages/api/chat.ts` with a thin proxy to the AI Engine's SSE endpoint
- Inject `user_id, company_id, session_id` into the request
- AI Engine handles Mem0, risk detection, persona, system prompt
- Platform only needs to render the streamed response

**Path B (rebuild in repo):**
- Add `apps/website/src/lib/ai-engine/` with the clinical service
- Integrate Mem0 client (`mem0ai` npm package, or use Cloudflare Vectorize)
- Implement risk detection against a documented list of patterns
- Re-skin the existing OpenAI proxy with a clinical persona

V1 pilot can ship with the existing direct LLM proxy + the CHAT-13/14/15/16 enhancements (Path C — placeholder). Full AI Engine integration is a separate workstream with its own sprint.

### Task P1.9.9 — Verification

- [ ] First-time user sees CHAT-13 greeting.
- [ ] Returning user after 30+ days sees CHAT-15 re-engagement greeting.
- [ ] Risk flag triggers crisis card, session continues.
- [ ] End conversation shows post-session summary screen.
- [ ] 90+ min session shows soft warning, then gracefully ends.
- [ ] Delete chat history removes all conversations and memory.

**Done when:** Chat has the 4 high-stakes UX moments (first session, post-session, long absence, crisis) all defined and working. Risk/AI Engine integration follows Phase 0 decision.

---

## P1.10 — EPIC-04: Risk & Safety Escalation — v1 (Weeks 10-12, with clinical lead)

> PRD: RISK-1 to RISK-20. This is the safety-critical epic. Legal/clinical policy must be signed off (Phase 0 deliverable 1) before implementation.

### Task P1.10.1 — `risk_flags` + `escalation_cases` tables

File: `apps/website/supabase/migrations/20260624000004_create_risk_and_escalation.sql`

```sql
create type public.risk_tier as enum ('standard','critical');

create type public.case_status as enum ('open','assigned','in_followup','re_escalated','resolved','dismissed');

create table if not exists public.risk_flags (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  session_id text not null, -- from Cloudflare KV
  tier public.risk_tier not null default 'standard',
  ai_summary text, -- RISK-8
  trigger_pattern text, -- what pattern triggered the flag (Phase 0 deliverable)
  created_at timestamptz not null default now()
);

create table if not exists public.escalation_cases (
  id uuid default gen_random_uuid() primary key,
  risk_flag_id uuid not null references public.risk_flags(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  status public.case_status not null default 'open',
  primary_assignee uuid references auth.users(id), -- clinical staff
  backup_assignee uuid references auth.users(id), -- RISK-10
  acknowledged_at timestamptz,
  followup_attempts jsonb not null default '[]', -- RISK-18 follow-up log
  outcome text, -- 'reached'|'unreachable'|'referred'|'emergency'|'no_action'
  outcome_notes text,
  resolved_by uuid references auth.users(id), -- RISK-20: senior clinical staff only
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_cases_status on public.escalation_cases(status) where status not in ('resolved','dismissed');
create index idx_cases_assignee on public.escalation_cases(primary_assignee) where status = 'assigned';
create index idx_cases_company on public.escalation_cases(company_id);

-- RLS: clinical staff see cases in their assigned companies; super admin sees all
alter table public.escalation_cases enable row level security;

create policy "clinical_staff_view_cases" on public.escalation_cases
  for select using (
    public.current_user_role_in(company_id) in ('clinical_staff','super_admin')
  );

create policy "clinical_staff_update_assigned" on public.escalation_cases
  for update using (
    primary_assignee = auth.uid() or backup_assignee = auth.uid()
    or public.current_user_role_in(company_id) = 'super_admin'
  );
```

### Task P1.10.2 — Effect-TS domain: `risk` and `escalation`

At `apps/website/src/domain/risk/` and `apps/website/src/domain/escalation/`. Key programs:

`risk`:
- `flagRiskProgram(userId, sessionId, tier, summary, trigger)` — called by AI Engine webhook or polling
- `getActiveFlagsProgram(companyId?)` — for clinical staff queue
- `getRiskSummaryProgram(companyId)` — anonymized aggregate for ADM-3

`escalation`:
- `createCaseProgram(riskFlagId)` — auto on flag (if tier=critical) or manual (if tier=standard after triage)
- `assignCaseProgram(caseId, primaryAssignee, backupAssignee)` — RISK-18
- `dismissFlagProgram(riskFlagId, reasonCode)` — RISK-4
- `logFollowupAttemptProgram(caseId, attemptData)` — RISK-18 follow-up log
- `escalateToEmergencyProgram(caseId, checklistData)` — RISK-12 with 119 checklist
- `triggerUnreachableProtocolProgram(caseId)` — RISK-19
- `markResolvedProgram(caseId, outcome, reason, resolvedBy)` — RISK-20, requires role check

### Task P1.10.3 — Notification mechanism (RISK-17)

Two channels: in-app + email. SMS deferred to Phase 2 (carrier cost).

Email via Resend (Phase 0): notification template to clinical staff includes AI summary, anonymized.

In-app: real-time via Supabase Realtime channel subscribed to `escalation_cases` table for clinical staff role.

### Task P1.10.4 — Two-tier priority queue (RISK-6)

Page: `apps/website/src/pages/risk-queue/index.astro`. Two tabs: "Critical" (default view) and "Standard". Each shows a table of cases with anonymized context.

### Task P1.10.5 — Case detail view (RISK-8, RISK-18, RISK-19, RISK-20, RISK-12)

Page: `apps/website/src/pages/risk-queue/[id].astro`. Sections:
- AI summary (RISK-8)
- Full anonymized session transcript (read-only)
- Assign action — pick from clinical staff list (RISK-18)
- Follow-up attempt log (RISK-18)
- Dismiss with reason code (RISK-4)
- Escalate to emergency checklist (RISK-12) — Dialog with steps
- Unreachable protocol (RISK-19)
- Resolution gate (RISK-20) — disabled for non-senior staff

Reuse: `Card`, `Dialog`, `Table`, `Badge`, `Button`, `AlertDialog`, `Textarea`.

### Task P1.10.6 — Psychologist console (Journey E, EPIC-04 RISK-18)

Page: `apps/website/src/pages/risk-queue/assigned.astro`. Lists cases where current user is primary or backup assignee. Each case row has: AI summary, "Log contact attempt" button, "Mark outcome" button.

### Task P1.10.7 — Employee case-closed message (RISK-16)

When case is resolved, push an in-app message to the employee (not email — privacy, no lock-screen exposure). Message: "Your recent conversation has been reviewed and closed. We're here whenever you want to talk again."

Delivery: store in `notifications` table (new), show in chat header banner on next visit.

### Task P1.10.8 — After-hours on-call model (RISK-15)

Implement per Phase 0 deliverable 4 (after-hours model decision). V1: in-app crisis card shows, on-call page triggers, but platform never says "help is on the way" unless a human has acknowledged via a specific "acknowledge page" endpoint.

If no clinical staff is on duty (based on `staffing_schedule` table), the card shows a longer text: "Our clinical team is currently off-duty. Here's the Into The Light Indonesia hotline: 119 ext. 8"

### Task P1.10.9 — Pattern detection (RISK-11)

Background job: count flags per (user_id, 30-day window). If >= 3, set `users.chronic_risk` flag. UI: chronic-risk badge in clinical staff case view.

### Task P1.10.10 — Verification

- [ ] Trigger a risk flag (test by setting risk pattern in chat). Clinical staff receives in-app + email notification within 60s.
- [ ] Assign case to a psychologist. Psychologist sees it in their queue. Psychologist logs 3 follow-up attempts. Unreachable protocol fires.
- [ ] Mark case as resolved. Junior staff cannot (button disabled). Senior staff can.
- [ ] Employee next visit sees "case closed" message in chat header.
- [ ] Pattern detection: trigger 3 flags for same user, verify chronic-risk badge appears.

**Done when:** Risk detection, triage, assignment, follow-up, resolution, and employee notification all work end-to-end. Policy-approved, clinically safe.

---

## P1.11 — Phase 1 Verification + Pilot (Weeks 11-12)

### Task P1.11.1 — End-to-end smoke test

- [ ] Super Admin creates a tenant via handoff form.
- [ ] Company Admin uploads a 10-row CSV, invites 10 employees.
- [ ] Each employee signs up, completes profile, sees orientation, lands in chat.
- [ ] Employees chat, one triggers a crisis pattern. Crisis card appears, clinical staff is paged.
- [ ] Clinical staff triages, assigns, follows up, resolves.
- [ ] Company Admin sees anonymized aggregate risk count on dashboard.
- [ ] Quota: 5 of 10 employees exceed quota. Others see quota-exhausted screen.
- [ ] Super Admin sees the tenant's MAU, billing, activity log.

### Task P1.11.2 — Pilot kickoff

- [ ] Choose 1 design-partner client (not Mayapada) — the CPO owns this.
- [ ] Onboard them through the standard flow.
- [ ] Run for 2-4 weeks with daily feedback.
- [ ] Track activation (sign-up completion), MAU, session count, risk flags, support tickets.

### Task P1.11.3 — Phase 1 launch readiness

- [ ] All PRD Phase 1 deliverables in PRD §14 are implemented and tested.
- [ ] Legal/ToS/MSA signed by pilot client.
- [ ] SLA: 99.5% chat uptime (PRD §12 NFR).
- [ ] Privacy: anonymized risk counts verified — no PII leaks to HR.
- [ ] Documentation: Super Admin runbook, Company Admin onboarding guide, Clinical Staff escalation playbook.

**Phase 1 done when:** Pilot client is live, all 4 user journeys (A, B, C, D, E) work end-to-end, safety baseline (crisis card + 119 hotline) is live, quota billing works.

---

# PHASE 2 — Scale & Monetize (Weeks 13-24, target Q4 2026)

> PRD reference: Section 14 Phase 2.

Sequenced by value-to-effort ratio. Can run multiple epics in parallel with separate teams.

## P2.1 — EPIC-12: Notifications & Engagement (Weeks 13-15)

### Task P2.1.1 — `notifications` + `notification_preferences` tables

```sql
create type public.notification_channel as enum ('in_app','email','push','sms');
create type public.notification_category as enum ('re_engagement','content_progress','announcement','alert','crisis');

create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category public.notification_category not null,
  title text not null,
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  channel public.notification_channel not null,
  category public.notification_category not null,
  enabled boolean not null default true,
  primary key (user_id, channel, category)
);
```

### Task P2.1.2 — In-app notification center

Component: `apps/website/src/components/notifications/NotificationCenter.tsx`. Bell icon in chat header, shows unread count, opens a `Popover` with notification list. Reuse `Popover` from `packages/core/src/ui/` (install if not present).

### Task P2.1.3 — Re-engagement cron (ENG-1)

Cloudflare cron, runs daily:
- For each user, check `last_session_at`
- If `now - last_session_at >= 7 days` and notification opt-in, send a gentle re-engagement email + in-app notification
- Use ENG-6 generic copy (never reference specific session content)

### Task P2.1.4 — Company Admin announcement (ENG-3)

In admin console `/admin/announcements`: form (title, body, target_audience). Send triggers in-app + email to all active employees. Log to audit log.

### Task P2.1.5 — Preference center (ENG-4)

Page: `/account/notifications`. Matrix view: category × channel, toggle each. Saves to `notification_preferences`.

### Task P2.1.6 — Pulse survey (ENG-7)

Page: `/admin/pulse-survey/new`. Form: 3 multiple-choice questions (no free-text — privacy). Sends to all employees, results aggregated, displayed only if response count >= 5 (WFA-2 min group size).

## P2.2 — EPIC-14: Mood Check-in & Daily Pulse (Weeks 14-16, parallel with P2.1)

### Task P2.2.1 — `mood_entries` table

```sql
create table if not exists public.mood_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now()
);
create index idx_mood_user_date on public.mood_entries(user_id, created_at desc);
```

RLS: users see own only, anonymized aggregate via materialized view for company admin.

### Task P2.2.2 — Daily check-in prompt (MOOD-1)

Component: `apps/website/src/components/mood/DailyMoodPrompt.tsx`. Shows on first chat visit each day. Emoji scale 1-5. Skippable (MOOD-4).

### Task P2.2.3 — Mood trend chart (MOOD-2)

In personal dashboard: 4-week trend chart using `Chart` primitive.

### Task P2.2.4 — AI context injection (MOOD-3)

In `pages/api/chat.ts`, include latest mood score in system prompt context (AI Engine may handle this in Path A from P1.9.8).

## P2.3 — EPIC-18: Bookmarks v1 (Weeks 15-16, parallel)

### Task P2.3.1 — `bookmarks` table (privacy-scoped, BKM-5)

```sql
create table if not exists public.bookmarks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('chat_message','content_step','technique')),
  source_id text not null,
  content_snapshot text not null, -- BKM-6: store text at save time
  note text, -- BKM-3
  tags text[] not null default '{}', -- BKM-4
  created_at timestamptz not null default now()
);

-- RLS: strict — never readable by anyone but the user
alter table public.bookmarks enable row level security;
create policy "users_manage_own_bookmarks" on public.bookmarks
  for all using (auth.uid() = user_id);

-- Exclusion from analytics: bookmark queries must never join to company aggregates
-- Documented in the bookmark repository
```

### Task P2.3.2 — Bookmark action in chat (BKM-1)

In `MessagesView.tsx`, add a `Bookmark` icon button to each AI message bubble. Click opens `Dialog` to add a note + tags.

### Task P2.3.3 — Bookmark library view

Update existing `/bookmarks` page to render from Supabase instead of localStorage.

## P2.4 — EPIC-15: Goal-Setting & Progress Tracking (Weeks 16-18)

### Task P2.4.1 — `goals` + `milestones` tables

```sql
create table if not exists public.goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  status text not null default 'active' check (status in ('active','achieved','abandoned')),
  source text not null default 'chat' check (source in ('chat','self','clinical')),
  created_at timestamptz not null default now(),
  achieved_at timestamptz
);
```

### Task P2.4.2 — Goal-setting integration with AI (GOAL-1, GOAL-2)

Either via AI Engine contract (Path A) or via system-prompt augmentation in `pages/api/chat.ts`. AI suggests 1-2 goals at natural conversational moments, employee confirms.

### Task P2.4.3 — Milestone tracker (GOAL-3)

Personal dashboard section: timeline of goals achieved, sessions completed, programs finished.

## P2.5 — EPIC-16: Workforce Analytics (Weeks 18-20)

### Task P2.5.1 — `company_departments` + materialized views

```sql
create table if not exists public.company_departments (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  unique (company_id, name)
);

-- Materialized view, refreshed daily
create materialized view public.daily_company_metrics as
select
  c.id as company_id,
  d.id as department_id,
  date_trunc('day', m.created_at) as day,
  count(distinct m.user_id) as dau,
  count(*) as sessions
from public.companies c
join public.user_company_memberships m on m.company_id = c.id and m.is_active
left join ... -- join to departments via invitation email dept
group by c.id, d.id, day;
```

### Task P2.5.2 — Analytics dashboard v2 (WFA-1, WFA-2, WFA-3)

Extend `/admin/dashboard` with: utilization benchmark (from cross-tenant aggregate), department breakdown (respecting min group size 5 per WFA-2), mood trend by department (if MOOD data exists).

### Task P2.5.3 — PDF/CSV export (WFA-5, ADM-5)

Use `jspdf` or `pdfkit` for PDF, native CSV generation for CSV. Export button on analytics view.

## P2.6 — EPIC-06: Billing — PAYG + Invoicing (Weeks 18-20, parallel)

### Task P2.6.1 — Xendit integration (real)

Wire `apps/website/src/lib/payments/xendit.ts` to real Xendit API: create invoice on quota exhaustion, handle payment webhook, automatic suspension on overdue (BILL-5, BILL-6).

### Task P2.6.2 — Recurring invoicing (BILL-3)

Cloudflare cron on billing cycle date: generate invoice via Xendit, email to Company Admin, mark as paid on webhook success.

### Task P2.6.3 — Scheduled tier change (BILL-9)

Super Admin UI to schedule a tier change with future effective date. Stored in `scheduled_billing_changes` table, applied by cron on the effective date.

## P2.7 — EPIC-08: N2CIAS Opt-in Toggle (Weeks 20-22, parallel)

### Task P2.7.1 — `n2cias_*` tables (clone of assessment, scoped to company)

Per EPIC-08 ASS-1: opt-in toggle. Schema, RLS, anonymization rules (ASS-2). The actual N2CIAS FE/BE integration is a separate workstream (not in this repo).

## P2.8 — EPIC-11: Self-Guided Content v1 (Weeks 20-24)

### Task P2.8.1 — `content_programs`, `lessons`, `program_steps` tables

```sql
create table if not exists public.content_programs (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  category text not null, -- 'stress','sleep','burnout','anxiety', etc.
  description text,
  estimated_minutes integer,
  clinical_review_status text not null default 'draft' check (clinical_review_status in ('draft','in_review','approved','live','retired')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
-- lessons, program_steps follow
```

### Task P2.8.2 — Content review workflow (per Open Q #8)

Page: `/super-admin/content-review`. Lists content in `draft` or `in_review` state. Clinical reviewer approves, sets `clinical_review_status = 'live'`.

### Task P2.8.3 — Employee program browser + player (CONT-1, CONT-2)

Pages: `/programs` (browse), `/programs/[id]` (detail), `/programs/[id]/lessons/[n]` (interactive player reusing chat UI).

### Task P2.8.4 — Engagement tracking (CONT-3, CONT-4)

Log employee engagement in `content_engagement` table. Aggregate by company for ADM analytics (category-level only, never individual — CONT-4).

### Task P2.8.5 — Clinical staff recommendation (CONT-5)

In `risk-queue/[id]`, add a "Recommend program" action. Sends in-app notification to employee with the program link.

## P2.9 — EPIC-19: Skills & Techniques Library v1 (Weeks 22-26)

> Note: The existing `skills` table is LibreChat-style AI skills — a naming collision. SKL-* needs new tables.

### Task P2.9.1 — `techniques` + `practice_log` tables (renamed to avoid collision)

```sql
create table if not exists public.techniques (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  category text not null check (category in ('breathing','grounding','cbt','sleep','mindfulness')),
  when_to_use text not null,
  guided_practice_steps jsonb not null, -- [{type:'timer',duration:60}, {type:'prompt',text:'...'}]
  clinical_review_status text not null default 'draft' check (clinical_review_status in ('draft','in_review','approved','live')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
```

### Task P2.9.2 — Skills library browser (SKL-1)

Page: `/techniques`. Searchable by keyword and category. Each technique card opens a practice player (SKL-3).

### Task P2.9.3 — In-chat unlock (SKL-2) + recommendation (SKL-4)

In chat, AI Engine or system prompt can surface a technique card. Tapping it opens the practice inline.

### Task P2.9.4 — Clinical assignment (SKL-6)

In `risk-queue/[id]`, "Assign technique" action. Pinned to employee's library.

## P2.10 — EPIC-17: Freemium & Trial Tier (Weeks 24-26, parallel)

### Task P2.10.1 — Trial provisioning flow

Self-serve signup form (no invitation). Creates company with `billing_tier = 'trial'`, `session_quota = N (configurable)`. Trial period 14 days.

### Task P2.10.2 — Trial-to-paid conversion (FREE-3)

Super Admin action converts trial → paid. Same `company_id`, all data preserved, only billing state changes.

### Task P2.10.3 — Trial expiry warning (FREE-5)

Cron at 7 days before expiry: send email warning. On expiry, suspend (BILL-6 logic). Super Admin can reactivate.

## P2.11 — EPIC-13: HRIS & SSO Foundation (Weeks 24-28)

> Assumes Supabase Enterprise plan confirmed (Phase 0 decision).

### Task P2.11.1 — `sso_connections`, `hris_connections` tables

Per-tenant. Schema for OAuth credentials, sync schedule, conflict log.

### Task P2.11.2 — First HRIS connector

Pick one (e.g., GreytHR for Indonesia market, or BambooHR for global). Build the connector.

### Task P2.11.3 — SSO config UI

Company Admin: `/admin/integrations`. Connect to OIDC or SAML IdP. Test flow.

### Task P2.11.4 — Sync conflict review queue (INT-4)

UI for Company Admin to approve/reject HRIS sync conflicts.

---

# PHASE 3 — Expand (2027, weeks 29+)

> PRD reference: Section 14 Phase 3.

## P3.1 — Multi-language Support

- [ ] Add `i18n` to Astro (e.g., `@astrojs/i18n` or `astro-i18next`).
- [ ] Extract all hardcoded strings to `apps/website/src/locales/{en,id}.json`.
- [ ] Add Bahasa Indonesia, English (existing), then add others per market (Malay, Thai, etc.).
- [ ] AI Engine / chat: pass user's language to system prompt.

## P3.2 — Native Mobile App

- [ ] Decision: React Native or native (iOS Swift + Android Kotlin)?
- [ ] Set up monorepo for mobile packages.
- [ ] Reuse Effect-TS domain layer (backend-agnostic).
- [ ] Reuse `packages/core` shadcn primitives via a shadcn-for-React-Native port (or build a parallel mobile UI library).

## P3.3 — White-Labeling for Channel Partners

- [ ] Per-tenant subdomain support (`{client}.tenang.id`).
- [ ] Custom domain support (CNAME).
- [ ] Per-tenant email sender domain (DKIM/SPF setup).
- [ ] Per-tenant app store listings (white-label mobile apps).

## P3.4 — Payroll/HRIS Platform Channel Partnership

- [ ] Identify partner (e.g., PayrollPlans as PRD §4.3 notes, or local payroll providers).
- [ ] Build API for partner to provision trials.
- [ ] Co-marketing + GTM.

## P3.5 — B2C Transition Path

Resolves the EMP-15 (employee leaves company) accepted risk in PRD §8.5 #1.5.

- [ ] "Convert to personal account" flow after offboarding.
- [ ] Data ownership clarification in ToS.
- [ ] Mutual data deletion / portability.

---

# Cross-Phase Workstreams

## Testing Strategy

**Per-domain Vitest tests** at `apps/website/src/domain/<feature>/__tests__/`. Pattern from `auth.programs.test.ts`.

**E2E tests** via Playwright in `apps/website/tests/e2e/`. Cover the 5 user journeys from PRD §8.

**Cross-tenant isolation tests** as SQL files in `apps/website/supabase/tests/`. Run on every migration.

**RLS verification** — automated check that every new table has RLS enabled and at least one policy.

## Documentation

- [ ] `docs/architecture/` — system diagrams, data flow, AI Engine contract
- [ ] `docs/runbooks/super-admin.md` — onboarding, incident response, billing ops
- [ ] `docs/runbooks/company-admin.md` — bulk invite, branding, interpreting analytics
- [ ] `docs/runbooks/clinical-staff.md` — triage protocol, emergency escalation, case closure
- [ ] `docs/compliance/uu-pdp.md` — privacy impact assessment, retention policy, breach procedure
- [ ] `docs/content/` — clinical content authoring guide (for EPIC-11, EPIC-19)

## Observability

- [ ] Cloudflare Analytics for traffic.
- [ ] Supabase Logs for DB queries.
- [ ] Sentry for client + server errors.
- [ ] Custom audit log for privileged actions (P1.1.5).
- [ ] Uptime monitoring for chat API.

## Security

- [ ] Rate limiting on all API routes (Cloudflare WAF or middleware).
- [ ] Input validation via Effect-TS schemas (every API route).
- [ ] CSRF protection for state-changing requests.
- [ ] CSP headers, HSTS, X-Frame-Options.
- [ ] Dependency audit in CI (`pnpm audit`).
- [ ] Quarterly pen test before each enterprise contract.

---

# Summary: Effort by Phase

| Phase | Duration | Key deliverables |
|---|---|---|
| **Phase 0** | Week 1 | Legal/policy, engineering audit, architecture decisions |
| **Phase 1** | Weeks 2-12 | B2B MVP: multi-tenant, super admin, company admin, employee auth, branding, bulk invite, quota billing, AI chat v1, risk/safety v1, design-partner pilot |
| **Phase 2** | Weeks 13-26 | Notifications, mood, goals, bookmarks, analytics, PAYG billing, N2CIAS, content library, skills library, freemium, HRIS/SSO |
| **Phase 3** | 2027+ | Multi-language, native mobile, white-label, payroll channel, B2C transition |

**Total: ~26 weeks (6 months) to Phase 2 complete, ~12 months to Phase 3 expansion.**

---

# Open Questions Tracked from PRD §17

The following MUST be resolved (in Phase 0) before the corresponding task can start:

| # | Question | Blocks | Phase 0 owner |
|---|---|---|---|
| 1 | Risk flag thresholds | EPIC-04 | Clinical Lead + AI Engineer |
| 2 | Clinical staffing model | EPIC-04 | Operations |
| 3 | Super Admin / Company Admin console: separate or unified | EPIC-09 | CPO + Eng Lead |
| 4 | Build vs consume AI Engine | EPIC-03 (full) | CPO + Eng Lead |
| 5 | Unit cost per session | EPIC-06 PAYG pricing | Finance |
| 6 | EPIC-11 content source (in-house vs licensed) | EPIC-11 | Clinical Lead |
| 7 | EPIC-16 minimum group size | EPIC-16 | CPO |
| 8 | EPIC-19 clinical review owner | EPIC-19 | Clinical Lead |
| 9 | Freemium self-serve vs sales-assisted | EPIC-17 | Sales + Legal |
| 10 | After-hours on-call model | EPIC-04 RISK-15 | Operations + Clinical Lead |
| 11 | First-session AI greeting content | EPIC-03 CHAT-13 | Clinical Lead |
| 12 | Resolution authority definition | EPIC-04 RISK-20 | Clinical Lead |
| 13 | Psychologist contact SLA | EPIC-04 RISK-18 | Clinical Lead |
| 14 | Invitation email content | EPIC-01/02 | Clinical + Marketing + Legal |
| 15 | CHAT-13/15 clinical approval process | EPIC-03 | Clinical Lead |
| 16 | Psychologist contact method (phone vs in-app) | EPIC-04 + EMP-2 | Clinical + Eng Lead |
| 17 | Senior clinical staff role definition | EPIC-04 RISK-19/20 | Clinical Lead + HR |

---

# APPENDIX A — Critical Path Per User Role & Journey

This appendix breaks down the implementation by **user role** and **user journey**, with explicit **positive case** (happy path) and **negative case** (error/edge) handling. Each journey stage maps to a specific PRD reference (Section 8) and to the tasks defined in the main plan above.

**Conventions:**
- ✅ = Positive case (happy path / required state)
- ⚠️ = Negative case (error state / edge case that must be handled)
- 🛑 = Hard stop (legal/safety block; cannot proceed)
- 🔁 = Loop/iteration (user retries or system auto-retries)
- 📊 = Telemetry (log/metric must be captured)
- All test cases are required for the journey to be considered "shipped."

---

## A.1 — Role: Employee (Persona: "Budi")

Mapped to: **Journey A** (PRD §8.1) + Journey updates in §8.9.

### Critical Path Stages

| # | Stage | Touchpoint | PRD Ref | Plan Task |
|---|---|---|---|---|
| 1 | Receive invitation email | Email inbox | §8.1.1, EMP-16 | P1.4.4, P1.4.5 |
| 2 | Click invitation link | Browser | §8.1.1 | P1.5.3 |
| 3 | B2C conflict check | /sign-up page | §8.1.2, EMP-17 | P1.5.6 |
| 4 | Register with email + password | /sign-up form | §8.1.2, EMP-1 | P1.5.1, P1.5.2 |
| 5 | Verify OTP | /verify page | §8.1.3, EMP-1 | P1.5.2 |
| 6 | Complete profile | /update-profile | §8.1.4, EMP-2 | P1.5.4 |
| 7 | See orientation | /onboarding/orientation | §8.1.4b, EMP-16 | P1.5.5 |
| 8 | First chat session | /c/ | §8.1.5, CHAT-1, CHAT-13 | P1.9.1 |
| 9 | Mid-session risk flag | In-chat | §8.1.5b, CHAT-16, RISK-15 | P1.9.4, P1.10.8 |
| 10 | End session → post-session summary | PostSessionSummary | §8.1.6, CHAT-14 | P1.9.2 |
| 11 | Return next day | /c/ | §8.1.7, CHAT-2 | Existing chat island |
| 12 | Return after 30+ days | /c/ | §8.1.7b, CHAT-15 | P1.9.3 |
| 13 | Try to chat when quota=0 | /c/ | §8.1.8, BILL-4 | P1.7.4 |
| 14 | Pause account | /account/pause | EMP-11 | P1.5.7 |
| 15 | Change work email | /account/email | EMP-10 | P1.5.7 |
| 16 | Deactivated by Company Admin | (forced) | EMP-8, EMP-14 | P1.6.3 |
| 17 | Leave company → data retention | (timer) | TEN-3, EMP-8 | Phase 0 policy |

### Positive vs Negative Case Matrix

#### Stage 1: Receive Invitation Email

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 1.1 | ✅ Invitation sent, email delivered | Positive | Email in inbox within 5 min; subject + body match Phase 0 approved copy | P1.4.4 |
| 1.2 | ⚠️ Email goes to spam | Negative | Auto-resend after 10 min if no click tracked; Resend deliverability dashboard monitored | P1.4.3 + monitoring |
| 1.3 | ⚠️ Email bounces (invalid address) | Negative | Bounce webhook from Resend → mark `invitations.status = 'expired'`, notify Company Admin | P1.4.2 |
| 1.4 | ⚠️ Email never sent (Resend API error) | Negative | Retry 3x with exponential backoff; after 3 fails, mark invitation `failed` + alert admin | P1.4.3 |
| 1.5 | ⚠️ Employee's email client blocks images/links | Negative | Plain-text alt in email; link is full URL not anchor | P1.4.4 |
| 1.6 | 🛑 Invitation contains wrong company name | Hard stop | Block at send time; Company Admin re-uploads CSV; never send incorrect data | P1.4.5 |

#### Stage 2: Click Invitation Link

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 2.1 | ✅ Link valid, lands on /sign-up?invitation=<token> | Positive | Sign-up form pre-populated with email; "Welcome to {companyName}" header | P1.5.3 |
| 2.2 | ⚠️ Link expired (24h) | Negative | Show "Invitation expired" page with "Contact your HR admin for a new invite" + mailto link | P1.5.3 + P1.4.2 (verifyInvitationToken) |
| 2.3 | ⚠️ Link tampered with | Negative | JWT signature check fails; show "Invalid invitation link" generic error | P1.4.2 |
| 2.4 | ⚠️ Link already used (employee already accepted) | Negative | "You've already accepted this invitation — log in instead" with link to /login | P1.4.2 |
| 2.5 | 🛑 Token reused from different company | Hard stop | JWT issuer + audience validation prevents cross-company token reuse | P1.4.1 |
| 2.6 | 📊 Click tracking | Telemetry | Log invitation open event with timestamp + IP country (no PII) | P1.4.2 |

#### Stage 3: B2C/B2B Same-Email Conflict

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 3.1 | ✅ Email new to system | Positive | Proceed to standard sign-up | P1.5.6 |
| 3.2 | ⚠️ Email exists as B2C user (no company) | Negative | Show EMP-17 conflict screen: explain separation, offer "Continue" (links account) or "Use different email" | P1.5.6 |
| 3.3 | ⚠️ Email exists as employee in different company | Negative | Block: "This email is already registered with {otherCompany}. Please contact your HR." | P1.5.6 |
| 3.4 | ⚠️ Email exists as company admin in same company | Negative | Per EMP-15: allow; same account gets both roles via `user_company_memberships` | P1.5.6 + P1.1.6 |
| 3.5 | 🛑 Email exists as super admin | Hard stop | Block: "This email cannot be used for employee accounts" (security) | P1.5.6 |

#### Stage 4: Register (Email + Password)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 4.1 | ✅ Valid email, strong password | Positive | Account created with `company_id` linked via membership | P1.5.2 |
| 4.2 | ⚠️ Email malformed | Negative | Client-side + server-side validation (regex); show inline error | P1.5.1 |
| 4.3 | ⚠️ Password too weak | Negative | Live strength meter; reject if < 8 chars; show requirements | P1.5.1 |
| 4.4 | ⚠️ Email already registered globally | Negative | Show "Email already registered" with "Log in" / "Reset password" links | P1.5.1 |
| 4.5 | ⚠️ Supabase rate limit hit | Negative | Show "Too many attempts, try again in X minutes"; exponential backoff in client | Existing auth + new retry logic |
| 4.6 | ⚠️ Network drop mid-submit | Negative | Client retries with idempotency key; form preserves input | P1.5.x |
| 4.7 | 📊 Signup attempt counter | Telemetry | Log attempts with success/fail + IP country for fraud detection | Existing + audit log |

#### Stage 5: Verify OTP

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 5.1 | ✅ OTP entered correctly within 10 min | Positive | Session created; redirect to /update-profile | P1.5.2 |
| 5.2 | ⚠️ OTP expired | Negative | Show "Code expired" + "Resend code" button | P1.5.7 (EMP-4) |
| 5.3 | ⚠️ OTP wrong (typo) | Negative | "Invalid code" + retry; max 5 attempts then lock for 15 min | P1.5.7 |
| 5.4 | ⚠️ OTP never received (email delay) | Negative | "Resend code" button (rate-limited 3/15 min per EMP-4) | P1.5.7 |
| 5.5 | ⚠️ User clicks "Change email" mid-OTP | Negative | Resets flow, sends new OTP to new email | P1.5.7 |
| 5.6 | 🛑 OTP brute-force attempt (>5 wrong) | Hard stop | Account lockout 15 min; alert if persistent (security event log) | P1.5.7 |
| 5.7 | 📊 OTP success/fail metrics | Telemetry | Time-to-verify, failure rate, resend count per session | P1.5.7 |

#### Stage 6: Complete Profile

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 6.1 | ✅ All required fields filled | Positive | Profile saved; redirect to /onboarding/orientation | P1.5.4 |
| 6.2 | ⚠️ Required field missing (age range) | Negative | Inline validation; submit disabled | P1.5.4 |
| 6.3 | ⚠️ Phone format invalid (if collected per Open Q #16) | Negative | Country-aware validation; show example format | P1.5.4 |
| 6.4 | ⚠️ Employee under 18 (per §8.6 #1.9 policy) | Negative | Block: "Tenang is for adults 18+. Please contact your HR." | P1.5.4 + Phase 0 policy |
| 6.5 | ⚠️ Employee skips "optional" fields then submits | Negative | All optional; submission succeeds | P1.5.4 |
| 6.6 | ⚠️ Network drop mid-save | Negative | Auto-save draft to localStorage; restore on reload | P1.5.4 |
| 6.7 | 📊 Profile completion rate | Telemetry | % invited → % completed profile (funnel metric) | P1.5.4 |

#### Stage 7: Orientation Screen

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 7.1 | ✅ Employee reads + clicks "Get started" | Positive | Set `users.onboarding_completed_at`; redirect to /c/ | P1.5.5 |
| 7.2 | ⚠️ Employee clicks "Re-read this later" | Negative | Confirmation: "Are you sure? You can access this from Settings later." Skip with confirmation per EMP-16 AC | P1.5.5 |
| 7.3 | ⚠️ Employee closes browser without choosing | Negative | On next login, orientation re-appears (not yet completed) | P1.5.5 |
| 7.4 | 📊 Orientation skip rate | Telemetry | Track % who skip vs read (drives content iteration) | P1.5.5 |

#### Stage 8: First Chat Session (CHAT-13)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 8.1 | ✅ First-time user, normal flow | Positive | AI uses approved first-session greeting (Phase 0 deliverable 5) | P1.9.1 |
| 8.2 | ⚠️ First chat starts during risk-prone moment | Negative | CHAT-13 greeting is empathetic but also surfaces crisis resources proactively | P1.9.1 + P1.9.4 |
| 8.3 | ⚠️ User opens chat immediately (no orientation) | Negative | Orientation flow is forced before chat access | P1.5.5 |
| 8.4 | 🛑 AI greeting contains unapproved copy | Hard stop | Hard-coded prompt template; cannot be modified by LLM | P1.9.1 |

#### Stage 9: Mid-Session Risk Flag (CHAT-16, RISK-15)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 9.1 | ✅ Flag fires, clinical staff on duty | Positive | Crisis card appears; session continues; clinical staff notified; staff acknowledges page | P1.9.4, P1.10.3, P1.10.8 |
| 9.2 | ⚠️ Flag fires, no clinical staff on duty (after-hours) | Negative | Crisis card appears with extended copy: "Clinical team is off-duty. Contact 119 ext. 8" | P1.10.8 |
| 9.3 | ⚠️ Flag fires, employee dismisses crisis card | Negative | Card reappears at next session start (safety persistence) | P1.9.4 |
| 9.4 | ⚠️ Flag fires repeatedly (false positive pattern) | Negative | RISK-4 dismiss-with-reason feeds detection tuning; chronic-risk if 3+ in 30d | P1.10.2, P1.10.9 |
| 9.5 | ⚠️ Employee asks "is help coming?" | Negative | AI never says "help is on the way" unless human acknowledged (per CHAT-16 AC) | P1.9.4, P1.10.8 |
| 9.6 | 🛑 Flag ignored by staff (no acknowledgement) | Hard stop | Backup assignee auto-notified at 15 min (RISK-10) | P1.10.2 |
| 9.7 | 🛑 Critical-tier flag at 3am, no on-call | Hard stop | Per RISK-15: card shows hotline, never implies help coming from staff | P1.10.8 |
| 9.8 | 📊 Risk flag volume, false positive rate | Telemetry | Per-tenant + global; feeds ML tuning loop | P1.10.1 |

#### Stage 10: End Session → Post-Session Summary (CHAT-14)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 10.1 | ✅ Normal session end | Positive | PostSessionSummary shows: 2-3 sentence summary, optional mood check-in (Phase 2 EPIC-14), 1 recommendation (Phase 2) | P1.9.2 |
| 10.2 | ⚠️ User closes browser mid-session | Negative | Session marked abandoned in audit; no summary shown (avoid partial summary) | P1.9.2 |
| 10.3 | ⚠️ AI summary contains PII employer shouldn't see | Negative | Summary is for employee only; never surfaced to Company Admin | P1.9.2 |
| 10.4 | ⚠️ Session ended by risk event (not user action) | Negative | Skip summary; show crisis card persistence; "We've notified our team" only if staff acknowledged | P1.9.4 |
| 10.5 | ⚠️ User wants to resume session | Negative | Show "Start new session" CTA; sessions are not pausable (lifecycle is start→end) | Existing chat island |

#### Stage 11: Return Next Day

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 11.1 | ✅ Returning user, normal flow | Positive | AI recalls prior context (Mem0 or memory layer); standard greeting | P1.9.8 + existing |
| 11.2 | ⚠️ Memory layer returns nothing (cold start) | Negative | AI opens with neutral "How are you today?" — no fake familiarity | Existing chat |
| 11.3 | ⚠️ User deleted history (CHAT-6) | Negative | No memory; treat as new context | P1.9.5 |

#### Stage 12: Return After 30+ Days (CHAT-15)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 12.1 | ✅ 30+ day absence | Positive | Re-engagement greeting (Phase 0 deliverable 6); no pressure | P1.9.3 |
| 12.2 | ⚠️ User feels guilty about absence | Negative | Greeting explicitly normalizes: "No rush, glad you're here" | P1.9.3 |
| 12.3 | ⚠️ User paused account (EMP-11) then returns | Negative | Treat as re-engagement; same protocol | P1.5.7 + P1.9.3 |
| 12.4 | 📊 Re-engagement success rate | Telemetry | % of 30+ day absentees who return and stay | P1.9.3 |

#### Stage 13: Quota Exhausted (BILL-4)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 13.1 | ✅ Quota at 0, user tries to chat | Positive | Quota-exhausted screen; "Contact {companyName} HR to increase plan" | P1.7.4 |
| 13.2 | ⚠️ User in active session when quota runs out | Positive | Session continues to natural end (BILL-8) | P1.7.1 |
| 13.3 | ⚠️ User retries clicking "Start chat" | Negative | Same screen, no error; clear copy | P1.7.4 |
| 13.4 | ⚠️ Quota resets (new billing cycle) | Positive | Session allowed again; no notification (avoid email spam) | P1.7.1 |
| 13.5 | 📊 Quota exhaustion incidents per tenant | Telemetry | Feed into ADM-11 low-adoption alert | P1.8.7 |

#### Stage 14: Pause Account (EMP-11)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 14.1 | ✅ User pauses voluntarily | Positive | All notifications suspended; data preserved; excluded from MAU | P1.5.7 |
| 14.2 | ⚠️ User pauses during open escalation case | Negative | Block: "Please contact our clinical team first about your open case" | P1.5.7 + RISK-14 check |
| 14.3 | ⚠️ User unpauses | Positive | All features restored; re-engagement state applies if 30+ days | P1.5.7 + P1.9.3 |
| 14.4 | 📊 Pause rate, average pause duration | Telemetry | Engagement health metric | P1.5.7 |

#### Stage 15: Change Work Email (EMP-10)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 15.1 | ✅ New email verified via OTP | Positive | Email updated; old email notified of security change | P1.5.7 |
| 15.2 | ⚠️ New email already exists | Negative | "Email already in use"; suggest logging into that account | P1.5.7 |
| 15.3 | ⚠️ New email outside company domain | Negative | Warn: "This email isn't from {companyName}. Continue?" (some users have personal forwarding) | P1.5.7 |
| 15.4 | ⚠️ OTP not verified within 10 min | Negative | Change reverted; user can retry | P1.5.7 |
| 15.5 | 🛑 Email change to super admin email | Hard stop | Block: "This email is reserved" | P1.5.7 |

#### Stage 16: Deactivated by Company Admin (EMP-8, EMP-14)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 16.1 | ✅ Single employee deactivated | Positive | Immediate session revocation; login blocked; data enters retention timer (TEN-3) | P1.5.7 + TEN-3 cron |
| 16.2 | ⚠️ Bulk deactivation > 20% of roster | Negative | AlertDialog requires Super Admin confirmation (EMP-14) | P1.6.3 |
| 16.3 | ⚠️ Employee has open escalation case | Negative | Block: "Resolve open case first" — unless Super Admin override | RISK-14 pattern in P1.10.2 |
| 16.4 | ⚠️ Employee is the only Company Admin | Negative | Block; warn: "Assign another admin first" | ADM-8 logic |
| 16.5 | 🛑 Deactivation of super admin without MFA | Hard stop | Block: "Enable 2FA first" | SUP-8 |

#### Stage 17: Leave Company → Data Retention (TEN-3)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 17.1 | ✅ Account deactivated, 30 days pass | Positive | PII deleted per TEN-3 policy; anonymized aggregates retained | TEN-3 cron |
| 17.2 | ⚠️ Reactivation request within retention window | Negative | Super Admin can restore | ADM-8 logic |
| 17.3 | ⚠️ Legal hold active (TEN-6) | Negative | Deletion skipped; flagged in audit log | TEN-6 |
| 17.4 | 🛑 Hard delete without retention | Hard stop | Never; TEN-3 retention is mandatory | TEN-3 |

---

## A.2 — Role: Company Admin / HR Lead (Persona: "Dewi")

Mapped to: **Journey B** (PRD §8.2) + updates in §8.9.

### Critical Path Stages

| # | Stage | Touchpoint | PRD Ref | Plan Task |
|---|---|---|---|---|
| 1 | Evaluation / sales | Sales calls | §8.2.1 | (sales-owned) |
| 2 | Contract signed; handoff to Super Admin | Email | §8.2.1b, SUP-12 | P1.2.5 |
| 3 | Receive admin credentials email | Email | §8.2.2, ONB-2 | P1.4.6 |
| 4 | Log in, complete "Getting started" wizard | /admin/onboarding | §8.2.2, B-2 | Phase 1.5 onboarding |
| 5 | Configure branding | /admin/branding | §8.2.3, EPIC-10 | P1.3.5 |
| 6 | Upload employee CSV | /admin/roster | §8.2.4, ONB-3, ONB-9 | P1.4.5 |
| 7 | Preview & confirm invites | Dialog | §8.2.4, ONB-9 | P1.4.5 |
| 8 | Monitor dashboard | /admin/dashboard | §8.2.5, ADM-1 | P1.6.2 |
| 9 | Receive low-adoption alert | Email | §8.2.5b, ADM-11 | P1.8.7 |
| 10 | Send company-wide announcement | /admin/announcements | §8.2.4, ENG-3 | P2.1.4 |
| 11 | Review anonymized risk counts | /admin/dashboard | §8.2.6, RISK-3 | P1.6.2 |
| 12 | View billing / quota | /admin/billing | §8.2.7, BILL-1 | P1.7.3 |
| 13 | Check activity log | /admin/activity-log | §8.2.7, ADM-12 | P1.6.4 |
| 14 | Pull renewal report | /admin/dashboard (export) | §8.2.9, ADM-5 | P2.5.3 |
| 15 | Receive 90-day renewal reminder | Email | §8.2.8, SUP-15 | P1.8.8 |
| 16 | Transfer admin role to colleague | /admin/team | ADM-9 | P1.6.3 |
| 17 | Leave company → admin handover | (forced) | ADM-8 | P1.6.3 |
| 18 | Raise support ticket on behalf of employee | /admin/support | ADM-10 | P1.6.5 |
| 19 | Account suspended (payment overdue) | (forced) | BILL-6 | P1.7.2 |
| 20 | Data breach report to DPO | /admin/incidents | §8.6 #2.7, SUP-7 | P1.8.9 |

### Positive vs Negative Case Matrix

#### Stage 2: Sales Handoff to Super Admin

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 2.1 | ✅ Complete handoff form | Positive | Super Admin proceeds with provisioning (SUP-13 SLA: 1 business day) | P1.2.5 |
| 2.2 | ⚠️ Incomplete form (missing billing model) | Negative | Form blocks submit until all required fields filled; clear inline errors | P1.2.5 |
| 2.3 | ⚠️ Company name duplicate | Negative | "A company with this name already exists — confirm if merger" | ONB-4 pattern |
| 2.4 | ⚠️ Contract end date in past | Negative | Block: "Contract end date must be in the future" | P1.2.5 |
| 2.5 | 🛑 Super Admin has no Super Admin MFA enabled | Hard stop | Block: "Enable 2FA before provisioning clients" (SUP-8) | P1.8.3 |

#### Stage 3: Receive Admin Credentials

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 3.1 | ✅ Email delivered, valid token | Positive | First-login wizard accessible | P1.4.6 |
| 3.2 | ⚠️ Email bounced | Negative | Super Admin notified; re-send or fix address | P1.4.6 + monitoring |
| 3.3 | ⚠️ Token expired (24h) | Negative | "Request new invite" form re-issues (ONB-5) | ONB-5 |
| 3.4 | ⚠️ Admin never accepts (48h) | Negative | Activation watch fires (SUP-13); Super Admin follows up | P1.8.x cron |

#### Stage 4: First Login

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 4.1 | ✅ First login, wizard starts | Positive | 3-step wizard: (1) Set password, (2) Configure branding, (3) Plan first invite | New wizard component |
| 4.2 | ⚠️ Admin skips wizard | Negative | Wizard re-appears next login until completed | New wizard component |
| 4.3 | ⚠️ Admin exits mid-wizard | Negative | State preserved in localStorage | New wizard component |
| 4.4 | 📊 Wizard completion rate | Telemetry | Time-to-onboard metric | New wizard component |

#### Stage 5: Configure Branding

See P1.3 task matrix (analogous cases for logo upload, color picker validation).

#### Stage 6-7: Bulk Invite

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 6.1 | ✅ Valid CSV, 50 employees | Positive | Preview shows count + first 10 rows + anomalies (none) → Confirm sends 50 emails | P1.4.5 |
| 6.2 | ⚠️ CSV has 5 malformed emails (typos) | Negative | Preview flags 5 rows in red; admin can fix or remove; valid rows send (ONB-6) | P1.4.5 |
| 6.3 | ⚠️ CSV has 10 duplicates within batch | Negative | Preview flags duplicates; admin can dedupe | P1.4.5 |
| 6.4 | ⚠️ CSV has 5 emails not matching company domain | Negative | Preview warns: "These may not be your employees" — confirm or remove | P1.4.5 |
| 6.5 | ⚠️ CSV exceeds 1000 rows | Negative | Block: "Bulk upload limited to 1000 rows — split into batches" | P1.4.5 |
| 6.6 | ⚠️ Resend API partial failure (e.g., 3 of 50 fail) | Negative | Show report: 47 sent, 3 failed with reason; downloadable CSV of failures | P1.4.3 + P1.4.5 |
| 6.7 | 🛑 Admin tries to invite to different company's domain | Hard stop | Block: "Email domain doesn't match {companyName}" | P1.4.2 |
| 6.8 | 📊 Invitation funnel | Telemetry | sent → opened → clicked → registered → profile_completed (per stage) | P1.4.2 |

#### Stage 8: Monitor Dashboard

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 8.1 | ✅ Active tenant, normal data | Positive | Dashboard shows 4 KPIs + 1 chart + risk count | P1.6.2 |
| 8.2 | ⚠️ Tenant just onboarded, no data | Positive | Empty state: "Your data will appear once employees start chatting" (ADM-4) | P1.6.2 |
| 8.3 | ⚠️ 1 employee only (privacy floor) | Negative | Aggregate metrics suppressed; "Need at least 5 employees to show trends" (per WFA-2) | P2.5.x |
| 8.4 | ⚠️ Dashboard query times out | Negative | Show "Loading..." + skeleton; retry once; if still fails, show error toast | P1.6.2 |
| 8.5 | 📊 Dashboard view frequency | Telemetry | Track admin logins to dashboard (PRD goal: 80% monthly) | P1.6.2 |

#### Stage 9: Low-Adoption Alert (ADM-11)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 9.1 | ✅ Utilization drops < 10% MAU for 14 days | Positive | Email to Company Admin with suggested action | P1.8.7 |
| 9.2 | ⚠️ Admin ignores first alert, still low 7 days later | Negative | Second alert with stronger copy | P1.8.7 |
| 9.3 | ⚠️ Admin marks alert as "resolved manually" | Negative | Suppresses future alerts for 30 days (configurable) | P1.8.7 |
| 9.4 | ⚠️ New tenant (under 30 days) | Negative | Suppress alert — too early | P1.8.7 |
| 9.5 | 🛑 Alert fails to send (Resend error) | Negative | Retry 3x; alert Super Admin if persistent | P1.8.7 |

#### Stage 10: Company-Wide Announcement (ENG-3)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 10.1 | ✅ Valid announcement, sent | Positive | All active employees get in-app + email; logged to audit | P2.1.4 |
| 10.2 | ⚠️ Body contains employee names | Negative | Warn: "Don't include personal info — broadcasts are not anonymous" | P2.1.4 |
| 10.3 | ⚠️ Announcement too long (> 2000 chars) | Negative | Counter visible; over-limit blocks submit | P2.1.4 |
| 10.4 | ⚠️ Sent to > 500 employees simultaneously | Negative | Confirm: "This will send to N employees. Proceed?" | P2.1.4 |
| 10.5 | ⚠️ Announcement contains disallowed content (URL to harmful site, etc.) | Negative | Basic link safety check; flag suspicious domains | P2.1.4 |
| 10.6 | 🛑 Announcement contains another employee's PII | Hard stop | Block + warn (privacy) | P2.1.4 |

#### Stage 11: Anonymized Risk Visibility (RISK-3)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 11.1 | ✅ Aggregate count > 0, group size >= 5 | Positive | Show count + trend | P1.6.2 |
| 11.2 | ⚠️ Group size < 5 (privacy floor) | Negative | "Insufficient data to show risk metrics" (no count shown) | WFA-2 min group rule |
| 11.3 | ⚠️ Admin tries to drill down to individual | Negative | "Tenang does not share individual risk data with HR" (per RISK-3 boundary) | Privacy guard |
| 11.4 | 🛑 Admin attempts API call for individual risk | Hard stop | Server rejects, logs security event, alerts Super Admin | TEN-7 pattern + audit log |

#### Stage 12: Billing View

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 12.1 | ✅ Quota used normally | Positive | Progress bar at expected level; badge: "OK" | P1.7.3 |
| 12.2 | ⚠️ Quota 80% used | Positive | Badge: "Warning" (yellow); in-app notification | P1.7.3 |
| 12.3 | ⚠️ Quota 95% used | Negative | Badge: "Critical" (red); email to admin | P1.7.3 |
| 12.4 | ⚠️ Quota 100% used | Negative | New sessions blocked; admin sees "Contact Sales" CTA | P1.7.4 |
| 12.5 | ⚠️ Tier mismatch (using more than tier allows) | Negative | Auto-upgrade to next tier + invoice (BILL-7) | P2.6.1 |
| 12.6 | ⚠️ Failed payment (Phase 2) | Negative | Email + grace period (BILL-5) | P2.6.1 |
| 12.7 | 🛑 Service suspended (BILL-6) | Negative | Company Admin sees suspension notice + restore instructions | P1.7.2 |

#### Stage 13: Activity Log (ADM-12)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 13.1 | ✅ Normal log query | Positive | Paginated list with filters | P1.6.4 |
| 13.2 | ⚠️ Log has > 10,000 entries | Negative | Cursor pagination; export option | P1.6.4 |
| 13.3 | ⚠️ Admin tries to see Super Admin actions in same tenant | Negative | "Restricted — contact Super Admin" (per TEN-4 support-access boundary) | Audit log RLS |
| 13.4 | 📊 Activity log query frequency | Telemetry | Detect suspicious admin behavior patterns | P1.6.4 |

#### Stage 14: Renewal Report

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 14.1 | ✅ Export requested | Positive | PDF + CSV generated; download starts | P2.5.3 |
| 14.2 | ⚠️ No data (new tenant) | Negative | PDF shows tenant info but "No usage data yet" | P2.5.3 |
| 14.3 | ⚠️ Report contains individual employee PII | Negative | Block: "Report contains PII — anonymize before export" | Privacy guard |
| 14.4 | 🛑 Report export to external unauthorized email | Hard stop | Block + audit log | P2.5.3 |

#### Stage 15: 90-Day Renewal Reminder (SUP-15)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 15.1 | ✅ Contract end 90 days out | Positive | Email to Company Admin + Sales contact with usage summary | P1.8.8 |
| 15.2 | ⚠️ Renewal already in progress (Sales confirmed) | Negative | Suppress; manual flag in Super Admin | P1.8.8 |
| 15.3 | ⚠️ Contract end < 30 days, no renewal started | Negative | Escalate to Super Admin: "Critical: renewal in X days" | P1.8.8 |
| 15.4 | 🛑 Contract end passed, no renewal | Hard stop | Auto-suspend per BILL-6 + notify Super Admin | P1.8.8 |

#### Stage 16: Transfer Admin Role (ADM-9)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 16.1 | ✅ New admin accepts via email | Positive | Role transferred; old admin demoted | P1.6.3 |
| 16.2 | ⚠️ New admin ignores email for 7 days | Negative | Reminder; admin can revoke + reassign | P1.6.3 |
| 16.3 | ⚠️ New admin email not in any invitation | Negative | "First, invite {email} as admin, then transfer" | P1.6.3 |
| 16.4 | ⚠️ Old admin tries to access admin features after transfer | Negative | Session revoked; next login redirects to /c/ as employee | P1.6.3 |
| 16.5 | 🛑 Company has only 1 active admin + transfer in progress | Hard stop | Don't allow self-removal until transfer accepted (no admin gap) | P1.6.3 |

#### Stage 17: Leave Company → Handover

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 17.1 | ✅ New admin already in place | Positive | Old admin deactivated cleanly | P1.6.3 |
| 17.2 | ⚠️ No other admin exists | Negative | Block: "Add another admin first, then transfer" (per ADM-8) | P1.6.3 |
| 17.3 | ⚠️ Old admin tries self-deactivation | Negative | Same as above | P1.6.3 |
| 17.4 | 🛑 Old admin is the super admin's only contact | Hard stop | Block + alert Super Admin | P1.2.x |

#### Stage 18: Support Ticket (ADM-10)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 18.1 | ✅ Ticket created | Positive | Tenang support receives; reply within 24h | P1.6.5 |
| 18.2 | ⚠️ Ticket body contains employee name or PII | Negative | Warn: "Tickets are linked to company only — don't include employee PII" | P1.6.5 |
| 18.3 | ⚠️ Ticket contains chat content (even paraphrased) | Negative | Block: "Tickets cannot reference chat content — describe the technical issue" | P1.6.5 |

#### Stage 19: Account Suspended (Payment Overdue)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 19.1 | ✅ Grace period active | Positive | Employees see banner: "Service temporarily limited — contact billing" | P2.6.1 |
| 19.2 | ⚠️ Grace period expired, suspension | Negative | New sessions blocked; data preserved; admin sees suspension + pay-now CTA | P1.7.2 |
| 19.3 | ⚠️ Payment received during suspension | Positive | Auto-restore within 1 hour | P2.6.1 |
| 19.4 | 🛑 Payment never received, contract ends | Hard stop | Offboarded per ONB-7; data enters retention timer | P1.7.2 + TEN-3 |

#### Stage 20: Data Breach Report (SUP-7)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 20.1 | ✅ Report generated | Positive | PDF with: data types, scope, timeline, mitigation; exportable | P1.8.9 |
| 20.2 | ⚠️ Report incomplete (missing timeline) | Negative | Inline validation; submit disabled | P1.8.9 |
| 20.3 | ⚠️ > 72h since breach (UU PDP Art. 46 limit) | Negative | Block: "UU PDP requires reporting within 72h — escalate" | P1.8.9 |
| 20.4 | 🛑 Report contains unredacted PII | Hard stop | Auto-redaction + audit log entry | P1.8.9 |

---

## A.3 — Role: Clinical / Internal Staff (Persona: "Internal Staff")

Mapped to: **Journey C** (PRD §8.3) + updates in §8.9.

### Critical Path Stages

| # | Stage | Touchpoint | PRD Ref | Plan Task |
|---|---|---|---|---|
| 1 | Receive new-flag notification | Email + in-app | §8.3.0, RISK-17 | P1.10.3 |
| 2 | Open risk queue | /risk-queue | §8.3.1, RISK-1 | P1.10.4 |
| 3 | Triage: escalate | Case detail page | §8.3.2a, RISK-2, RISK-18 | P1.10.5 |
| 3b | Triage: dismiss | Case detail page | §8.3.2b, RISK-4 | P1.10.5 |
| 4 | Assign to psychologist | Assign dialog | §8.3.3, RISK-18 | P1.10.5 |
| 5 | Shift handover (if applicable) | Case note | §8.3.3, C-7, RISK-10 | P1.10.2 |
| 6 | Cross-case pattern check | Pattern alert | §8.3.4, RISK-11 | P1.10.9 |
| 7 | Re-escalation after follow-up | Case detail | §8.3.5b, RISK-12, RISK-19 | P1.10.5 |
| 8 | Mark case resolved (senior only) | Resolution dialog | §8.3.6, RISK-20 | P1.10.5 |
| 9 | Outcome tracking (30 days) | Background | §8.3.7, RISK-9 | P2.x (Phase 2) |
| 10 | Deactivation of clinical staff blocked if open cases | (forced) | RISK-14 | P1.10.2 |

### Positive vs Negative Case Matrix

#### Stage 1: Receive New-Flag Notification (RISK-17)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 1.1 | ✅ Standard flag, clinical staff on duty | Positive | Push + email within 60s | P1.10.3 |
| 1.2 | ⚠️ Multiple flags at once (> 5 in 1 min) | Negative | Aggregate notification: "5 new cases — open queue" | P1.10.3 |
| 1.3 | ⚠️ Critical-tier flag after hours | Negative | On-call page triggered; same notification | P1.10.8 |
| 1.4 | ⚠️ Notification delivery fails (email bounce) | Negative | Fall back to in-app; if both fail, page | P1.10.3 |
| 1.5 | 🛑 Staff not assigned to on-call rotation | Hard stop | Auto-rotate or escalate to Super Admin | P1.10.8 |
| 1.6 | 📊 Time-to-acknowledge metric | Telemetry | Track SLA compliance | P1.10.3 |

#### Stage 2: Open Risk Queue

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 2.1 | ✅ Queue has cases, normal load | Positive | Two tabs (Critical, Standard); table with AI summary + time-since-flag | P1.10.4 |
| 2.2 | ⚠️ Queue is empty | Negative | "No active cases — nice work" empty state | P1.10.4 |
| 2.3 | ⚠️ Queue has > 20 cases | Negative | Paginated + filter (tier, company, age) | P1.10.4 |
| 2.4 | ⚠️ Critical case at top of queue | Negative | Visual emphasis (red badge, pulse animation) | P1.10.4 |
| 2.5 | ⚠️ Staff opens same case as colleague | Negative | Optimistic lock (RISK-13); second viewer sees read-only with "claimed by X" | P1.10.2 |
| 2.6 | 🛑 Staff role not assigned to any company | Hard stop | Block queue access; "Contact Super Admin" | TEN-2 RLS |

#### Stage 3: Triage — Escalate

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 3.1 | ✅ Standard flag, escalates | Positive | Assign psychologist dialog; case status → "assigned" | P1.10.5 |
| 3.2 | ⚠️ AI summary insufficient | Negative | "View full transcript" available (anonymized) | P1.10.5 |
| 3.3 | ⚠️ Staff chooses wrong company context (multiple companies) | Negative | "You're viewing {companyA}. Switch to {companyB}?" | Multi-company context |
| 3.4 | ⚠️ No psychologist available for assignment | Negative | Show on-call list with availability; cannot assign offline staff | P1.10.2 |
| 3.5 | 🛑 Staff personally acquainted with employee | Hard stop | "Declare conflict of interest" — per §8.6 #3.6 policy, must recuse | P1.10.2 |

#### Stage 3b: Triage — Dismiss (RISK-4)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 3b.1 | ✅ False positive, dismiss with reason | Positive | Case → "dismissed"; feeds detection tuning | P1.10.2 |
| 3b.2 | ⚠️ Staff tries to dismiss critical-tier flag | Negative | Block: "Critical flags require senior staff review" | RISK-20 |
| 3b.3 | ⚠️ No reason code selected | Negative | "Reason required" — submit disabled | P1.10.5 |
| 3b.4 | ⚠️ Same employee repeatedly dismissed (false positive pattern) | Negative | "This user has 3 dismissals in 30 days — consider senior review" | Pattern detection |
| 3b.5 | 🛑 Dismiss without logging reason | Hard stop | Block; per audit trail requirement | P1.10.5 |

#### Stage 4: Assign to Psychologist (RISK-18)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 4.1 | ✅ Psychologist selected, notified | Positive | Psychologist receives in-app + email with AI summary | P1.10.5 + P1.10.3 |
| 4.2 | ⚠️ No backup assignee set | Negative | Force selection: "Every case needs a backup" (RISK-10) | P1.10.2 |
| 4.3 | ⚠️ Psychologist doesn't acknowledge within 15 min | Negative | Backup auto-notified; original assignee sees escalation notice | P1.10.2 |
| 4.4 | ⚠️ Selected psychologist is on leave | Negative | Show "On leave until {date}"; pick another | P1.10.x staffing |
| 4.5 | 🛑 Selected psychologist has open case quota exceeded | Hard stop | Block; suggest another | Phase 2 quota |

#### Stage 5: Shift Handover (RISK-10, C-7)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 5.1 | ✅ Standard handover with note | Positive | Backup assignee notified; note attached to case | P1.10.2 |
| 5.2 | ⚠️ Staff ends shift without handover | Negative | Auto-prompt: "You have 3 open cases — add handover notes?" | P1.10.2 |
| 5.3 | ⚠️ Handover note is empty | Negative | Warn: "Add context for backup" | P1.10.2 |
| 5.4 | 🛑 No backup assignee on case | Hard stop | Cannot end shift; force backup selection | RISK-10 |

#### Stage 6: Cross-Case Pattern (RISK-11)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 6.1 | ✅ 2+ employees in same company flagged in 7d | Positive | Pattern alert in queue: "3 flags in {company} this week" | P1.10.9 |
| 6.2 | ⚠️ Same employee flagged 3+ times in 30d | Positive | Chronic-risk indicator on case | P1.10.9 |
| 6.3 | ⚠️ Pattern detected but company too small (< 5 employees) | Negative | Pattern not surfaced (privacy floor); logged only | P1.10.9 |
| 6.4 | 📊 Pattern detection accuracy | Telemetry | Track true/false positives over time | P1.10.9 |

#### Stage 7: Re-Escalation (RISK-12, RISK-19)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 7.1 | ✅ Standard re-escalation | Positive | Status → "re_escalated"; senior review | P1.10.5 |
| 7.2 | ⚠️ Emergency services needed (RISK-12) | Negative | Checklist appears: confirm location, log 119 call, document outcome | P1.10.5 |
| 7.3 | ⚠️ Employee unreachable after 3 attempts (RISK-19) | Negative | Protocol fires: case → senior clinical staff; outcome documented | P1.10.2 |
| 7.4 | ⚠️ Re-escalation reason unclear | Negative | Force structured reason + free-text | P1.10.5 |
| 7.5 | 🛑 Emergency escalation without checklist completion | Hard stop | Block; per audit trail | P1.10.5 |

#### Stage 8: Mark Resolved (RISK-20)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 8.1 | ✅ Senior staff resolves case | Positive | Case → "resolved"; employee gets in-app message (RISK-16) | P1.10.5, P1.10.7 |
| 8.2 | ⚠️ Non-senior tries to resolve | Negative | Resolve button disabled; "Requires senior clinical staff role" | P1.10.5 |
| 8.3 | ⚠️ No resolution reason | Negative | Force category + free text | P1.10.5 |
| 8.4 | ⚠️ Case reopened (new info) | Negative | "Reopen" action — re-enters active queue | P1.10.5 |
| 8.5 | 🛑 Resolved without employee follow-up confirmation | Hard stop | Block if "unreachable" outcome; force 3-attempt log | RISK-19 |

#### Stage 9: Outcome Tracking (RISK-9)

[Phase 2 — placeholder for V1; tracked in background once EPIC-14 ships]

#### Stage 10: Deactivation Blocked (RISK-14)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 10.1 | ✅ Clinical staff tries to deactivate, no open cases | Positive | Standard deactivation | P1.10.2 |
| 10.2 | ⚠️ Clinical staff has open cases | Negative | Block; show list: "Reassign these cases first" | P1.10.2 |
| 10.3 | 🛑 Deactivation with critical-tier open case | Hard stop | Block + Super Admin alert | P1.10.2 |

---

## A.4 — Role: Psychologist (Persona: "Internal Staff — Psychologist")

Mapped to: **Journey E** (PRD §8.5). The psychologist was previously a black box — this journey defines their workflow.

### Critical Path Stages

| # | Stage | Touchpoint | PRD Ref | Plan Task |
|---|---|---|---|---|
| 1 | Receive assignment notification | Email + in-app | §8.5.1, RISK-18 | P1.10.5 |
| 2 | Open case record | /risk-queue/assigned/[id] | §8.5.2 | P1.10.6 |
| 3 | First contact attempt | Phone (out-of-band) | §8.5.3 | P1.10.6 |
| 4 | Log contact attempt outcome | Follow-up log | §8.5.3 | P1.10.6 |
| 5 | Conduct follow-up conversation | Phone | §8.5.4 | P1.10.6 |
| 6 | Re-escalate if needed | Case detail | §8.5.4b, RISK-12 | P1.10.6 |
| 7 | Handle employee unreachable (3 attempts / 48h) | Case detail | §8.5.3b, RISK-19 | P1.10.6 |
| 8 | Assign skill/content | Case detail | §8.5.5, SKL-6 | P2.9.4 |
| 9 | Log outcome | Case detail | §8.5.6 | P1.10.6 |
| 10 | Route to senior for resolution | Resolution handoff | §8.5.7, RISK-20 | P1.10.5 |

### Positive vs Negative Case Matrix

#### Stage 1: Receive Assignment Notification (RISK-18)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 1.1 | ✅ Assigned during shift, available | Positive | In-app + email within 60s with AI summary attached | P1.10.5 |
| 1.2 | ⚠️ Assigned while in another case | Negative | Acknowledge but show "Will follow up within SLA X" | P1.10.6 |
| 1.3 | ⚠️ Assigned outside shift hours | Negative | Notification queued for shift start; if critical, on-call page triggers | P1.10.8 |
| 1.4 | ⚠️ No contact method available for employee | Negative | "No phone on file — escalate to senior for guidance" | P1.10.6 |
| 1.5 | 🛑 Assigned to clinical staff not in `psychologist` role | Hard stop | Block; "Only psychologists can be assigned" | TEN-2 RLS |

#### Stage 2: Open Case Record

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 2.1 | ✅ AI summary sufficient | Positive | Quick read; can proceed to contact | P1.10.6 |
| 2.2 | ⚠️ Wants full transcript | Negative | Anonymized full transcript available (read-only) | P1.10.5 |
| 2.3 | ⚠️ Transcript is long (> 100 messages) | Negative | Show with anchor links + search | P1.10.5 |
| 2.4 | ⚠️ Another psychologist has the case locked | Negative | Read-only with "Claimed by Dr. X" | RISK-13 |
| 2.5 | 🛑 Identity exposure risk (full name visible when it shouldn't be) | Hard stop | Hide; show anonymized ID only | RISK-3 |

#### Stage 3-4: First Contact + Log

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 3.1 | ✅ Employee answers, brief check-in | Positive | Log: timestamp, duration, outcome="reached", notes | P1.10.6 |
| 3.2 | ⚠️ No answer, voicemail | Negative | Log: timestamp, outcome="no_answer", retry scheduled | P1.10.6 |
| 3.3 | ⚠️ Wrong number | Negative | Log: outcome="wrong_number", escalate to senior for guidance | P1.10.6 |
| 3.4 | ⚠️ Employee refuses contact | Negative | Log: outcome="refused", no further attempts (per policy) | P1.10.6 |
| 3.5 | ⚠️ Employee is hostile/threatening | Negative | Log + immediate escalate to senior + safety check | RISK-12 |
| 3.6 | 🛑 Contact made but not logged | Hard stop | Lock case; require log before any other action | P1.10.6 |

#### Stage 5: Follow-up Conversation

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 5.1 | ✅ Conversation goes well, employee stable | Positive | Log outcome, recommend skill/content if relevant, mark ready for resolution | P1.10.6 |
| 5.2 | ⚠️ Employee shares new context that changes risk tier | Negative | Update tier; re-escalate to senior | RISK-12 |
| 5.3 | ⚠️ Employee mentions suicidal ideation in detail | Negative | Activate emergency services protocol (119 checklist) | RISK-12 |
| 5.4 | ⚠️ Conversation reveals employer illegal activity | Negative | Per §8.6 #3.8 policy: don't share with employer; advise employee to contact authorities; document | P1.10.6 + policy |
| 5.5 | 🛑 Psychologist tries to provide therapy (out of scope) | Hard stop | Per §8.5 #5.4: Tenang clinical does triage + first response only, not ongoing therapy; redirect to external referral | P1.10.6 + policy |

#### Stage 6: Re-Escalate (RISK-12)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 6.1 | ✅ Standard re-escalation to senior | Positive | Case → "re_escalated", senior notified | P1.10.5 |
| 6.2 | ⚠️ Emergency: imminent harm | Negative | RISK-12 checklist; call 119; document | P1.10.5 |
| 6.3 | ⚠️ Subpoena for records received | Negative | Per §8.6 #3.9: legal hold (TEN-6); Tenang Legal responds | TEN-6 + policy |
| 6.4 | 🛑 Re-escalation without documentation | Hard stop | Block | P1.10.5 |

#### Stage 7: Employee Unreachable (RISK-19)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 7.1 | ✅ 3 attempts in 48h, all fail | Positive | Auto-escalate to senior; outcome="unreachable_escalated" | P1.10.2 |
| 7.2 | ⚠️ 1st attempt fails, retry scheduled | Positive | Standard retry logic | P1.10.6 |
| 7.3 | ⚠️ Employee picks up after 3rd attempt | Positive | Conduct follow-up; do not auto-escalate | P1.10.6 |
| 7.4 | ⚠️ Phone disconnected | Negative | "Phone disconnected — escalate to senior" | P1.10.6 |
| 7.5 | 🛑 Case stays open > 7 days without resolution | Hard stop | Auto-escalate + Super Admin alert | P1.10.2 |

#### Stage 8: Assign Skill/Content (SKL-6)

[Phase 2 — placeholder for V1; tracked when EPIC-19 ships]

#### Stage 9: Log Outcome

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 9.1 | ✅ Outcome logged with category + notes | Positive | Status → "ready_for_resolution" | P1.10.6 |
| 9.2 | ⚠️ Notes contain PII that shouldn't be in summary | Negative | Warn: "Notes visible to senior reviewer only — confirm" | P1.10.6 |
| 9.3 | ⚠️ Missing outcome category | Negative | Submit disabled | P1.10.6 |
| 9.4 | 🛑 Outcome not logged before navigation away | Hard stop | Alert; do not lose work | P1.10.6 |

#### Stage 10: Route to Senior for Resolution

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 10.1 | ✅ Routed to senior clinical staff | Positive | Status → "in_resolution_review" | P1.10.5 |
| 10.2 | ⚠️ Psychologist tries to self-resolve | Negative | Block; "Resolution requires senior clinical staff" (RISK-20) | P1.10.5 |
| 10.3 | ⚠️ Senior rejects resolution (insufficient outcome) | Negative | Back to psychologist; re-do follow-up | P1.10.5 |
| 10.4 | 🛑 Case closed without senior sign-off | Hard stop | Per RISK-20; audit log entry | P1.10.5 |

---

## A.5 — Role: Platform Super Admin (Persona: "Tenang Ops")

Mapped to: **Journey D** (PRD §8.4) + updates in §8.9.

### Critical Path Stages

| # | Stage | Touchpoint | PRD Ref | Plan Task |
|---|---|---|---|---|
| 1 | Sales handoff form received | Email | §8.4.0, SUP-12 | P1.2.5 |
| 2 | Provision new tenant | /super-admin/tenants/new | §8.4.1, ONB-1, SUP-1 | P1.2.3 |
| 3 | Invite first Company Admin | /super-admin/tenants/[id] | §8.4.2, ONB-2 | P1.2.3 |
| 4 | Start 48h activation watch | Cron | §8.4.2, SUP-13 | P1.8.x |
| 5 | Verify go-live | Go-live checklist | §8.4.3, SUP-13 | P1.8.x |
| 6 | Monitor cross-tenant health | /super-admin | §8.4.4, SUP-2 | P1.2.4 |
| 7 | Receive client health alert | Email | §8.4.5, SUP-14 | P1.8.7 |
| 8 | Receive 90-day renewal reminder | Email | §8.4.6, SUP-15 | P1.8.8 |
| 9 | Publish platform status | /super-admin/status | SUP-11 | P1.8.6 |
| 10 | Suspend overdue company | /super-admin/tenants/[id] | BILL-6 | P1.7.2 |
| 11 | Soft-delete tenant (two-person) | /super-admin/tenants/[id]/delete | SUP-10 | P1.8.5 |
| 12 | Toggle feature flag per tenant | /super-admin/tenants/[id]/features | SUP-6 | P1.8.1 |
| 13 | Generate breach report | /super-admin/incidents/new | SUP-7 | P1.8.9 |
| 14 | Emergency-suspend compromised super admin | /super-admin/team | SUP-8 | P1.8.4 |
| 15 | Audit log review | /super-admin/audit-log | SUP-4 | P1.2.6 |

### Positive vs Negative Case Matrix

#### Stage 1-2: Handoff → Provision

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 1.1 | ✅ Complete handoff form | Positive | SLA: provision within 1 business day (SUP-13) | P1.2.5 |
| 1.2 | ⚠️ Missing handoff artefacts | Negative | Cannot start provisioning (SUP-12) | P1.2.5 |
| 2.1 | ✅ Tenant created with valid config | Positive | company_id, quota, billing_tier, contract dates all set | P1.2.3 |
| 2.2 | ⚠️ Duplicate company name | Negative | ONB-4: error with clear message | P1.2.3 |
| 2.3 | ⚠️ SLA breached (no provisioning in 1 BD) | Negative | Internal alert to ops team | P1.8.x |
| 2.4 | 🛑 Super Admin MFA not enabled | Hard stop | Block provisioning action (SUP-8) | P1.8.3 |

#### Stage 3: Invite Company Admin

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 3.1 | ✅ Valid email, invitation sent | Positive | Email + 48h activation watch starts | P1.2.3 |
| 3.2 | ⚠️ Email already exists in another company | Negative | Block: "This email is already a member" | P1.2.3 |
| 3.3 | ⚠️ Admin doesn't accept within 48h | Negative | Alert: "Admin invitation unaccepted for {company}" | P1.8.x |

#### Stage 4-5: Activation Watch + Go-Live

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 4.1 | ✅ Admin accepts within 48h | Positive | Activation watch cleared | P1.8.x |
| 4.2 | ⚠️ Admin accepts but doesn't configure branding / invite employees in 7d | Negative | Alert: "Company {name} at risk of going live dead" | P1.8.x |
| 5.1 | ✅ All go-live checklist items complete | Positive | Mark tenant as "live" in dashboard | P1.8.x |
| 5.2 | ⚠️ No employees registered after 30d | Negative | SUP-14 health alert | P1.8.7 |
| 5.3 | 🛑 Tenant marked live but no actual usage | Negative | Not "hard stop" but tracked in churn risk | SUP-14 |

#### Stage 6: Monitor Cross-Tenant Health

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 6.1 | ✅ All tenants healthy | Positive | Dashboard shows aggregate metrics | P1.2.4 |
| 6.2 | ⚠️ 1 tenant down (chat API errors) | Negative | Alert + drill-down to that tenant | P1.2.4 |
| 6.3 | ⚠️ Aggregate MAU drops platform-wide | Negative | Investigation needed | P1.2.4 |
| 6.4 | ⚠️ Super Admin tries to view individual employee data | Negative | Block (SUP-2 boundary); "Aggregate only" | P1.2.4 |
| 6.5 | 🛑 Super Admin accesses employee transcript | Hard stop | Alert + audit + possible termination | TEN-4 + privacy boundary |

#### Stage 7: Client Health Alert (SUP-14)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 7.1 | ✅ < 10% MAU for 30d | Positive | Email to Super Admin + Sales | P1.8.7 |
| 7.2 | ⚠️ New tenant (< 30d) | Negative | Suppress (too early) | P1.8.7 |
| 7.3 | ⚠️ Tenant just reactivated | Negative | Suppress for 30d post-reactivation | P1.8.7 |
| 7.4 | ⚠️ Sales marks "engaged" (working with client) | Negative | Suppress; manual override | P1.8.7 |

#### Stage 8: Renewal Reminder (SUP-15)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 8.1 | ✅ Contract end 90d out | Positive | Email to Sales + Super Admin with usage summary | P1.8.8 |
| 8.2 | ⚠️ Already renewed | Negative | Suppress | P1.8.8 |
| 8.3 | ⚠️ Contract end < 30d, no renewal | Negative | Critical alert: "URGENT: {company} contract ends in X days" | P1.8.8 |
| 8.4 | 🛑 Contract end passed | Hard stop | Auto-suspend per BILL-6 | P1.8.8 |

#### Stage 9: Publish Platform Status (SUP-11)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 9.1 | ✅ Valid status, published | Positive | In-app banner + email to all Company Admins | P1.8.6 |
| 9.2 | ⚠️ Status contains sensitive details | Negative | Warn: "This is visible to all clients — keep generic" | P1.8.6 |
| 9.3 | ⚠️ No expected resolution time | Negative | Force field; cannot leave blank | P1.8.6 |
| 9.4 | 🛑 Status impersonating customer support | Hard stop | Block; copy moderation | P1.8.6 |

#### Stage 10: Suspend Overdue Company (BILL-6)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 10.1 | ✅ Overdue, grace period expired | Positive | New sessions blocked; data preserved; admin notified | P1.7.2 |
| 10.2 | ⚠️ Customer disputes | Negative | Un-suspend; escalate to Finance | P1.7.2 |
| 10.3 | ⚠️ Suspended company has open escalation cases | Negative | "Resolve open cases before suspension" (clinical safety) | P1.7.2 + RISK-14 |
| 10.4 | 🛑 Suspending without audit log | Hard stop | Block; all privileged actions logged | P1.7.2 |

#### Stage 11: Soft-Delete Tenant (SUP-10)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 11.1 | ✅ Two super admins confirm | Positive | Soft-delete state; 48h window before hard delete | P1.8.5 |
| 11.2 | ⚠️ Reversed within 48h | Positive | Full restore | P1.8.5 |
| 11.3 | ⚠️ Only 1 super admin in the system | Negative | Block: "Need at least 2 super admins to perform two-person action" | P1.8.5 |
| 11.4 | ⚠️ Tenant has open legal hold (TEN-6) | Negative | Block: "Cannot delete while legal hold is active" | P1.8.5 + TEN-6 |
| 11.5 | 🛑 Hard delete without 48h window | Hard stop | Cron enforces; manual hard delete requires two-person + reason | P1.8.5 |

#### Stage 12: Toggle Feature Flag (SUP-6)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 12.1 | ✅ Standard flag toggle | Positive | Effective immediately; logged to audit | P1.8.1 |
| 12.2 | ⚠️ Flag affects critical safety (e.g., disable risk detection) | Negative | Two-person confirmation | P1.8.1 |
| 12.3 | ⚠️ Flag enabled but no infra behind it | Negative | Audit warning | P1.8.1 |
| 12.4 | 🛑 Flag toggle without authorization | Hard stop | Per audit trail | P1.8.1 |

#### Stage 13: Breach Report (SUP-7)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 13.1 | ✅ Complete report, generated | Positive | PDF exportable | P1.8.9 |
| 13.2 | ⚠️ < 72h since breach | Positive | Generate (within UU PDP Art. 46 window) | P1.8.9 |
| 13.3 | ⚠️ > 72h since breach | Negative | Block: "UU PDP requires notification within 72h — escalate" | P1.8.9 |
| 13.4 | ⚠️ Affected data types not specified | Negative | Force selection | P1.8.9 |
| 13.5 | 🛑 Report includes unredacted PII | Hard stop | Auto-redact | P1.8.9 |

#### Stage 14: Emergency-Suspend Super Admin (SUP-8)

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 14.1 | ✅ Account compromise confirmed | Positive | All sessions revoked; other super admins alerted | P1.8.4 |
| 14.2 | ⚠️ Suspended themselves by mistake | Negative | Another super admin can reinstate | P1.8.4 |
| 14.3 | ⚠️ Only 1 super admin in system | Negative | Block: "Cannot suspend last super admin — add another first" | P1.8.4 |
| 14.4 | 🛑 Suspended admin tries to log in | Hard stop | All auth rejected + audit log | P1.8.4 |

#### Stage 15: Audit Log Review

| # | Case | Type | Expected Behavior | Plan Task |
|---|---|---|---|---|
| 15.1 | ✅ Standard log query | Positive | Paginated + filterable | P1.2.6 |
| 15.2 | ⚠️ Suspicious pattern detected (e.g., admin accessing many tenants quickly) | Positive | Highlight; flag for review | P1.2.6 |
| 15.3 | ⚠️ Export requested | Negative | Allowed; logged separately | P1.2.6 |
| 15.4 | 🛑 Tampering with audit log | Hard stop | Append-only constraint; any UPDATE/DELETE blocked by DB | P1.1.5 |

---

## A.6 — Cross-Role Critical Paths (Edge Cases from PRD §8.6)

These span multiple roles and must be tested end-to-end.

| # | Scenario | Roles involved | Plan Task |
|---|---|---|---|
| X-1 | Employee in acute crisis at 3am, no on-call | Employee + Clinical Staff | P1.10.8 |
| X-2 | Case closed by clinical team but employee doesn't know | Clinical Staff + Employee | P1.10.7 |
| X-3 | Company Admin is also an employee (EMP-15) | Company Admin + Employee | P1.5.6 |
| X-4 | Employee refers external provider (out of scope) | Clinical Staff → external | Policy only |
| X-5 | Employee complains to Company Admin about chat | Employee → Company Admin | ADM-10 |
| X-6 | Super Admin needs to view tenant config (TEN-4) | Super Admin + tenant | P1.2.x |
| X-7 | Employee triggers false-positive flags repeatedly | Clinical Staff | RISK-4 |
| X-8 | Company Admin welfare check (5.8 — explicitly prohibited) | Company Admin → Employee | Policy block |
| X-9 | Employee uses chat for threats (5.9) | Employee → Clinical Staff → legal | Policy + P1.10.x |
| X-10 | Employee leaves company mid-claim | Employee + Company Admin | EMP-8 + TEN-3 |
| X-11 | Two employees share device (1.6) | Employees | EMP-12 |
| X-12 | Employee changes email domain mid-tenure (1.1) | Employee | EMP-10 |
| X-13 | Company A acquires Company B (2.5) | Company Admins + Super Admin | Out of scope V1/V2 |
| X-14 | Two super admins conflict on tenant config (4.2) | Super Admin | SUP-9 |
| X-15 | Pricing changes mid-contract (4.7) | Company Admin + Super Admin | BILL-9 |
| X-16 | Law enforcement requests data (4.6) | All | Policy only — Tenang Legal |
| X-17 | Data export for client migration (4.3) | Super Admin + Tenant | Phase 2 |

---

## A.7 — Test Suite Requirements Per Journey

Every journey must have a passing test suite before that epic is "shipped."

### Journey A (Employee) Test Suite
- [ ] **Happy path:** invitation → sign-up → profile → orientation → first chat → post-session summary
- [ ] **Re-engagement:** return after 30+ days → re-engagement greeting
- [ ] **Crisis moment:** risk flag → crisis card → session continues
- [ ] **Quota exhausted:** quota=0 → quota screen shown
- [ ] **Pause account:** pause → notifications stop → unpause → resume
- [ ] **B2C/B2B conflict:** existing B2C user receives B2B invite → conflict screen
- [ ] **Email change:** change email → OTP verify → security notification to old
- [ ] **Bulk deactivation:** > 20% → Super Admin confirmation required
- [ ] **Deactivation:** single employee → immediate session revocation

### Journey B (Company Admin) Test Suite
- [ ] **Happy path:** login → wizard → branding → bulk invite → monitor
- [ ] **Low adoption alert:** drop < 10% MAU for 14d → email alert
- [ ] **Bulk invite with errors:** CSV with bad rows → preview flags → fix → confirm
- [ ] **Admin role transfer:** old admin → new admin → role moved
- [ ] **Admin leaves company (only admin):** block + force add new admin
- [ ] **Support ticket:** create ticket → Tenang support responds
- [ ] **Anonymized risk view:** aggregate count shown; individual blocked
- [ ] **Activity log:** all admin actions logged + visible
- [ ] **Renewal reminder:** 90d out → email with summary
- [ ] **Account suspended (overdue):** new sessions blocked; data preserved

### Journey C (Clinical Staff) Test Suite
- [ ] **Happy path:** notification → triage → assign → follow-up → resolve
- [ ] **Dismiss false positive:** dismiss with reason → logged
- [ ] **Backup assignee:** primary doesn't ack within 15min → backup notified
- [ ] **Shift handover:** open cases at end of shift → handover notes required
- [ ] **Pattern detection:** 2+ in 7d same company → pattern alert
- [ ] **Re-escalation:** post-follow-up, situation worse → RISK-12
- [ ] **Resolution by non-senior:** block
- [ ] **Resolution by senior:** case closed + employee notified
- [ ] **Deactivation blocked:** staff has open cases → deactivation blocked

### Journey D (Super Admin) Test Suite
- [ ] **Happy path:** handoff form → provision → invite admin → go-live verified
- [ ] **Duplicate company:** name conflict → ONB-4 error
- [ ] **SLA breach:** > 1 BD provisioning → internal alert
- [ ] **Activation watch:** admin doesn't accept in 48h → alert
- [ ] **Go-live verification:** all checklist items → mark live
- [ ] **Client health alert:** < 10% MAU 30d → email
- [ ] **Renewal reminder:** 90d out → email
- [ ] **Platform status:** publish → banner on all tenant pages
- [ ] **Soft-delete:** two-person confirm → 48h window → restore → confirm hard delete
- [ ] **MFA enforcement:** super admin without 2FA → blocked from admin actions

### Journey E (Psychologist) Test Suite
- [ ] **Happy path:** assigned → review summary → contact → log → outcome → senior resolves
- [ ] **Employee unreachable:** 3 attempts / 48h → auto-escalate
- [ ] **Re-escalation to emergency:** RISK-12 checklist
- [ ] **Conflict of interest:** declare + recuse
- [ ] **Wrong number:** log + escalate
- [ ] **Employee refuses contact:** log + no further attempts
- [ ] **Assignment outside shift:** notification queued
- [ ] **Skill assignment (Phase 2):** SKL-6 pins skill in employee library

---

## A.8 — Implementation Priority Refinement

The original plan's Phase 1 sequence (P1.1 → P1.12) is still correct. This appendix adds the **per-journey test gates** that must pass before the corresponding epic is considered complete.

| Epic | Journey | Test Gate |
|---|---|---|
| EPIC-01, 02, 10 | Journey A stages 1-7 | P1.5.10 + A.7 Journey A happy path |
| EPIC-01, 02 | Journey A stages 8-17 | P1.5.10 + A.7 Journey A edge cases |
| EPIC-05, 10 | Journey B stages 1-7 | P1.6.6 + A.7 Journey B happy path |
| EPIC-05, 09 | Journey B stages 8-15 | P1.6.6 + A.7 Journey B edge cases |
| EPIC-09, 07 | Journey D stages 1-6 | P1.8.10 + A.7 Journey D |
| EPIC-04 | Journey C, E | P1.10.10 + A.7 Journeys C + E |
| EPIC-06, 07 | Billing & quota | P1.7.6 + A.7 quota-related cases |
| EPIC-03 | Chat experience | P1.9.9 + A.7 chat-related cases |

**Done definition for the entire Phase 1:** Every test in A.7 passes (36 test scenarios across 5 journeys).

---

# APPENDIX F — Drill-Down Plans Per Journey (TDD-Level Tasks)

The main plan above describes Phase 0 / Phase 1 / Phase 2 / Phase 3 at the epic level. For TDD-level bite-sized tasks per user journey, see the following companion documents:

| File | Coverage | Critical Path Tasks |
|---|---|---|
| [`2026-06-24-journey-a-employee.md`](./2026-06-24-journey-a-employee.md) | **Journey A** — Employee: Invitation to Ongoing Use | B.1 (Invitations domain), B.2 (SignUp gate), B.3 (Profile + Orientation), B.4 (First chat + Crisis card), B.5 (Post-session + Quota), B.6 (Lifecycle: pause, email change, deactivation), B.7 (E2E) |
| [`2026-06-24-journey-b-company-admin.md`](./2026-06-24-journey-b-company-admin.md) | **Journey B** — Company Admin: Contract to Renewal | C.1 (Companies domain), C.2 (Admin console UI), C.3 (E2E) |
| [`2026-06-24-journey-c-e-clinical.md`](./2026-06-24-journey-c-e-clinical.md) | **Journey C + E** — Clinical Staff + Psychologist: Flag to Resolution | D.1 (Risk flags), D.2 (Risk queue + case detail), D.3 (Case-closed notification), D.4 (E2E) |
| [`2026-06-24-journey-d-super-admin.md`](./2026-06-24-journey-d-super-admin.md) | **Journey D** — Super Admin: New Client to Steady State | E.1 (Provisioning), E.2 (MFA), E.3 (Two-person delete), E.4 (Feature flags), E.5 (Status banner), E.6 (Crons), E.7 (Breach report), E.8 (E2E) |
| [`2026-06-24-observability-logger.md`](./2026-06-24-observability-logger.md) | **Cross-cutting** — Logger + tracing for every BE request, Effect program, sensitive action | F.1 (Log levels), F.2 (Logger service), F.3 (Request middleware), F.4 (Trace continuity), F.5 (Audit helpers), F.6 (API route logging), F.7 (Logs dashboard), F.8 (Acceptance) |

Each drill-down file contains:
- **TDD-level bite-sized tasks** (2-5 min each)
- **Exact file paths** for every file to create/modify
- **Spec code** for types, schemas, errors, repositories, programs, components
- **Test code** for unit and E2E tests
- **Acceptance criteria** per task
- **Commit messages** per task
- **PRD reference** per task
- **Cross-references** to negative cases from Appendix A

**Total TDD tasks across all journeys:** ~150 bite-sized steps
**Total PRD requirements covered:** Every EMP, CHAT, RISK, ADM, BILL, SUP, ONB, TEN, BRAND, CONT, ENG, INT, MOOD, GOAL, WFA, FREE, BKM, SKL story in PRD §11
**Total E2E test scenarios:** 36 across 5 journeys (per A.7)
**Total unit tests:** ~120 across all domains

---

# Cross-Plan Acceptance Gate

**For Phase 1 launch (target Q3 2026), ALL of the following must pass:**

1. **All TDD tasks committed** — every task in journey-a, journey-b, journey-c-e, journey-d plans
2. **All unit tests pass** — `pnpm test` shows green across all domains
3. **All E2E tests pass** — `pnpm playwright test` shows 36/36 across 5 journeys
4. **All migrations apply cleanly** — `supabase db reset && supabase migration up` runs without error
5. **All RLS policies verified** — cross-tenant test suite passes
6. **Manual smoke tests** — every journey walk-through completed
7. **Legal/policy approval** — Phase 0 deliverables signed off
8. **Pilot client onboarded** — 1 design-partner client live for 2-4 weeks

**Sign-off required from:**
- Legal (UU PDP compliance, ToS, MSA)
- Clinical Lead (escalation policy, AI greeting, hotline)
- Engineering Lead (architecture, security, performance)
- Product (UX, feature completeness)
- Security (RLS, MFA, audit log integrity)

**Estimated effort:** 8-12 weeks (per the original gap analysis summary in A.5.8).


