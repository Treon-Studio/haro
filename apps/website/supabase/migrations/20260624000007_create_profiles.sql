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
