# Technical Design: Supabase Auth Implementation with Pure FP, Vertical Slice, and Effect-TS

- **Author**: Antigravity
- **Date**: 2026-06-21
- **Status**: Proposed
- **Target Project**: `apps/website` (Astro 5 + Cloudflare Workers)
- **Standards Version**: 2.0.0 (TREON Studio Engineering Law)

---

## 1. Domain Architecture (Vertical Slice)

Following the Vertical Slice Architecture, all authentication code will reside in a single domain directory: `apps/website/src/domain/auth/`.

### 1.1 Directory Structure
```
apps/website/src/domain/auth/
├── auth.types.ts         # Branded types, User/Session shapes (Readonly)
├── auth.errors.ts        # TaggedError definitions (e.g., InvalidCredentialsError)
├── auth.module.ts        # Pure business/auth functions (e.g., hashing/token mapping)
├── auth.repository.ts    # IAuthRepository Context.Tag (Port)
├── auth.repository.supabase.ts # SupabaseAuthRepositoryLive (Adapter)
├── auth.schemas.ts       # Input validation schemas (effect/Schema)
├── auth.dto.ts           # Plain data-transfer shapes & pure mappers
├── auth.programs.ts      # Effect.gen named use cases (Programs)
├── auth.test.ts          # Unit and integration tests using Layer.succeed
└── index.ts              # Public Barrel for auth domain
```

---

## 2. Ports and Adapters (Hexagonal Style)

To ensure tools can be swapped cleanly (DDD/Hexagonal Architecture), the components and API routes will only interact with the `IAuthRepository` Context Tag interface and the Use Cases defined in `auth.programs.ts`.

### 2.1 The Port: `IAuthRepository` (`auth.repository.ts`)
```typescript
import { Context, Effect } from "effect"
import type { TUser, TSession, TAuthCredentials } from "./auth.types"
import type { DatabaseError, AuthError } from "@/shared/errors/infrastructure.errors"

export class IAuthRepository extends Context.Tag("IAuthRepository")<
  IAuthRepository,
  {
    readonly signUp: (
      credentials: TAuthCredentials
    ) => Effect.Effect<TUser, AuthError | DatabaseError>
    
    readonly signIn: (
      credentials: TAuthCredentials
    ) => Effect.Effect<{ readonly user: TUser; readonly session: TSession }, AuthError | DatabaseError>
    
    readonly signOut: () => Effect.Effect<void, DatabaseError>
    
    readonly verifyOtp: (
      email: string,
      token: string,
      type: "signup" | "recovery" | "2fa"
    ) => Effect.Effect<{ readonly user: TUser; readonly session: TSession }, AuthError | DatabaseError>
    
    readonly resetPassword: (
      newPassword: string
    ) => Effect.Effect<void, AuthError | DatabaseError>
    
    readonly getSession: () => Effect.Effect<TSession | null, DatabaseError>
  }
>() {}
```

### 2.2 The Adapter: `SupabaseAuthRepositoryLive` (`auth.repository.supabase.ts`)
Implements `IAuthRepository` using `@supabase/ssr` to synchronize cookies and session data properly with Cloudflare Workers context.

---

## 3. Data Flow & Data Transfer Objects (DTO)

### 3.1 Domain vs. DTO
* `TUser` will contain domain-specific info (branded ID, email, role).
* `TUserDto` maps standard fields to plain serializable string/JSON formats for the frontend (React).
* No secrets, hashes, or platform-specific cookies are exposed to UI components.

---

## 4. Input Validation (Effect/Schema)

All form inputs (login, sign-up, reset-password, 2fa, forgot-password) will use `effect/Schema` to validate inputs at the presentation boundary before running programs.

Schemas defined in `auth.schemas.ts`:
* `LoginSchema`
* `SignUpSchema`
* `ForgotPasswordSchema`
* `ResetPasswordSchema`
* `OtpVerificationSchema`

---

## 5. Web Interface (Astro Middleware & React Blocks)

### 5.1 Astro Middleware (`src/middleware.ts`)
Middleware intercepting Astro pages:
1. Parse cookie tokens.
2. Initialize Supabase SSR client to validate the token.
3. If page is in a protected path (e.g. `/c/*`, `/projects/*`) and token is invalid -> redirect to `/login`.
4. If page is in a guest-only path (e.g. `/login`, `/sign-up`) and token is valid -> redirect to `/c/new` (chat view).

### 5.2 React Frontend Integration
Update existing blocks using functional state hook wrapper `useAuthForm`:
* `/blocks/login/one/index.tsx` -> Wire submitting states, loading buttons, and error display alert.
* `/blocks/sign-up/one/index.tsx` -> Bind to SignUp program and handle successful redirect to OTP verification screen.
* `/blocks/auth/two-factor.tsx` -> Bind to OTP Verification program.
* `/blocks/reset-password/index.tsx` -> Bind to reset password endpoint.
* `/blocks/verify/index.tsx` -> Bind to OTP / Email verify endpoint.
