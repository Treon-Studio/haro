-- Migration for B2B Billing Quotas (Phase 2, EPIC-06)

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
