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
