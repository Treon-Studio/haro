-- Migration for B2B Multi-tenancy (Phase 1, P1.1.1)

-- 1. Create Companies Table
create table if not exists public.companies (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for companies
alter table public.companies enable row level security;

-- 2. Create Company Memberships Table
create table if not exists public.company_memberships (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  status text not null default 'active' check (status in ('active', 'invited', 'suspended')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- One membership per user per company
  unique (company_id, user_id)
);

-- Enable RLS for company_memberships
alter table public.company_memberships enable row level security;

-- Create indexes for performance
create index idx_company_memberships_company_id on public.company_memberships(company_id);
create index idx_company_memberships_user_id on public.company_memberships(user_id);
create index idx_company_memberships_role_status on public.company_memberships(role, status);

-- 3. Row Level Security Policies

-- Companies Policies
create policy "Users can view companies they are members of" on public.companies
  for select using (
    exists (
      select 1 from public.company_memberships
      where company_id = id
        and user_id = auth.uid()
        and status = 'active'
    )
  );

create policy "Owners and admins can update their company" on public.companies
  for update using (
    exists (
      select 1 from public.company_memberships
      where company_id = id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
        and status = 'active'
    )
  );

-- Company Memberships Policies
create policy "Users can view their own memberships or memberships of their companies" on public.company_memberships
  for select using (
    user_id = auth.uid() or
    exists (
      select 1 from public.company_memberships m
      where m.company_id = company_memberships.company_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
        and m.status = 'active'
    )
  );

create policy "Owners and admins can invite or manage memberships" on public.company_memberships
  for all using (
    exists (
      select 1 from public.company_memberships m
      where m.company_id = company_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
        and m.status = 'active'
    )
  );

-- 4. Triggers for updated_at
create trigger handle_companies_updated_at
  before update on public.companies
  for each row
  execute procedure public.handle_updated_at();

create trigger handle_company_memberships_updated_at
  before update on public.company_memberships
  for each row
  execute procedure public.handle_updated_at();
