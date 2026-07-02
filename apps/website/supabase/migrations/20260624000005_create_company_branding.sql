-- Migration to create B2B Company Branding (Phase 1, P1.3 / EPIC-10)

-- 1. Create Company Branding Table
create table if not exists public.company_branding (
  company_id uuid primary key references public.companies(id) on delete cascade,
  logo_url text,
  primary_color text, -- validated hex or oklch format client-side
  welcome_message text,
  default_language text not null default 'id' check (default_language in ('id', 'en')),
  notification_settings jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid references auth.users(id) on delete set null
);

-- Enable RLS
alter table public.company_branding enable row level security;

-- 2. Row Level Security Policies

create policy "Members can view their company branding" on public.company_branding
  for select using (
    exists (
      select 1 from public.company_memberships
      where company_id = company_branding.company_id
        and user_id = auth.uid()
        and status = 'active'
    )
  );

create policy "Owners and admins can manage their company branding" on public.company_branding
  for all using (
    exists (
      select 1 from public.company_memberships
      where company_id = company_branding.company_id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
        and status = 'active'
    )
  );

-- 3. Triggers for updated_at
create trigger handle_company_branding_updated_at
  before update on public.company_branding
  for each row
  execute procedure public.handle_updated_at();
