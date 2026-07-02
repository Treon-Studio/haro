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
