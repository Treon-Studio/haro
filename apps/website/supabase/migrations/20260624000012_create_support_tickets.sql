-- Migration to create B2B Support Tickets (Phase 2, EPIC-05)

-- Create B2B Support Tickets Table
create table if not exists public.support_tickets (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  subject text not null,
  description text not null,
  priority text not null check (priority in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.support_tickets enable row level security;

-- Indexing for speed
create index idx_support_tickets_company_id on public.support_tickets(company_id);

-- RLS: select/insert/update restricted to corporate owners and admins
create policy "Admins can manage support tickets" on public.support_tickets
  for all using (
    exists (
      select 1 from public.company_memberships
      where company_id = support_tickets.company_id
        and user_id = auth.uid()
        and role in ('owner', 'admin', 'super_admin')
        and status = 'active'
    )
  );

-- Triggers for updated_at
create trigger handle_support_tickets_updated_at
  before update on public.support_tickets
  for each row
  execute procedure public.handle_updated_at();
