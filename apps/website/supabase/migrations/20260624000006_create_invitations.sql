-- Migration to create B2B Invitations (Phase 1, P1.4 / EPIC-01)

-- 1. Create Invitations Table
create table if not exists public.invitations (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  token_hash text not null unique, -- secure unhashed JWT token representation
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamp with time zone not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  accepted_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.invitations enable row level security;

-- Create indexes for B2B performance
create index idx_invitations_company_id on public.invitations(company_id);
create index idx_invitations_email_status on public.invitations(email, status);

-- 2. Row Level Security Policies

create policy "Owners and admins can manage invitations for their company" on public.invitations
  for all using (
    exists (
      select 1 from public.company_memberships
      where company_id = invitations.company_id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
        and status = 'active'
    )
  );

create policy "Users can view pending invitations matching their email" on public.invitations
  for select using (
    status = 'pending' and (
      -- If user is logged in, they can see matching pending invitations
      email = auth.email()
    )
  );
