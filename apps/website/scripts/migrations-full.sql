-- ============================================================
-- FULL MIGRATIONS — Haro
-- Jalankan di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ospagtyymbrsogmvkayv/sql/new
-- ============================================================

-- === 20260622000000_create_projects_and_skills.sql ===
-- Migration for Projects and Skills (Phase 1)

-- 1. Create Projects Table
create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for projects
alter table public.projects enable row level security;

-- Create policies for projects
create policy "Users can view own projects" on public.projects
  for select using (auth.uid() = user_id);

create policy "Users can insert own projects" on public.projects
  for insert with check (auth.uid() = user_id);

create policy "Users can update own projects" on public.projects
  for update using (auth.uid() = user_id);

create policy "Users can delete own projects" on public.projects
  for delete using (auth.uid() = user_id);


-- 2. Create Skills Table
create table if not exists public.skills (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text not null,
  body text,
  category text,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for skills
alter table public.skills enable row level security;

-- Create policies for skills
create policy "Users can view own skills" on public.skills
  for select using (auth.uid() = user_id);

create policy "Users can insert own skills" on public.skills
  for insert with check (auth.uid() = user_id);

create policy "Users can update own skills" on public.skills
  for update using (auth.uid() = user_id);

create policy "Users can delete own skills" on public.skills
  for delete using (auth.uid() = user_id);

-- 3. Create updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 4. Apply triggers to tables
create trigger handle_projects_updated_at
  before update on public.projects
  for each row
  execute procedure public.handle_updated_at();

create trigger handle_skills_updated_at
  before update on public.skills
  for each row
  execute procedure public.handle_updated_at();

-- === 20260622000001_create_prompts.sql ===
-- Migration for Prompts

create table if not exists public.prompts (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category text not null,
  snippet text not null,
  author_name text,
  is_public boolean default false,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.prompts enable row level security;

create policy "Users can view own prompts" on public.prompts
  for select using (auth.uid() = user_id);

create policy "Users can insert own prompts" on public.prompts
  for insert with check (auth.uid() = user_id);

create policy "Users can update own prompts" on public.prompts
  for update using (auth.uid() = user_id);

create policy "Users can delete own prompts" on public.prompts
  for delete using (auth.uid() = user_id);

create trigger handle_prompts_updated_at
  before update on public.prompts
  for each row
  execute procedure public.handle_updated_at();

-- === 20260622000002_create_contact_messages.sql ===
-- Migration for Contact Messages

create table if not exists public.contact_messages (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  subject text,
  message text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Note: We do NOT enable RLS or we enable it but allow anonymous inserts, 
-- because contact forms are usually submitted by guests/unauthenticated users.

alter table public.contact_messages enable row level security;

-- Allow anyone to insert (anon and authenticated)
create policy "Anyone can submit contact message" on public.contact_messages
  for insert with check (true);

-- Only admins/authenticated users can view (for simplicity, we'll just allow authenticated users to view)
create policy "Authenticated users can view contact messages" on public.contact_messages
  for select using (auth.role() = 'authenticated');

-- === 20260622000003_create_faqs.sql ===
-- Migration for FAQs

create table if not exists public.faqs (
  id uuid default gen_random_uuid() primary key,
  question text not null,
  answer text not null,
  sort_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Note: FAQs are usually public
alter table public.faqs enable row level security;

-- Anyone can read FAQs
create policy "Anyone can view faqs" on public.faqs
  for select using (true);

-- Only authenticated admins can manage (for now, any authenticated user)
create policy "Authenticated users can manage faqs" on public.faqs
  for all using (auth.role() = 'authenticated');

-- Insert seed data
insert into public.faqs (question, answer, sort_order) values
('How does the free trial work?', 'Start with a 14-day free trial with full access to all features. No credit card required. You can upgrade to a paid plan at any time during or after the trial.', 1),
('Can I change my plan later?', 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we''ll prorate the difference.', 2),
('What payment methods do you accept?', 'We accept all major credit cards, PayPal, and bank transfers for annual plans. Enterprise customers can also pay via invoice.', 3),
('Is there a setup fee?', 'No, there are no setup fees or hidden costs. You only pay for your subscription plan.', 4),
('Do you offer refunds?', 'We offer a 30-day money-back guarantee. If you''re not satisfied, contact us within 30 days for a full refund.', 5);

-- === 20260622000004_create_team_testimonials.sql ===
-- Migration for Team and Testimonials

-- 1. Testimonials
create table if not exists public.testimonials (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  role text not null,
  quote text not null,
  avatar text,
  sort_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.testimonials enable row level security;
create policy "Anyone can view testimonials" on public.testimonials for select using (true);
create policy "Authenticated users can manage testimonials" on public.testimonials for all using (auth.role() = 'authenticated');

insert into public.testimonials (name, role, quote, avatar, sort_order) values
('Meschac Irung', 'Frontend Engineer at Acme', 'Haro has been a game-changer for our team. It has helped us to build a modern and scalable web application.', 'https://avatars.githubusercontent.com/u/47919550?v=4', 1),
('Theo Balick', 'Founder, CEO - Acme', 'Haro has been a game-changer for our team. It has helped us to build a modern and scalable web application.', 'https://avatars.githubusercontent.com/u/68236786?v=4', 2),
('Sarah Johnson', 'DevOps Engineer', 'Haro has been a game-changer for our team. It has helped us to build a modern and scalable web application.', 'https://avatars.githubusercontent.com/u/12345678?v=4', 3),
('Aisha Patel', 'Data Scientist', 'Haro has been a game-changer for our team. It has helped us to build a modern and scalable web application.', 'https://avatars.githubusercontent.com/u/34567890?v=4', 4);


-- 2. Team Members
create table if not exists public.team_members (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  role text not null,
  bio text not null,
  avatar text,
  sort_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.team_members enable row level security;
create policy "Anyone can view team_members" on public.team_members for select using (true);
create policy "Authenticated users can manage team_members" on public.team_members for all using (auth.role() = 'authenticated');

insert into public.team_members (name, role, bio, avatar, sort_order) values
('Meschac Irung', 'Frontend Engineer at Acme', 'Passionate about intuitive UIs and web performance. Specializes in React and TypeScript with 5+ years of experience.', 'https://avatars.githubusercontent.com/u/47919550?v=4', 1),
('Theo Balick', 'Founder, CEO - Acme', 'Serial entrepreneur transforming team collaboration. Previously led product at two successful startups.', 'https://avatars.githubusercontent.com/u/68236786?v=4', 2);

-- === 20260622000005_create_agents.sql ===
-- Migration for Agents Marketplace

create table if not exists public.agents (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text not null,
  category text not null,
  author text not null,
  avatar_url text,
  is_promoted boolean default false,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.agents enable row level security;

-- Policies
create policy "Anyone can view agents" on public.agents
  for select using (true);

create policy "Authenticated users can create agents" on public.agents
  for insert with check (auth.role() = 'authenticated');

create policy "Users can update their own agents" on public.agents
  for update using (auth.uid() = user_id);

create policy "Users can delete their own agents" on public.agents
  for delete using (auth.uid() = user_id);

-- Insert seed data
insert into public.agents (name, description, category, author, is_promoted) values
('Code Assistant', 'An AI assistant that helps you write code, debug, and understand complex concepts.', 'coding', 'Admin', true),
('Writing Coach', 'Improves your writing style and helps you brainstorm ideas.', 'writing', 'Admin', true),
('Task Manager', 'Helps you organize your daily tasks and priorities.', 'productivity', 'Admin', false),
('Data Analyst', 'Analyzes data sets and provides insights.', 'productivity', 'Admin', false),
('SEO Expert', 'Helps you write SEO-optimized content.', 'writing', 'Admin', false);

-- === 20260624000001_create_app_logs.sql ===
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

-- === 20260624000002_create_companies.sql ===
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

-- === 20260624000003_add_company_id_to_domain_tables.sql ===
-- Migration to add company_id to Domain Tables and isolate by Tenant (Phase 1, P1.3)

-- 1. Alter Projects Table
alter table public.projects 
  add column if not exists company_id uuid references public.companies(id) on delete cascade;

-- Create index for tenant queries
create index if not exists idx_projects_company_id on public.projects(company_id);

-- Recreate policies for projects
drop policy if exists "Users can view own projects" on public.projects;
drop policy if exists "Users can insert own projects" on public.projects;
drop policy if exists "Users can update own projects" on public.projects;
drop policy if exists "Users can delete own projects" on public.projects;

create policy "Users can view projects" on public.projects
  for select using (
    (company_id is null and auth.uid() = user_id) or
    (company_id is not null and exists (
      select 1 from public.company_memberships
      where company_id = projects.company_id
        and user_id = auth.uid()
        and status = 'active'
    ))
  );

create policy "Users can insert projects" on public.projects
  for insert with check (
    auth.uid() = user_id and (
      company_id is null or exists (
        select 1 from public.company_memberships
        where company_id = projects.company_id
          and user_id = auth.uid()
          and status = 'active'
      )
    )
  );

create policy "Users can update projects" on public.projects
  for update using (
    (company_id is null and auth.uid() = user_id) or
    (company_id is not null and exists (
      select 1 from public.company_memberships
      where company_id = projects.company_id
        and user_id = auth.uid()
        and status = 'active'
    ))
  );

create policy "Users can delete projects" on public.projects
  for delete using (
    (company_id is null and auth.uid() = user_id) or
    (company_id is not null and exists (
      select 1 from public.company_memberships
      where company_id = projects.company_id
        and user_id = auth.uid()
        and status = 'active'
    ))
  );


-- 2. Alter Skills Table
alter table public.skills 
  add column if not exists company_id uuid references public.companies(id) on delete cascade;

create index if not exists idx_skills_company_id on public.skills(company_id);

drop policy if exists "Users can view own skills" on public.skills;
drop policy if exists "Users can insert own skills" on public.skills;
drop policy if exists "Users can update own skills" on public.skills;
drop policy if exists "Users can delete own skills" on public.skills;

create policy "Users can view skills" on public.skills
  for select using (
    (company_id is null and auth.uid() = user_id) or
    (company_id is not null and exists (
      select 1 from public.company_memberships
      where company_id = skills.company_id
        and user_id = auth.uid()
        and status = 'active'
    ))
  );

create policy "Users can insert skills" on public.skills
  for insert with check (
    auth.uid() = user_id and (
      company_id is null or exists (
        select 1 from public.company_memberships
        where company_id = skills.company_id
          and user_id = auth.uid()
          and status = 'active'
      )
    )
  );

create policy "Users can update skills" on public.skills
  for update using (
    (company_id is null and auth.uid() = user_id) or
    (company_id is not null and exists (
      select 1 from public.company_memberships
      where company_id = skills.company_id
        and user_id = auth.uid()
        and status = 'active'
    ))
  );

create policy "Users can delete skills" on public.skills
  for delete using (
    (company_id is null and auth.uid() = user_id) or
    (company_id is not null and exists (
      select 1 from public.company_memberships
      where company_id = skills.company_id
        and user_id = auth.uid()
        and status = 'active'
    ))
  );


-- 3. Alter Prompts Table
alter table public.prompts 
  add column if not exists company_id uuid references public.companies(id) on delete cascade;

create index if not exists idx_prompts_company_id on public.prompts(company_id);

-- Let's view existing policies for prompts first to make sure we drop correctly
-- In our schema, prompts are typically isolated.
-- We can add select/insert/update/delete policies for prompts.
drop policy if exists "Users can view own prompts" on public.prompts;
drop policy if exists "Users can insert own prompts" on public.prompts;
drop policy if exists "Users can update own prompts" on public.prompts;
drop policy if exists "Users can delete own prompts" on public.prompts;

create policy "Users can view prompts" on public.prompts
  for select using (
    (company_id is null and auth.uid() = user_id) or
    (company_id is not null and exists (
      select 1 from public.company_memberships
      where company_id = prompts.company_id
        and user_id = auth.uid()
        and status = 'active'
    ))
  );

create policy "Users can insert prompts" on public.prompts
  for insert with check (
    auth.uid() = user_id and (
      company_id is null or exists (
        select 1 from public.company_memberships
        where company_id = prompts.company_id
          and user_id = auth.uid()
          and status = 'active'
      )
    )
  );

create policy "Users can update prompts" on public.prompts
  for update using (
    (company_id is null and auth.uid() = user_id) or
    (company_id is not null and exists (
      select 1 from public.company_memberships
      where company_id = prompts.company_id
        and user_id = auth.uid()
        and status = 'active'
    ))
  );

create policy "Users can delete prompts" on public.prompts
  for delete using (
    (company_id is null and auth.uid() = user_id) or
    (company_id is not null and exists (
      select 1 from public.company_memberships
      where company_id = prompts.company_id
        and user_id = auth.uid()
        and status = 'active'
    ))
  );


-- 4. Alter Agents Table
alter table public.agents 
  add column if not exists company_id uuid references public.companies(id) on delete cascade;

create index if not exists idx_agents_company_id on public.agents(company_id);

drop policy if exists "Users can view own agents" on public.agents;
drop policy if exists "Users can insert own agents" on public.agents;
drop policy if exists "Users can update own agents" on public.agents;
drop policy if exists "Users can delete own agents" on public.agents;

create policy "Users can view agents" on public.agents
  for select using (
    (company_id is null and auth.uid() = user_id) or
    (company_id is not null and exists (
      select 1 from public.company_memberships
      where company_id = agents.company_id
        and user_id = auth.uid()
        and status = 'active'
    ))
  );

create policy "Users can insert agents" on public.agents
  for insert with check (
    auth.uid() = user_id and (
      company_id is null or exists (
        select 1 from public.company_memberships
        where company_id = agents.company_id
          and user_id = auth.uid()
          and status = 'active'
      )
    )
  );

create policy "Users can update agents" on public.agents
  for update using (
    (company_id is null and auth.uid() = user_id) or
    (company_id is not null and exists (
      select 1 from public.company_memberships
      where company_id = agents.company_id
        and user_id = auth.uid()
        and status = 'active'
    ))
  );

create policy "Users can delete agents" on public.agents
  for delete using (
    (company_id is null and auth.uid() = user_id) or
    (company_id is not null and exists (
      select 1 from public.company_memberships
      where company_id = agents.company_id
        and user_id = auth.uid()
        and status = 'active'
    ))
  );

-- === 20260624000004_super_admin_foundation.sql ===
-- Migration for Super Admin & Sales Handoff (Phase 1, P1.2 / EPIC-09)

-- 1. Support 'super_admin' role in company_memberships
-- Drop old check constraint
alter table public.company_memberships drop constraint if exists company_memberships_role_check;

-- Add new check constraint with 'super_admin'
alter table public.company_memberships 
  add constraint company_memberships_role_check 
  check (role in ('owner', 'admin', 'member', 'super_admin'));


-- 2. Create Sales Handoff Artefacts Table
create table if not exists public.handoff_artefacts (
  id uuid default gen_random_uuid() primary key,
  company_name text not null,
  company_size integer not null default 0,
  billing_model text not null default 'flat_rate' check (billing_model in ('flat_rate', 'per_seat', 'usage_based')),
  company_admin_email text not null,
  contract_terms text,
  go_live_date date,
  sales_contact text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for handoff_artefacts
alter table public.handoff_artefacts enable row level security;

-- Index for admin lookup
create index idx_handoff_artefacts_admin_email on public.handoff_artefacts(company_admin_email);

-- RLS policies: only super admins can view and manage handoff documents
create policy "Super admins can manage handoff artefacts" on public.handoff_artefacts
  for all using (
    exists (
      select 1 from public.company_memberships
      where user_id = auth.uid()
        and role = 'super_admin'
        and status = 'active'
    )
  );

-- Triggers for updated_at
create trigger handle_handoff_artefacts_updated_at
  before update on public.handoff_artefacts
  for each row
  execute procedure public.handle_updated_at();

-- === 20260624000005_create_company_branding.sql ===
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

-- === 20260624000006_create_invitations.sql ===
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

-- === 20260624000007_create_profiles.sql ===
-- Migration to create B2B Employee Profiles (Phase 1, P1.5 / EPIC-02)

-- 1. Create Profiles Table
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  age_range text check (age_range in ('18-24', '25-34', '35-44', '45-54', '55+')),
  gender text,
  pronouns text,
  phone text,
  language text not null default 'id' check (language in ('id', 'en')),
  notification_opt_in boolean not null default true,
  department text,
  onboarding_completed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- 2. Row Level Security Policies
create policy "Users can manage own profiles" on public.profiles
  for all using (auth.uid() = user_id);

-- 3. Triggers for updated_at
create trigger handle_profiles_updated_at
  before update on public.profiles
  for each row
  execute procedure public.handle_updated_at();

-- === 20260624000008_company_billing_quotas.sql ===
-- Migration for B2B Billing Quotas (Phase 2, EPIC-06)

-- Upgrades public.companies with billing/quota tracking
alter table public.companies
  add column if not exists session_quota integer not null default 1000,
  add column if not exists sessions_used integer not null default 0;

-- Create B2B Billing Events Audit Table
create table if not exists public.billing_events (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  event_type text not null check (event_type in ('quota_allocated', 'quota_exceeded', 'payment_success', 'payment_failed', 'company_suspended')),
  amount numeric(15, 2) default 0.00,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.billing_events enable row level security;

-- RLS: select restricted to corporate owners, admins, and platform super_admins
create policy "Admins can view billing events" on public.billing_events
  for select using (
    exists (
      select 1 from public.company_memberships
      where company_id = billing_events.company_id
        and user_id = auth.uid()
        and role in ('owner', 'admin', 'super_admin')
        and status = 'active'
    )
  );

-- === 20260624000009_create_risk_and_escalation.sql ===
-- Migration to create B2B Risk & Clinical Safety Escalation (Phase 2, EPIC-04)

create type public.risk_tier as enum ('standard', 'critical');
create type public.case_status as enum ('open', 'assigned', 'resolved', 'dismissed');

-- Risk Flags: recorded whenever self-harm or acute mental distress intent is triggered
create table if not exists public.risk_flags (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  session_id text not null, -- references Cloudflare KV conversation ID
  tier public.risk_tier not null default 'standard',
  ai_summary text, -- detailed summary extracted by AI
  trigger_pattern text, -- matching keywords or safety trigger patterns
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Escalation Cases: actionable cases managed by clinical psychologists
create table if not exists public.escalation_cases (
  id uuid default gen_random_uuid() primary key,
  risk_flag_id uuid not null references public.risk_flags(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  status public.case_status not null default 'open',
  primary_assignee uuid references auth.users(id) on delete set null, -- clinical psychologist
  backup_assignee uuid references auth.users(id) on delete set null,
  followup_attempts jsonb not null default '[]'::jsonb, -- logs of follow-up calls/messages
  outcome text, -- e.g., 'referred_to_psychologist', 'resolved_offline', 'dismissed_false_positive'
  outcome_notes text,
  resolved_at timestamp with time zone,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.risk_flags enable row level security;
alter table public.escalation_cases enable row level security;

-- Only clinical staff, super admins, or company owners can access safety records
create policy "Clinical staff can manage escalation cases" on public.escalation_cases
  for all using (
    exists (
      select 1 from public.company_memberships
      where company_id = escalation_cases.company_id
        and user_id = auth.uid()
        and role in ('owner', 'super_admin', 'clinical_staff')
        and status = 'active'
    )
  );

create policy "Clinical staff can view risk flags" on public.risk_flags
  for select using (
    exists (
      select 1 from public.company_memberships
      where company_id = risk_flags.company_id
        and user_id = auth.uid()
        and role in ('owner', 'super_admin', 'clinical_staff')
        and status = 'active'
    )
  );

-- === 20260624000010_create_session_metrics.sql ===
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

-- === 20260624000011_create_super_admin_automation.sql ===
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

-- === 20260624000012_create_support_tickets.sql ===
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

-- === 20260624000013_create_notifications.sql ===
-- Migration to create B2B Notifications, Announcements, and Preferences (Phase 2, EPIC-12)

create type public.notification_category as enum ('re_engagement', 'content_progress', 'announcement', 'alert', 'crisis');
create type public.notification_channel as enum ('in_app', 'email');

-- Create Notifications Table
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category public.notification_category not null,
  title text not null,
  body text not null,
  link text,
  read_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.notifications enable row level security;

-- Indexes for lightning fast notification listings
create index idx_notifications_user_unread on public.notifications(user_id) where read_at is null;

-- RLS: select/update only allowed for the owner (user_id = auth.uid())
create policy "Users can manage own notifications" on public.notifications
  for all using (auth.uid() = user_id);

-- Create Notification Preferences Table
create table if not exists public.notification_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  channel public.notification_channel not null,
  category public.notification_category not null,
  enabled boolean not null default true,
  primary key (user_id, channel, category)
);

-- Enable RLS
alter table public.notification_preferences enable row level security;

create policy "Users can manage own preferences" on public.notification_preferences
  for all using (auth.uid() = user_id);
