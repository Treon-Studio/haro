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
