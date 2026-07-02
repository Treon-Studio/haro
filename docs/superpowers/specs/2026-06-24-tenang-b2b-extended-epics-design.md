# B2B Extended Epics Design Specification
**Date:** June 24, 2026  
**Status:** Approved  
**Version:** v1.0  
**Authors:** opencode (B2B Core Systems Architect)

---

## 1. Executive Summary

This design specification describes the architecture, database schemas, domain layers, API routes, and user interfaces for three critical B2B extension epics of TenangAI:
1.  **EPIC-06 (Subscription & Session Quotas)**: Enforces usage ceilings on chatbot sessions per company, ensuring subscription-tier alignment without violating employee privacy.
2.  **EPIC-04 (Risk & Safety Escalation)**: Operates a real-time clinical triage queue for psychiatrists, automatically generating alerts and escalation cases when suicide/self-harm risk is triggered.
3.  **EPIC-05 (Company Admin Analytics)**: Provides HR managers with usage and activity metrics, enforcing a hard-stop HIPAA threshold check to prevent individual tracking.

These systems are implemented as modular, isolated domains utilizing **Effect-TS** and **Supabase RLS**, ensuring 100% testability, clean boundaries, and bulletproof security.

---

## 2. Database Schema Migrations

We will apply three chronological SQL migrations in the Supabase instance.

### 2.1 Migration 08: `20260624000008_company_billing_quotas.sql`
Enforces quota counters on the root tenant entity and creates a logging audit table.

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

### 2.2 Migration 09: `20260624000009_create_risk_and_escalation.sql`
Sets up crisis flag tracking and actionable clinical workflows.

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
  ai_summary text, -- extracted AI contextual wrap
  trigger_pattern text, -- triggered keywords
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Escalation Cases: actionable work items managed by clinical psychologists
create table if not exists public.escalation_cases (
  id uuid default gen_random_uuid() primary key,
  risk_flag_id uuid not null references public.risk_flags(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  status public.case_status not null default 'open',
  primary_assignee uuid references auth.users(id) on delete set null,
  backup_assignee uuid references auth.users(id) on delete set null,
  followup_attempts jsonb not null default '[]'::jsonb, -- chronologically logs psychologists follow-up attempts
  outcome text check (outcome in ('referred_to_psychologist', 'resolved_offline', 'dismissed_false_positive')),
  outcome_notes text,
  resolved_at timestamp with time zone,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.risk_flags enable row level security;
alter table public.escalation_cases enable row level security;

-- RLS: Restricted exclusively to on-duty clinical staff, platform super-admins, or company owners
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

### 2.3 Migration 10: `20260624000010_create_session_metrics.sql`
Constructs lightweight, index-optimized session aggregates to speed up dashboard queries without loading full conversation logs.

```sql
create table if not exists public.session_metrics (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null, -- references Cloudflare KV conversation ID
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes for lightning fast daily active user lookups
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

---

## 3. Domain Layers (Effect-TS)

Each subsystem is isolated under its own clean domain block.

### 3.1 EPIC-06: Billing & Quotas (`src/domain/billing/`)
*   **Types (`billing.types.ts`)**:
    ```typescript
    export type TBillingInfo = {
      readonly companyId: string
      readonly sessionQuota: number
      readonly sessionsUsed: number
      readonly isQuotaExceeded: boolean
      readonly warningLevel: "none" | "warning" | "critical" | "exceeded"
    }
    ```
*   **Repository (`billing.repository.ts`)**:
    *   `getBillingInfo(companyId)`: reads company row.
    *   `incrementSessionUsage(companyId)`: increments `sessions_used` by 1.
    *   `updateQuota(companyId, newQuota)`: updates quota (restricted to `super_admin`).
*   **Programs (`billing.programs.ts`)**:
    *   `getBillingInfoProgram(companyId)`: maps to DTO. Returns `warningLevel`:
        *   `exceeded` if used >= quota
        *   `critical` if used >= 95% of quota
        *   `warning` if used >= 80% of quota
        *   `none` otherwise
    *   `checkAndIncrementQuotaProgram(companyId)`: checks if used < quota. If true, increments count, records `quota_allocated` event, and returns true. If false, records `quota_exceeded` event and returns false.

### 3.2 EPIC-04: Risk & Safety (`src/domain/safety/`)
*   **Types (`safety.types.ts`)**:
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
*   **Repository (`safety.repository.ts`)**:
    *   `flagRisk(userId, companyId, sessionId, tier, summary, trigger)`: inserts `risk_flag`. If tier is `critical`, inserts `escalation_case` with `status: 'open'`.
    *   `getEscalationCases()`: lists uncompleted cases.
    *   `assignCase(caseId, assigneeId)`: sets status to `'assigned'` and assigns.
    *   `logFollowupAttempt(caseId, notes)`: appends call log into `followup_attempts` JSONB array.
    *   `resolveCase(caseId, outcome, notes)`: sets status to `'resolved'` with outcomes.
*   **Programs (`safety.programs.ts`)**:
    *   `flagRiskProgram(body)`: Decodes and registers. If a critical case is opened, it fires a background email alert via Resend to notify clinical staff on-duty.

### 3.3 EPIC-05: Admin Analytics (`src/domain/analytics/`)
*   **Types (`analytics.types.ts`)**:
    ```typescript
    export type TAnalyticsData = {
      readonly totalMembers: number
      readonly totalSessions: number
      readonly dauHistory: readonly { date: string; active_users: number }[]
      readonly isPrivacyProtected: boolean
    }
    ```
*   **Programs (`analytics.programs.ts`)**:
    *   `getCompanyAnalyticsProgram(companyId)`:
        1.  Fetches active company member count.
        2.  **HIPAA Threshold Guard**: If active members `< 5`, returns `{ isPrivacyProtected: true }` immediately, masking all daily active charts and aggregates.
        3.  If members `≥ 5`, fetches total sessions and 30-day DAU history. Returns `{ isPrivacyProtected: false, ...data }`.

---

## 4. API Routing Interface

### 4.1 Billing Quota Gates
*   `GET /api/companies/[id]/billing` -> Returns `TBillingInfo` (restricted to owners, admins).
*   `POST /api/conversations` (during B2B chat initiation) -> Checks `checkAndIncrementQuotaProgram`. If False, returns `403 Forbidden` with a `"quota_exceeded"` payload.

### 4.2 Risk & Triage Webhooks
*   `POST /api/super-admin/risk/escalate` -> Webhook for the AI Engine to post safety/crisis alerts. Calls `flagRiskProgram`.
*   `GET /api/super-admin/risk/cases` -> Returns the active triage queue.
*   `PATCH /api/super-admin/risk/cases/[id]` -> Assigns or resolves a psychologist case.

### 4.3 Analytics Dashboards
*   `GET /api/companies/[id]/analytics` -> Returns `TAnalyticsData`. Enforces the HIPAA `< 5` blocker.
*   `GET /api/companies/[id]/audit-trail` -> Scopes and returns admin-level activity logs.

---

## 5. Frontend User Experiences (React 19)

### 5.1 Quota-Exhausted Form Lock (`ChatForm.tsx`)
In B2B mode, if `activeConversation`’s company has reached its quota limit:
*   The text input and mic buttons are cleanly disabled and replaced with a non-interactive alert bar:
    > *"Perusahaan Anda telah mencapai batas kuota obrolan bulan ini. Hubungi HR Admin Anda untuk mengupgrade paket."*
*   Conversations remain **read-only** (B2C privacy remains active; user can browse but not write).

### 5.2 Real-time Clinical Board (`/risk-queue`)
*   **Two-Column Board**: Splits critical cases (Red indicators) from standard triage cases.
*   **Live Updates**: Subscribes to Supabase Realtime channel `public.escalation_cases`. Appends incoming critical crises immediately.
*   **Triage Modal**: Enables assigning a case to oneself, writing follow-up summaries, and marking the case resolved.

### 5.3 Anonymity Shield (`/admin/dashboard`)
*   **Active KPI counters**: Employee counts, session totals, and aggregates.
*   **DAU Recharts Graph**: Displays a clean, interactive daily line chart.
*   **Shield Blocker Overlay**: If `isPrivacyProtected` is true, replaces the Recharts panel with a reassuring shield card:
    > *"Proteksi Privasi Aktif: Untuk melindungi kerahasiaan karyawan di organisasi kecil, statistik harian dinonaktifkan hingga organisasi Anda memiliki minimal 5 anggota aktif."*
