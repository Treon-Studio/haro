-- Migration for application logs and audit logs (Phase 0, Workstream D)

-- 1. Create app_logs table
create table if not exists public.app_logs (
  id uuid default gen_random_uuid() primary key,
  timestamp timestamp with time zone not null,
  level text not null check (level in ('debug', 'info', 'warn', 'error', 'fatal', 'audit')),
  message text not null,
  context jsonb default '{}'::jsonb not null,
  service text not null default 'tenang-web',
  environment text not null check (environment in ('development', 'staging', 'production')),
  error jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for logs viewer queries
create index idx_app_logs_level on public.app_logs(level);
create index idx_app_logs_timestamp on public.app_logs(timestamp desc);
create index idx_app_logs_environment on public.app_logs(environment);
create index idx_app_logs_service on public.app_logs(service);

-- Enable RLS
alter table public.app_logs enable row level security;

-- Service-role insert policy: only backend with service_role key can insert
create policy "Service role can insert app logs" on public.app_logs
  for insert with check (true);

-- Super admin read policy: future proof for logs viewer UI
create policy "Authenticated users can read app logs" on public.app_logs
  for select using (auth.role() = 'authenticated');

-- No update or delete policies: app_logs is append-only


-- 2. Create audit_log table (immutable audit trail)
create table if not exists public.audit_log (
  id uuid default gen_random_uuid() primary key,
  timestamp timestamp with time zone not null,
  level text not null default 'audit',
  message text not null,
  context jsonb default '{}'::jsonb not null,
  service text not null default 'tenang-web',
  environment text not null check (environment in ('development', 'staging', 'production')),
  error jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- Prevent duplicate audit entries
  unique (timestamp, message, service)
);

-- Indexes for audit queries
create index idx_audit_log_timestamp on public.audit_log(timestamp desc);
create index idx_audit_log_message on public.audit_log(message);
create index idx_audit_log_resource on public.audit_log using gin (context jsonb_path_ops);

-- Enable RLS
alter table public.audit_log enable row level security;

-- Service-role insert policy
create policy "Service role can insert audit logs" on public.audit_log
  for insert with check (true);

-- Super admin read policy
create policy "Authenticated users can read audit logs" on public.audit_log
  for select using (auth.role() = 'authenticated');


-- 3. Immutable audit log: prevent UPDATE and DELETE
create or replace function public.prevent_audit_log_mutation()
returns trigger as $$
begin
  raise exception 'audit_log is immutable: update and delete are not allowed';
end;
$$ language plpgsql;

create trigger prevent_audit_log_update
  before update on public.audit_log
  for each row
  execute procedure public.prevent_audit_log_mutation();

create trigger prevent_audit_log_delete
  before delete on public.audit_log
  for each row
  execute procedure public.prevent_audit_log_mutation();
