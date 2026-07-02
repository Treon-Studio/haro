-- Migration to create B2B Session Metrics and Analytics logs (Phase 2, EPIC-05)

-- Track lightweight session logs for high-performance aggregate reporting
create table if not exists public.session_metrics (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null, -- references Cloudflare KV conversation ID
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexing for speed
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
