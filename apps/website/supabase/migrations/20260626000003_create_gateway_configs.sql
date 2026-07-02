-- Migration: gateway_configs — per-company gateway routing/model configuration presets (Phase 3, Haro Gateway)

create table if not exists public.gateway_configs (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  created_by  uuid not null references auth.users(id),
  name        text not null,
  slug        text not null,
  config      jsonb not null default '{}'::jsonb,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(company_id, slug)
);

create index idx_gateway_configs_company on public.gateway_configs(company_id);
create index idx_gateway_configs_slug on public.gateway_configs(slug);

alter table public.gateway_configs enable row level security;

-- Members can view gateway config presets
create policy "Company members can view gateway configs"
  on public.gateway_configs for select
  using (
    exists (
      select 1 from public.company_memberships
      where company_id = gateway_configs.company_id
        and user_id = auth.uid()
        and status = 'active'
    )
  );

-- Only owner/admin/super_admin can manage gateway configs
create policy "Admins can manage gateway configs"
  on public.gateway_configs for all
  using (
    exists (
      select 1 from public.company_memberships
      where company_id = gateway_configs.company_id
        and user_id = auth.uid()
        and role in ('owner', 'admin', 'super_admin')
        and status = 'active'
    )
  );

create trigger handle_gateway_configs_updated_at
  before update on public.gateway_configs
  for each row execute procedure public.handle_updated_at();
