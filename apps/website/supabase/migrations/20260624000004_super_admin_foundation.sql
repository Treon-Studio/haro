-- Migration for Super Admin & Sales Handoff (Phase 1, P1.2 / EPIC-09)

-- 1. Support 'super_admin' role in company_memberships
-- Drop old check constraint
alter table public.company_memberships drop constraint if exists company_memberships_role_check;

-- Add new check constraint with 'super_admin'
alter table public.company_memberships 
  add constraint company_memberships_role_check 
  check (role in ('owner', 'admin', 'member', 'super_admin'));


-- 2. Create Sales Handoff Artefacts Table
create table if not exists public.handoff_artefacts (
  id uuid default gen_random_uuid() primary key,
  company_name text not null,
  company_size integer not null default 0,
  billing_model text not null default 'flat_rate' check (billing_model in ('flat_rate', 'per_seat', 'usage_based')),
  company_admin_email text not null,
  contract_terms text,
  go_live_date date,
  sales_contact text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for handoff_artefacts
alter table public.handoff_artefacts enable row level security;

-- Index for admin lookup
create index idx_handoff_artefacts_admin_email on public.handoff_artefacts(company_admin_email);

-- RLS policies: only super admins can view and manage handoff documents
create policy "Super admins can manage handoff artefacts" on public.handoff_artefacts
  for all using (
    exists (
      select 1 from public.company_memberships
      where user_id = auth.uid()
        and role = 'super_admin'
        and status = 'active'
    )
  );

-- Triggers for updated_at
create trigger handle_handoff_artefacts_updated_at
  before update on public.handoff_artefacts
  for each row
  execute procedure public.handle_updated_at();
