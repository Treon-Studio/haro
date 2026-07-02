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
