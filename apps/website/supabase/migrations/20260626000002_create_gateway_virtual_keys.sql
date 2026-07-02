-- Migration: gateway_virtual_keys — per-company AI provider keys stored in Vault (Phase 3, Haro Gateway)

create table if not exists public.gateway_virtual_keys (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  created_by      uuid not null references auth.users(id),
  name            text not null,
  slug            text not null,
  provider        text not null,
  vault_secret_id uuid not null,
  masked_key      text not null,
  is_active       boolean not null default true,
  rate_limit_rpm  integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(company_id, slug)
);

create index idx_gateway_virtual_keys_company on public.gateway_virtual_keys(company_id);
create index idx_gateway_virtual_keys_slug on public.gateway_virtual_keys(slug);

alter table public.gateway_virtual_keys enable row level security;

-- Members can view key metadata (slug, provider, masked_key); vault_secret_id is not exposed via API
create policy "Company members can view virtual keys"
  on public.gateway_virtual_keys for select
  using (
    exists (
      select 1 from public.company_memberships
      where company_id = gateway_virtual_keys.company_id
        and user_id = auth.uid()
        and status = 'active'
    )
  );

-- Only owner/admin/super_admin can manage virtual keys
create policy "Admins can manage virtual keys"
  on public.gateway_virtual_keys for all
  using (
    exists (
      select 1 from public.company_memberships
      where company_id = gateway_virtual_keys.company_id
        and user_id = auth.uid()
        and role in ('owner', 'admin', 'super_admin')
        and status = 'active'
    )
  );

create trigger handle_gateway_virtual_keys_updated_at
  before update on public.gateway_virtual_keys
  for each row execute procedure public.handle_updated_at();
