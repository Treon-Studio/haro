-- Migration to create B2B Super Admin Automation and Status (Phase 2, EPIC-09)

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
