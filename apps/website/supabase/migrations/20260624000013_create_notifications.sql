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
