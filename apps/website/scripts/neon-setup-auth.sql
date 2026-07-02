-- ============================================================================
-- NEON SETUP AUTH — Compatibility Schema and Functions for Neon/PostgreSQL
-- ============================================================================
-- Purpose:
--   Enables Supabase-compatible schema "auth" and authentication functions
--   (auth.uid, auth.role, auth.email) inside any standard PostgreSQL/Neon
--   database. This ensures migrations and Row Level Security (RLS) policies
--   referencing 'auth.users' or the auth helper functions run successfully.
--
-- Compatibility & Testing:
--   Supports standard Supabase JWT claims via "request.jwt.claims" setting,
--   while providing custom "auth.mock.uid", "auth.mock.role", and 
--   "auth.mock.email" session settings for seamless mocking and testing.
--
-- Usage:
--   Run this script in your Neon SQL console/editor before running the 
--   main codebase migrations.
-- ============================================================================

-- 1. Create 'auth' Schema
CREATE SCHEMA IF NOT EXISTS auth;

-- 2. Define helper function: auth.uid()
--    Looks up 'sub' (User ID) from JWT claims or local test configuration
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT 
    COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'sub',
      NULLIF(current_setting('auth.mock.uid', true), '')
    )::uuid;
$$;

-- 3. Define helper function: auth.role()
--    Looks up 'role' from JWT claims, local test configuration, or defaults to 'authenticated'
CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT 
    COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
      NULLIF(current_setting('auth.mock.role', true), ''),
      'authenticated'
    )::text;
$$;

-- 4. Define helper function: auth.email()
--    Looks up 'email' from JWT claims or local test configuration
CREATE OR REPLACE FUNCTION auth.email()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT 
    COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'email',
      NULLIF(current_setting('auth.mock.email', true), '')
    )::text;
$$;

-- 5. Create 'auth.users' Table
--    Replicates Supabase's auth.users table schema for database-level compatibility
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid,
  aud varchar(255) DEFAULT 'authenticated',
  role varchar(255) DEFAULT 'authenticated',
  email varchar(255) UNIQUE,
  encrypted_password varchar(255),
  email_confirmed_at timestamp with time zone,
  invited_at timestamp with time zone,
  confirmation_token varchar(255),
  confirmation_sent_at timestamp with time zone,
  recovery_token varchar(255),
  recovery_sent_at timestamp with time zone,
  email_change_token_new varchar(255),
  email_change varchar(255),
  email_change_sent_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  raw_app_meta_data jsonb DEFAULT '{"provider":"email","providers":["email"]}'::jsonb,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  is_super_admin boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  phone text UNIQUE,
  phone_confirmed_at timestamp with time zone,
  phone_change text,
  phone_change_token varchar(255),
  phone_change_sent_at timestamp with time zone,
  confirmed_at timestamp with time zone,
  email_change_token_current varchar(255),
  email_change_confirm_status smallint,
  banned_until timestamp with time zone,
  reauthentication_token varchar(255),
  reauthentication_sent_at timestamp with time zone,
  is_sso_user boolean NOT NULL DEFAULT false,
  deleted_at timestamp with time zone,
  is_anonymous boolean NOT NULL DEFAULT false
);

-- Indexes for 'auth.users'
CREATE INDEX IF NOT EXISTS users_email_idx ON auth.users (email);

-- 6. Create 'auth.identities' Table
--    Replicates Supabase's auth.identities table schema for database-level compatibility
CREATE TABLE IF NOT EXISTS auth.identities (
  id text NOT NULL,
  user_id uuid NOT NULL,
  identity_data jsonb NOT NULL,
  provider text NOT NULL,
  last_sign_in_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  provider_id text NOT NULL,
  CONSTRAINT identities_pkey PRIMARY KEY (provider, id),
  CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Indexes for 'auth.identities'
CREATE INDEX IF NOT EXISTS identities_user_id_idx ON auth.identities (user_id);

-- ============================================================================
-- End of Script
-- ============================================================================
