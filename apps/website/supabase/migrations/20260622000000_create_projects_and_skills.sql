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
