-- Migration: gateway_settings — global and per-company key-value config store (Phase 3, Haro Gateway)

create table if not exists public.gateway_settings (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  key        text not null,
  value      text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, key)
);

alter table public.gateway_settings enable row level security;

-- Members can read settings (including global settings where company_id is null)
create policy "Company members can view gateway settings"
  on public.gateway_settings for select
  using (
    company_id is null
    or exists (
      select 1 from public.company_memberships
      where company_id = gateway_settings.company_id
        and user_id = auth.uid()
        and status = 'active'
    )
  );

-- Only owner/admin/super_admin can insert/update/delete
create policy "Admins can manage gateway settings"
  on public.gateway_settings for all
  using (
    exists (
      select 1 from public.company_memberships
      where company_id = gateway_settings.company_id
        and user_id = auth.uid()
        and role in ('owner', 'admin', 'super_admin')
        and status = 'active'
    )
  );

create trigger handle_gateway_settings_updated_at
  before update on public.gateway_settings
  for each row execute procedure public.handle_updated_at();
