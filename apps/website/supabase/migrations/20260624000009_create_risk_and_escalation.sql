-- Migration to create B2B Risk & Clinical Safety Escalation (Phase 2, EPIC-04)

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
