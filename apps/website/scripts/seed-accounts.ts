// Run this SQL in Supabase SQL Editor:
// https://supabase.com/dashboard/project/ospagtyymbrsogmvkayv/sql/new

const output = `
-- ============================================================
-- IDEMPOTENT SEED — Haro Demo
-- Safe to run multiple times.
-- Jalankan di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ospagtyymbrsogmvkayv/sql/new
-- ============================================================
-- Password: Admin123!  (superadmin + admin)
-- Password: User123!   (employees)
-- Password: Terapis123! (therapist)

-- Enable pgcrypto (if not already enabled)
create extension if not exists "pgcrypto";

-- ============================================================
-- 0. CLEAN UP existing seed data
-- ============================================================
delete from public.profiles
where user_id in (
  select id from auth.users
  where email in ('superadmin@tenang.ai', 'admin@corp.tenang.ai', 'employee1@corp.tenang.ai', 'employee2@corp.tenang.ai', 'terapis@tenang.ai')
);

delete from public.company_memberships
where user_id in (
  select id from auth.users
  where email in ('superadmin@tenang.ai', 'admin@corp.tenang.ai', 'employee1@corp.tenang.ai', 'employee2@corp.tenang.ai', 'terapis@tenang.ai')
);

delete from public.companies
where name = 'PT Sejahtera Mental';

delete from auth.identities
where user_id in (
  select id from auth.users
  where email in ('superadmin@tenang.ai', 'admin@corp.tenang.ai', 'employee1@corp.tenang.ai', 'employee2@corp.tenang.ai', 'terapis@tenang.ai')
);

delete from auth.users
where email in ('superadmin@tenang.ai', 'admin@corp.tenang.ai', 'employee1@corp.tenang.ai', 'employee2@corp.tenang.ai', 'terapis@tenang.ai');

do \$\$
declare
  v_super_id uuid := gen_random_uuid();
  v_admin_id uuid := gen_random_uuid();
  v_emp1_id  uuid := gen_random_uuid();
  v_emp2_id  uuid := gen_random_uuid();
  v_terapis_id uuid := gen_random_uuid();

  v_pw_super text := crypt('Admin123!', gen_salt('bf'));
  v_pw_admin text := crypt('Admin123!', gen_salt('bf'));
  v_pw_emp   text := crypt('User123!', gen_salt('bf'));
  v_pw_terapis text := crypt('Terapis123!', gen_salt('bf'));

  v_company_id uuid;
begin

  -- ============================================================
  -- 1. CREATE USERS in auth.users
  -- ============================================================

  -- Super Admin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_super_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'superadmin@tenang.ai', v_pw_super, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Super Admin"}', now(), now());

  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (v_super_id, v_super_id, jsonb_build_object('sub', v_super_id::text, 'email', 'superadmin@tenang.ai'), 'email', v_super_id::text, now(), now(), now());

  -- Company Admin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@corp.tenang.ai', v_pw_admin, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Budi Santoso"}', now(), now());

  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (v_admin_id, v_admin_id, jsonb_build_object('sub', v_admin_id::text, 'email', 'admin@corp.tenang.ai'), 'email', v_admin_id::text, now(), now(), now());

  -- Employee 1
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_emp1_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'employee1@corp.tenang.ai', v_pw_emp, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Siti Rahmawati"}', now(), now());

  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (v_emp1_id, v_emp1_id, jsonb_build_object('sub', v_emp1_id::text, 'email', 'employee1@corp.tenang.ai'), 'email', v_emp1_id::text, now(), now(), now());

  -- Employee 2
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_emp2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'employee2@corp.tenang.ai', v_pw_emp, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ahmad Fauzi"}', now(), now());

  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (v_emp2_id, v_emp2_id, jsonb_build_object('sub', v_emp2_id::text, 'email', 'employee2@corp.tenang.ai'), 'email', v_emp2_id::text, now(), now(), now());

  -- Therapist (B2C)
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_terapis_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'terapis@tenang.ai', v_pw_terapis, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dr. Maya Wijaya"}', now(), now());

  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (v_terapis_id, v_terapis_id, jsonb_build_object('sub', v_terapis_id::text, 'email', 'terapis@tenang.ai'), 'email', v_terapis_id::text, now(), now(), now());

  -- ============================================================
  -- 2. CREATE COMPANY + MEMBERSHIPS
  -- ============================================================
  insert into public.companies (id, name)
  values (gen_random_uuid(), 'PT Sejahtera Mental')
  returning id into v_company_id;

  insert into public.company_memberships (company_id, user_id, role, status) values
    (v_company_id, v_super_id,    'super_admin', 'active'),
    (v_company_id, v_admin_id,    'admin',       'active'),
    (v_company_id, v_emp1_id,     'member',      'active'),
    (v_company_id, v_emp2_id,     'member',      'active');

  -- ============================================================
  -- 3. PROFILES
  -- ============================================================
  insert into public.profiles (user_id, full_name, language, notification_opt_in) values
    (v_admin_id,    'Budi Santoso (Admin)', 'id', true),
    (v_emp1_id,     'Siti Rahmawati',       'id', true),
    (v_emp2_id,     'Ahmad Fauzi',          'id', true),
    (v_terapis_id,  'Dr. Maya Wijaya',      'id', true)
  on conflict (user_id) do nothing;

  -- ============================================================
  -- 4. SESSION QUOTA
  -- ============================================================
  update public.companies
  set session_quota = 100,
      sessions_used = 0
  where name = 'PT Sejahtera Mental';

  raise notice '✅ SEED COMPLETE';
end;
\$\$;

-- ============================================================
-- VERIFY
-- ============================================================
select email, id from auth.users
where email in ('superadmin@tenang.ai', 'admin@corp.tenang.ai', 'employee1@corp.tenang.ai', 'employee2@corp.tenang.ai', 'terapis@tenang.ai');
`

// Copy-paste to clipboard instruction
console.log(output.trim())
console.log("\n---")
console.log("Akun yang dibuat:")
console.log("  superadmin@tenang.ai  / Admin123!   → Super Admin")
console.log("  admin@corp.tenang.ai   / Admin123!   → B2B Company Admin")
console.log("  employee1@corp.tenang.ai / User123!  → B2B Employee")
console.log("  employee2@corp.tenang.ai / User123!  → B2B Employee")
console.log("  terapis@tenang.ai     / Terapis123!  → Therapist (B2C)")
