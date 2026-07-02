# Supabase to Neon Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Tenang Web from Supabase to Neon Serverless PostgreSQL with a custom PostgreSQL-backed authentication provider, ensuring full compatibility with Cloudflare Workers.

**Architecture:** We will maintain the existing `auth` schema structure (`auth.users`, `auth.identities`) in the Neon database to preserve foreign key constraints, and implement custom JWT authentication via direct SQL queries using `@neondatabase/serverless`.

**Tech Stack:** `@neondatabase/serverless`, `jsonwebtoken` (or Web Crypto APIs for edge compatibility), `bcryptjs` / `scrypt`.

---

## File Changes & Additions Map

- **Create**:
  - `apps/website/src/lib/neon/client.ts` - Neon database client and connection pool.
  - `apps/website/src/domain/auth/auth.repository.neon.ts` - Custom Postgres-backed authentication repository implementing `IAuthRepository`.
  - `apps/website/src/lib/auth/session.ts` - Edge-compatible session encoder/decoder (using Web Crypto APIs to ensure zero-dependency, ultra-fast signing in Cloudflare Workers).
  
- **Modify**:
  - `apps/website/package.json` - Add `@neondatabase/serverless` and any auth hashing library dependencies.
  - `apps/website/src/middleware/auth.ts` - Update auth middleware to use the new Neon session verification.
  - `apps/website/src/lib/supabase/server.ts` - Update or replace server client reference with Neon client.
  - `apps/website/src/domain/companies/companies.repository.neon.ts` (and other 15 repositories) - Transition from Supabase JS client to clean, raw SQL queries.

---

## Phase 1: Dependencies & Neon Connection Setup

### Task 1: Add Dependencies
**Files:**
- Modify: `apps/website/package.json`

- [ ] **Step 1: Edit `package.json` to add Neon and Web Crypto helpers**
Add `@neondatabase/serverless` and `bcryptjs` (plus `@types/bcryptjs` if needed) to dependency lists.
- [ ] **Step 2: Install dependencies**
Run: `pnpm install`
- [ ] **Step 3: Verify install**
Run: `pnpm check` to ensure no dependency resolution errors.

---

## Phase 2: Create Neon Database Connection Layer

### Task 2: Create Neon Connection Pool
**Files:**
- Create: `apps/website/src/lib/neon/client.ts`

- [ ] **Step 1: Implement serverless connection pool**
Use the `@neondatabase/serverless` package to establish a WebSocket-capable database client compatible with Cloudflare Workers.
- [ ] **Step 2: Write test queries**
Verify that connection can run basic SELECT queries successfully.

---

## Phase 3: Raw SQL Schema & Initial Seed on Neon

### Task 3: Setup auth schema in Neon
**Files:**
- Modify: `apps/website/scripts/migrations-full.sql`

- [ ] **Step 1: Export schema**
Prepare SQL statements to initialize the `auth` schema tables (`users`, `identities`, etc.) and all `public` domain tables on the new Neon database.
- [ ] **Step 2: Seed Accounts**
Run the updated seed script to create initial accounts directly inside Neon's `auth.users` with secure `bcrypt` hashed passwords.

---

## Phase 4: Edge-Compatible Custom Auth & Sessions

### Task 4: JWT & Session Handlers
**Files:**
- Create: `apps/website/src/lib/auth/session.ts`

- [ ] **Step 1: Write Web Crypto Session Signing**
Implement edge-compatible JWT signing and verification using the native Web Crypto API (SubtleCrypto) to generate secure session tokens without native Node.js crypto dependencies.
- [ ] **Step 2: Implement password hashing**
Use `bcryptjs` or a Web Crypto-based PBKDF2/scrypt wrapper to securely hash and verify user passwords.

---

## Phase 5: Implement Neon Repositories

### Task 5: Auth Repository
**Files:**
- Create: `apps/website/src/domain/auth/auth.repository.neon.ts`

- [ ] **Step 1: Implement `signUp` & `signIn` using raw SQL**
Verify passwords against the hash in `auth.users` using raw SQL.
- [ ] **Step 2: Implement `getSession` and `signOut`**
Verify the session cookie/token and update session state in the database.

### Task 6: Migrating other repositories
**Files:**
- Create/Modify: `apps/website/src/domain/**/*.repository.neon.ts`

- [ ] **Step 1: Translate PostgREST builders to standard SELECT/INSERT/UPDATE statements**
Replace all `.from().select().insert()` with parameterized SQL statements via the Neon client.

---

## Phase 6: Auth Middleware & Server API Integration

### Task 7: Update Middleware & Server client
**Files:**
- Modify: `apps/website/src/middleware/auth.ts`
- Modify: `apps/website/src/lib/supabase/server.ts`

- [ ] **Step 1: Refactor auth middleware to verify Neon session cookie**
- [ ] **Step 2: Run verification tests**
Run: `pnpm build` to verify there are no compilation or type check errors.
