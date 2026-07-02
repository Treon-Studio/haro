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
