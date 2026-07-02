-- ============================================================
-- SEED ACCOUNTS — Haro Demo
-- IDEMPOTENT: Safe to run multiple times.
-- Jalankan di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ospagtyymbrsogmvkayv/sql/new
-- ============================================================

-- Enable pgcrypto (if not already enabled)
create extension if not exists "pgcrypto";

-- ============================================================
-- 0. CLEAN UP existing seed data
-- ============================================================
delete from public.profiles
where user_id in (select id from auth.users where email in ('superadmin@tenang.ai', 'admin@corp.tenang.ai', 'employee1@corp.tenang.ai', 'employee2@corp.tenang.ai', 'terapis@tenang.ai', 'fresh-test@tenang.ai'));

delete from public.company_memberships
where user_id in (select id from auth.users where email in ('superadmin@tenang.ai', 'admin@corp.tenang.ai', 'employee1@corp.tenang.ai', 'employee2@corp.tenang.ai', 'terapis@tenang.ai', 'fresh-test@tenang.ai'));

delete from public.companies where name = 'PT Sejahtera Mental';

delete from auth.identities
where user_id in (select id from auth.users where email in ('superadmin@tenang.ai', 'admin@corp.tenang.ai', 'employee1@corp.tenang.ai', 'employee2@corp.tenang.ai', 'terapis@tenang.ai', 'fresh-test@tenang.ai'));

delete from auth.users
where email in ('superadmin@tenang.ai', 'admin@corp.tenang.ai', 'employee1@corp.tenang.ai', 'employee2@corp.tenang.ai', 'terapis@tenang.ai', 'fresh-test@tenang.ai');

-- ============================================================
-- 1. CREATE USERS
-- ============================================================

-- NOTE: If any auth.users INSERT fails with "column does not exist",
-- simply remove `is_sso_user, is_anonymous, phone` from that statement.
-- These columns exist in most modern Supabase projects.

-- Super Admin
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, phone, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'superadmin@tenang.ai', crypt('Admin123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Super Admin"}'::jsonb, false, false, null, now(), now());

insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, jsonb_build_object('sub', id::text, 'email', 'superadmin@tenang.ai'), 'email', id::text, now(), now(), now()
from auth.users where email = 'superadmin@tenang.ai';

-- Company Admin
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, phone, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@corp.tenang.ai', crypt('Admin123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Budi Santoso"}'::jsonb, false, false, null, now(), now());

insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, jsonb_build_object('sub', id::text, 'email', 'admin@corp.tenang.ai'), 'email', id::text, now(), now(), now()
from auth.users where email = 'admin@corp.tenang.ai';

-- Employee 1
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, phone, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'employee1@corp.tenang.ai', crypt('User123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Siti Rahmawati"}'::jsonb, false, false, null, now(), now());

insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, jsonb_build_object('sub', id::text, 'email', 'employee1@corp.tenang.ai'), 'email', id::text, now(), now(), now()
from auth.users where email = 'employee1@corp.tenang.ai';

-- Employee 2
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, phone, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'employee2@corp.tenang.ai', crypt('User123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Ahmad Fauzi"}'::jsonb, false, false, null, now(), now());

insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, jsonb_build_object('sub', id::text, 'email', 'employee2@corp.tenang.ai'), 'email', id::text, now(), now(), now()
from auth.users where email = 'employee2@corp.tenang.ai';

-- Therapist (B2C)
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, phone, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'terapis@tenang.ai', crypt('Terapis123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Dr. Maya Wijaya"}'::jsonb, false, false, null, now(), now());

insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, jsonb_build_object('sub', id::text, 'email', 'terapis@tenang.ai'), 'email', id::text, now(), now(), now()
from auth.users where email = 'terapis@tenang.ai';

-- ============================================================
-- 2. CREATE COMPANY + MEMBERSHIPS
-- ============================================================
insert into public.companies (id, name)
values (gen_random_uuid(), 'PT Sejahtera Mental');

do $$
declare v_cid uuid;
begin
  select id into v_cid from public.companies where name = 'PT Sejahtera Mental';

  insert into public.company_memberships (company_id, user_id, role, status) values
    (v_cid, (select id from auth.users where email = 'superadmin@tenang.ai'), 'owner', 'active'),
    (v_cid, (select id from auth.users where email = 'admin@corp.tenang.ai'),    'admin',       'active'),
    (v_cid, (select id from auth.users where email = 'employee1@corp.tenang.ai'), 'member',      'active'),
    (v_cid, (select id from auth.users where email = 'employee2@corp.tenang.ai'), 'member',      'active');

  update public.companies set session_quota = 100, sessions_used = 0
  where name = 'PT Sejahtera Mental';
end $$;

-- ============================================================
-- 3. PROFILES
-- ============================================================
insert into public.profiles (user_id, full_name, language, notification_opt_in) values
  ((select id from auth.users where email = 'admin@corp.tenang.ai'),    'Budi Santoso (Admin)', 'id', true),
  ((select id from auth.users where email = 'employee1@corp.tenang.ai'), 'Siti Rahmawati',       'id', true),
  ((select id from auth.users where email = 'employee2@corp.tenang.ai'), 'Ahmad Fauzi',          'id', true),
  ((select id from auth.users where email = 'terapis@tenang.ai'),        'Dr. Maya Wijaya',      'id', true)
on conflict (user_id) do nothing;

-- ============================================================
-- VERIFY
-- ============================================================
select email, id from auth.users
where email in ('superadmin@tenang.ai', 'admin@corp.tenang.ai', 'employee1@corp.tenang.ai', 'employee2@corp.tenang.ai', 'terapis@tenang.ai');
