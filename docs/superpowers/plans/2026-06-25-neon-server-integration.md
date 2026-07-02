# Neon Server Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route all database and authentication queries in the Astro app through our Neon connection pool and compatibility client.

**Architecture:** 
1. Re-route `createSupabaseServerClient` to return `new NeonCompatClient(context)` which translates Supabase query builder style operations into direct Neon/Postgres SQL statements.
2. Update the auth effect execution helper (`runAuthEffect`) to instantiate the Neon auth repository using the context.
3. Update the global application runtime (`app.runtime.ts`) to provide `makeNeonAuthRepository` instead of the Supabase counterpart.

**Tech Stack:** Astro, React, Effect-TS, Neon (PostgreSQL)

---

### Task 1: Redirect Server Client to Neon Compatibility Client

**Files:**
- Modify: `apps/website/src/lib/supabase/server.ts`

- [ ] **Step 1: Replace implementation in `server.ts` with NeonCompatClient instantiation**

Write the following content to `apps/website/src/lib/supabase/server.ts`:
```typescript
import { NeonCompatClient } from "@/lib/neon/compat"

export const createSupabaseServerClient = (context: any): any => {
  return new NeonCompatClient(context)
}
```

- [ ] **Step 2: Commit changes**

```bash
git add apps/website/src/lib/supabase/server.ts
git commit -m "feat: redirect createSupabaseServerClient to NeonCompatClient"
```

---

### Task 2: Update Auth Effect Helper to use Neon Auth Repository

**Files:**
- Modify: `apps/website/src/lib/api-helpers.ts`

- [ ] **Step 1: Replace import of `makeSupabaseAuthRepository` with `makeNeonAuthRepository`**

Search for:
```typescript
import { IAuthRepository, makeSupabaseAuthRepository } from "@/domain/auth/index"
```
And replace with:
```typescript
import { IAuthRepository } from "@/domain/auth/index"
import { makeNeonAuthRepository } from "@/domain/auth/auth.repository.neon"
```

- [ ] **Step 2: Update `runAuthEffect` function body**

Search for:
```typescript
export const runAuthEffect = <A>(
  context: APIContext,
  effect: Effect.Effect<A, { _tag: string; message: string }, IAuthRepository | IInvitationsRepository>,
): Promise<A> => {
  const supabase = createSupabaseServerClient(context)!
  const supabaseRepo = makeSupabaseAuthRepository(supabase)
```
And replace with:
```typescript
export const runAuthEffect = <A>(
  context: APIContext,
  effect: Effect.Effect<A, { _tag: string; message: string }, IAuthRepository | IInvitationsRepository>,
): Promise<A> => {
  const supabase = createSupabaseServerClient(context)!
  const supabaseRepo = makeNeonAuthRepository(context)
```

- [ ] **Step 3: Commit changes**

```bash
git add apps/website/src/lib/api-helpers.ts
git commit -m "feat: use Neon auth repository in runAuthEffect"
```

---

### Task 3: Update App Runtime to use Neon Auth Repository

**Files:**
- Modify: `apps/website/src/infra/runtime/app.runtime.ts`

- [ ] **Step 1: Replace import of `makeSupabaseAuthRepository` and update `runApp` signature**

Write the following content to `apps/website/src/infra/runtime/app.runtime.ts`:
```typescript
import { Effect, Layer, ManagedRuntime } from "effect"
import { IAuthRepository } from "../../domain/auth/auth.repository"
import { makeNeonAuthRepository } from "../../domain/auth/auth.repository.neon"

export const AppLayer = Layer.empty

export const AppRuntime = ManagedRuntime.make(AppLayer)

export const runApp = <A, E>(
  effect: Effect.Effect<A, E, IAuthRepository>,
  context: any,
): Promise<A> =>
  AppRuntime.runPromise(
    effect.pipe(
      Effect.provide(
        Layer.succeed(IAuthRepository, makeNeonAuthRepository(context)),
      ),
    ),
  )
```

- [ ] **Step 2: Commit changes**

```bash
git add apps/website/src/infra/runtime/app.runtime.ts
git commit -m "feat: use Neon auth repository in global AppRuntime"
```

---

### Task 4: Verification and Compilation Checks

- [ ] **Step 1: Run compilation diagnostics (`pnpm check`)**

Run: `pnpm check` from `apps/website`
Expected: Passes without errors.

- [ ] **Step 2: Run build tests (`pnpm build`)**

Run: `pnpm build` from `apps/website`
Expected: Build finishes successfully.

- [ ] **Step 3: Run domain tests to verify Neon functionality**

Run: `pnpm test` from `apps/website`
Expected: All tests pass.
