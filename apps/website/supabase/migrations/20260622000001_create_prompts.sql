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
