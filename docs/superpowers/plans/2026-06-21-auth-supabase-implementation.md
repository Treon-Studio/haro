# Auth Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all auth blocks (login, signup, forgot-password, reset-password, 2FA, verify, OAuth) to Supabase Auth following Pure FP, Vertical Slice, Effect-TS, and Hexagonal Architecture standards.

**Architecture:** Domain-driven with a central `IAuthRepository` port (Context.Tag) implemented by `SupabaseAuthRepositoryLive` adapter. React components call `auth.programs.ts` (Effect.gen use cases). Astro middleware guards protected routes by validating session cookies via `@supabase/ssr`. Adapter pattern ensures swapping providers (Firebase, custom backend) only requires changing the XxxLive file + one line in runtime.

**Tech Stack:** Astro 5 (SSR + Cloudflare Workers), React 19, Supabase Auth, `effect` (Effect-TS), `@supabase/supabase-js`, `@supabase/ssr`, Tailwind v4

---

## File Structure

```
apps/website/src/
├── shared/
│   ├── constants/
│   │   └── api.constants.ts        # ROUTES, HTTP_STATUS, ERROR_TAG strings
│   └── types/
│       └── common.types.ts         # TUserId, TSessionUser, TApiResponse
│
├── domain/auth/
│   ├── auth.types.ts               # TUser, TSession, TAuthCredentials, TAuthDto
│   ├── auth.errors.ts              # InvalidCredentialsError, EmailNotVerifiedError, etc.
│   ├── auth.schemas.ts             # LoginSchema, SignUpSchema, etc. (effect/Schema)
│   ├── auth.module.ts              # Pure business logic (only if any value transformations are needed; password validation, etc.)
│   ├── auth.repository.ts          # IAuthRepository Context.Tag (PORT)
│   ├── auth.repository.supabase.ts # SupabaseAuthRepositoryLive (ADAPTER) — NEW FILE
│   ├── auth.dto.ts                 # toAuthDto, toUserDto — pure mappers (PORT -> DTO)
│   ├── auth.programs.ts            # loginProgram, signUpProgram, logoutProgram, resetPasswordProgram, etc.
│   └── index.ts                    # Public barrel
│
├── infra/runtime/
│   └── app.runtime.ts              # AppLayer composition, ManagedRuntime, runApp()
│
├── middleware/
│   └── auth.ts                     # Astro middleware: validate session, inject user to locals, redirects
│   └── index.ts                    # Combine, export sequence
│
├── pages/
│   ├── api/auth/
│   │   ├── signup.ts               # POST handler
│   │   ├── login.ts                # POST handler
│   │   ├── logout.ts               # POST handler
│   │   ├── verify.ts               # POST handler
│   │   ├── forgot-password.ts      # POST handler
│   │   ├── reset-password.ts       # POST handler
│   │   ├── 2fa.ts                  # POST handler
│   │   └── session.ts             # GET handler — check current session
│   └── login/index.astro           # (existing, may need minor update)
│   └── sign-up/index.astro         # (existing, may need minor update)
│
├── blocks/
│   ├── login/one/index.tsx         # UPDATE: Add 'use client', form state, API call
│   ├── sign-up/one/index.tsx       # UPDATE: Add 'use client', form state, API call
│   ├── forgot-password/one/index.tsx       # UPDATE: Add 'use client', form state, API call
│   ├── reset-password/index.tsx            # UPDATE: Replace mock setTimeout with API call
│   ├── auth/two-factor.tsx                 # UPDATE: Replace mock setTimeout with API call
│   └── verify/index.tsx                   # UPDATE: Read URL params, verify via API
│
└── lib/
    └── supabase/
        ├── client.ts               # Client-side Supabase client (browser)
        └── server.ts               # Server-side Supabase client (Astro API context)
```

---

## Phase 1: Foundation (Shared Types, Env, Dependencies)

### Task 1.1: Create shared constants and types

**Files:**
- Create: `apps/website/src/shared/constants/api.constants.ts`
- Create: `apps/website/src/shared/types/common.types.ts`

- [ ] **Step 1: Create `shared/constants/api.constants.ts`**

```typescript
export const ROUTES = {
  API: {
    AUTH: {
      SIGNUP: "/api/auth/signup",
      LOGIN: "/api/auth/login",
      LOGOUT: "/api/auth/logout",
      VERIFY: "/api/auth/verify",
      FORGOT_PASSWORD: "/api/auth/forgot-password",
      RESET_PASSWORD: "/api/auth/reset-password",
      TWO_FACTOR: "/api/auth/2fa",
      SESSION: "/api/auth/session",
    },
  },
  PAGE: {
    LOGIN: "/login",
    SIGNUP: "/sign-up",
    FORGOT_PASSWORD: "/forgot-password",
    RESET_PASSWORD: "/reset-password",
    VERIFY: "/verify",
    TWO_FACTOR: "/login/2fa",
    DASHBOARD: "/c/new",
  },
  PROTECTED: ["/c/", "/projects/", "/skills/", "/prompts/", "/agents/", "/search/", "/files/", "/bookmarks/", "/memories/"],
  GUEST_ONLY: ["/login", "/sign-up", "/forgot-password", "/reset-password"],
} as const

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const

export const ERROR_TAG = {
  VALIDATION_ERROR: "ValidationError",
  INVALID_CREDENTIALS: "InvalidCredentialsError",
  EMAIL_NOT_VERIFIED: "EmailNotVerifiedError",
  EMAIL_ALREADY_REGISTERED: "EmailAlreadyRegisteredError",
  SESSION_EXPIRED: "SessionExpiredError",
  USER_NOT_FOUND: "UserNotFoundError",
  RATE_LIMITED: "RateLimitedError",
  DATABASE_ERROR: "DatabaseError",
  AUTH_PROVIDER_ERROR: "AuthProviderError",
  NETWORK_ERROR: "NetworkError",
} as const
```

- [ ] **Step 2: Create `shared/types/common.types.ts`**

```typescript
export type TUserId = string & { readonly _brand: "UserId" }
export type TSessionId = string & { readonly _brand: "SessionId" }

export type TSessionUser = {
  readonly sessionId: TSessionId
  readonly userId: TUserId
  readonly email: string
}

export type TApiResponse<T> =
  | { readonly success: true; readonly data: T; readonly meta: TApiMeta }
  | { readonly success: false; readonly error: TApiError; readonly meta: TApiMeta }

export type TApiMeta = {
  readonly requestId: string
  readonly timestamp: string
}

export type TApiError = {
  readonly _tag: string
  readonly message: string
  readonly details?: string
}
```

- [ ] **Step 3: Install dependencies**

Run: `pnpm add @supabase/supabase-js @supabase/ssr effect @effect/schema`

- [ ] **Step 4: Add env variables**

Append to `apps/website/.env.example` and `.env`:
```
PUBLIC_SUPABASE_URL="your_supabase_project_url"
PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"
```

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/shared/ apps/website/.env.example apps/website/package.json apps/website/pnpm-lock.yaml
git commit -m "feat(auth): add shared types, constants, and Supabase dependencies"
```

---

## Phase 2: Auth Domain Layer

### Task 2.1: Auth types & errors

**Files:**
- Create: `apps/website/src/domain/auth/auth.types.ts`
- Create: `apps/website/src/domain/auth/auth.errors.ts`

- [ ] **Step 1: Create `auth.types.ts`**

```typescript
import type { TUserId } from "@/shared/types/common.types"

export type TAuthCredentials = {
  readonly email: string
  readonly password: string
}

export type TAuthSignUpProps = {
  readonly email: string
  readonly password: string
}

export type TUser = {
  readonly id: TUserId
  readonly email: string
  readonly emailVerified: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

export type TSession = {
  readonly sessionId: string
  readonly userId: TUserId
  readonly expiresAt: string
}

export type TAuthResult = {
  readonly user: TUser
  readonly session: TSession
}

export type TUserDto = {
  readonly id: string
  readonly email: string
  readonly emailVerified: boolean
  readonly createdAt: string
}

export type TAuthDto = {
  readonly user: TUserDto
  readonly sessionId: string
}
```

- [ ] **Step 2: Create `auth.errors.ts`**

```typescript
import { Data } from "effect"

export class InvalidCredentialsError extends Data.TaggedError("InvalidCredentialsError")<{
  readonly message: string
}>() {}

export class EmailAlreadyRegisteredError extends Data.TaggedError("EmailAlreadyRegisteredError")<{
  readonly email: string
}>() {}

export class EmailNotVerifiedError extends Data.TaggedError("EmailNotVerifiedError")<{
  readonly email: string
}>() {}

export class SessionExpiredError extends Data.TaggedError("SessionExpiredError")<{
  readonly sessionId: string
}>() {}

export class UserNotFoundError extends Data.TaggedError("UserNotFoundError")<{
  readonly email?: string
  readonly id?: string
}>() {}

export class AuthProviderError extends Data.TaggedError("AuthProviderError")<{
  readonly message: string
  readonly status?: number
}>() {}
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/domain/auth/
git commit -m "feat(auth): add domain types and TaggedError definitions"
```

---

### Task 2.2: Auth schemas (effect/Schema)

**Files:**
- Create: `apps/website/src/domain/auth/auth.schemas.ts`

- [ ] **Step 1: Create `auth.schemas.ts`**

```typescript
import { Schema } from "@effect/schema"

export const LoginSchema = Schema.Struct({
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  password: Schema.String.pipe(Schema.minLength(6)),
})

export const SignUpSchema = Schema.Struct({
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  password: Schema.String.pipe(Schema.minLength(8)),
})

export const ForgotPasswordSchema = Schema.Struct({
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
})

export const ResetPasswordSchema = Schema.Struct({
  password: Schema.String.pipe(Schema.minLength(8)),
  tokenHash: Schema.String,
})

export const OtpVerificationSchema = Schema.Struct({
  email: Schema.String,
  token: Schema.String,
  type: Schema.Union(Schema.Literal("signup"), Schema.Literal("recovery"), Schema.Literal("2fa")),
})

export type LoginCommand = Schema.Schema.Type<typeof LoginSchema>
export type SignUpCommand = Schema.Schema.Type<typeof SignUpSchema>
export type ForgotPasswordCommand = Schema.Schema.Type<typeof ForgotPasswordSchema>
export type ResetPasswordCommand = Schema.Schema.Type<typeof ResetPasswordSchema>
export type OtpVerificationCommand = Schema.Schema.Type<typeof OtpVerificationSchema>
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd apps/website && npx tsc --noEmit --strict`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/domain/auth/auth.schemas.ts
git commit -m "feat(auth): add input validation schemas with effect/Schema"
```

---

### Task 2.3: DTO mappers

**Files:**
- Create: `apps/website/src/domain/auth/auth.dto.ts`

- [ ] **Step 1: Create `auth.dto.ts`**

```typescript
import type { TUser, TUserDto, TAuthResult, TAuthDto } from "./auth.types"

export const toUserDto = (user: TUser): TUserDto => ({
  id: user.id,
  email: user.email,
  emailVerified: user.emailVerified,
  createdAt: user.createdAt,
})

export const toAuthDto = (result: TAuthResult): TAuthDto => ({
  user: toUserDto(result.user),
  sessionId: result.session.sessionId,
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/domain/auth/auth.dto.ts
git commit -m "feat(auth): add DTO and pure mapping functions"
```

---

### Task 2.4: Auth module (pure business logic)

**Files:**
- Create: `apps/website/src/domain/auth/auth.module.ts`

- [ ] **Step 1: Create `auth.module.ts`**

```typescript
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const normalizeEmail = (raw: string): string =>
  raw.toLowerCase().trim()

export const AuthModule = {
  normalizeEmail: (raw: string): string => normalizeEmail(raw),

  isValidEmail: (email: string): boolean =>
    EMAIL_REGEX.test(normalizeEmail(email)),
} as const
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/domain/auth/auth.module.ts
git commit -m "feat(auth): add auth module with pure business functions"
```

---

### Task 2.5: Repository Port (IAuthRepository)

**Files:**
- Create: `apps/website/src/domain/auth/auth.repository.ts`

- [ ] **Step 1: Create `auth.repository.ts`**

```typescript
import { Context, Effect } from "effect"
import type { TUser, TSession, TAuthResult } from "./auth.types"
import { InvalidCredentialsError, EmailAlreadyRegisteredError, EmailNotVerifiedError, SessionExpiredError, AuthProviderError, UserNotFoundError } from "./auth.errors"

export class IAuthRepository extends Context.Tag("IAuthRepository")<
  IAuthRepository,
  {
    readonly signUp: (
      email: string,
      password: string,
    ) => Effect.Effect<TAuthResult, EmailAlreadyRegisteredError | AuthProviderError>

    readonly signIn: (
      email: string,
      password: string,
    ) => Effect.Effect<TAuthResult, InvalidCredentialsError | EmailNotVerifiedError | AuthProviderError>

    readonly signOut: () => Effect.Effect<void, AuthProviderError>

    readonly getSession: () => Effect.Effect<TAuthResult | null, AuthProviderError>

    readonly verifyOtp: (
      email: string,
      token: string,
      type: "signup" | "recovery" | "2fa",
    ) => Effect.Effect<TAuthResult, AuthProviderError | UserNotFoundError>

    readonly sendPasswordResetEmail: (
      email: string,
    ) => Effect.Effect<void, UserNotFoundError | AuthProviderError>

    readonly updatePassword: (
      newPassword: string,
    ) => Effect.Effect<void, AuthProviderError | SessionExpiredError>

    readonly signInWithOAuth: (
      provider: "google" | "github",
      redirectTo: string,
    ) => Effect.Effect<{ readonly url: string }, AuthProviderError>
  }
>() {}
```

- [ ] **Step 2: Create the public barrel `index.ts`**

```typescript
export type * from "./auth.types"
export * from "./auth.errors"
export * from "./auth.schemas"
export * from "./auth.dto"
export * from "./auth.module"
export { IAuthRepository } from "./auth.repository"
export type { TAuthDto, TUserDto, TAuthResult, TUser } from "./auth.types"
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/domain/auth/
git commit -m "feat(auth): add IAuthRepository port and public barrel"
```

---

## Phase 3: Infrastructure Layer (Supabase Adapter)

### Task 3.1: Supabase clients

**Files:**
- Create: `apps/website/src/lib/supabase/server.ts`
- Create: `apps/website/src/lib/supabase/client.ts`

- [ ] **Step 1: Create `lib/supabase/server.ts`**

```typescript
import { createServerClient } from "@supabase/ssr"
import type { AstroGlobal } from "astro"
import type { APIContext } from "astro"

export const createSupabaseServerClient = (context: APIContext | AstroGlobal) =>
  createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL!,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // In Cloudflare Workers / Astro SSR, cookies are on request.headers
          if ("request" in context) {
            const cookie = context.request.headers.get("cookie") ?? ""
            return cookie.split("; ").filter(Boolean).map((c) => {
              const [name, ...rest] = c.split("=")
              return { name: name!, value: rest.join("=") }
            })
          }
          return []
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            if ("url" in context) {
              // AstroGlobal (pages) - set via Astro.cookies
              context.cookies.set(name, value, { ...options, path: "/" })
            }
          })
        },
      },
    },
  )
```

- [ ] **Step 2: Create `lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from "@supabase/ssr"

export const createSupabaseBrowserClient = () =>
  createBrowserClient(
    import.meta.env.PUBLIC_SUPABASE_URL!,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY!,
  )
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/lib/supabase/
git commit -m "feat(auth): add Supabase server and browser client factories"
```

---

### Task 3.2: SupabaseAuthRepositoryLive (Adapter)

**Files:**
- Create: `apps/website/src/domain/auth/auth.repository.supabase.ts`
- Modify: `apps/website/src/domain/auth/index.ts` (export new file)

- [ ] **Step 1: Create `auth.repository.supabase.ts`**

```typescript
import { Effect, Layer } from "effect"
import type { SupabaseClient } from "@supabase/supabase-js"
import { IAuthRepository } from "./auth.repository"
import type { TAuthResult, TUser, TSession } from "./auth.types"
import { TUserId } from "@/shared/types/common.types"
import {
  InvalidCredentialsError,
  EmailAlreadyRegisteredError,
  EmailNotVerifiedError,
  SessionExpiredError,
  AuthProviderError,
  UserNotFoundError,
} from "./auth.errors"
import { AuthModule } from "./auth.module"

const toAuthResult = (supabaseUser: { id: string; email?: string | null; email_confirmed_at?: string | null }, sessionId: string): TAuthResult => ({
  user: {
    id: supabaseUser.id as TUserId,
    email: supabaseUser.email ?? "",
    emailVerified: !!supabaseUser.email_confirmed_at,
    createdAt: "",
    updatedAt: "",
  },
  session: {
    sessionId,
    userId: supabaseUser.id as TUserId,
    expiresAt: "",
  },
})

const mapAuthError = (error: { message: string; status?: number }): AuthProviderError =>
  new AuthProviderError({ message: error.message, status: error.status })

export const makeSupabaseAuthRepository = (
  supabase: SupabaseClient,
): Effect.Effect<IAuthRepository["Type"], never> =>
  Effect.succeed({
    signUp: (email, password) =>
      Effect.tryPromise({
        try: async () => {
          const normalized = AuthModule.normalizeEmail(email)
          const { data, error } = await supabase.auth.signUp({
            email: normalized,
            password,
            options: { emailRedirectTo: `${import.meta.env.PUBLIC_SITE_URL ?? ""}/verify` },
          })
          if (error) throw error
          if (!data.user || !data.session) throw new Error("No user/session returned")
          return toAuthResult(data.user, data.session.access_token)
        },
        catch: (err: any) => {
          if (err?.message?.includes("already registered")) {
            return new EmailAlreadyRegisteredError({ email })
          }
          return mapAuthError(err)
        },
      }),

    signIn: (email, password) =>
      Effect.tryPromise({
        try: async () => {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: AuthModule.normalizeEmail(email),
            password,
          })
          if (error) throw error
          if (!data.user || !data.session) throw new Error("No user/session returned")
          return toAuthResult(data.user, data.session.access_token)
        },
        catch: (err: any) => {
          if (err?.message?.includes("Invalid login credentials")) {
            return new InvalidCredentialsError({ message: "Email atau password salah" })
          }
          if (err?.message?.includes("Email not confirmed")) {
            return new EmailNotVerifiedError({ email })
          }
          return mapAuthError(err)
        },
      }),

    signOut: () =>
      Effect.tryPromise({
        try: async () => {
          const { error } = await supabase.auth.signOut()
          if (error) throw error
        },
        catch: (err: any) => mapAuthError(err),
      }),

    getSession: () =>
      Effect.tryPromise({
        try: async () => {
          const { data, error } = await supabase.auth.getSession()
          if (error) throw error
          if (!data.session?.user) return null
          return toAuthResult(data.session.user, data.session.access_token)
        },
        catch: (err: any) => mapAuthError(err),
      }),

    verifyOtp: (email, token, type) =>
      Effect.tryPromise({
        try: async () => {
          const { data, error } = await supabase.auth.verifyOtp({
            email: AuthModule.normalizeEmail(email),
            token,
            type: type === "2fa" ? "email" : type === "recovery" ? "recovery" : "signup",
          })
          if (error) throw error
          if (!data.user) throw new Error("User not found")
          return toAuthResult(data.user, data.session?.access_token ?? "")
        },
        catch: (err: any) => {
          if (err?.message?.includes("not found")) return new UserNotFoundError({ email })
          return mapAuthError(err)
        },
      }),

    sendPasswordResetEmail: (email) =>
      Effect.tryPromise({
        try: async () => {
          const { error } = await supabase.auth.resetPasswordForEmail(
            AuthModule.normalizeEmail(email),
            { redirectTo: `${import.meta.env.PUBLIC_SITE_URL ?? ""}/reset-password` },
          )
          if (error) throw error
        },
        catch: (err: any) => mapAuthError(err),
      }),

    updatePassword: (newPassword) =>
      Effect.tryPromise({
        try: async () => {
          const { error } = await supabase.auth.updateUser({ password: newPassword })
          if (error) throw error
        },
        catch: (err: any) => {
          if (err?.message?.includes("session")) return new SessionExpiredError({ sessionId: "" })
          return mapAuthError(err)
        },
      }),

    signInWithOAuth: (provider, redirectTo) =>
      Effect.tryPromise({
        try: async () => {
          const { data, error } = await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo },
          })
          if (error) throw error
          if (!data.url) throw new Error("No OAuth URL returned")
          return { url: data.url }
        },
        catch: (err: any) => mapAuthError(err),
      }),
  })

export const SupabaseAuthRepositoryLive = Layer.effect(
  IAuthRepository,
  makeSupabaseAuthRepository(
    // This will be provided from context at runtime
    // The live layer expects supabase client to be passed in
    null as unknown as SupabaseClient,
  ),
)
```



- [ ] **Step 2: Update `index.ts`**

```typescript
export type * from "./auth.types"
export * from "./auth.errors"
export * from "./auth.schemas"
export * from "./auth.dto"
export * from "./auth.module"
export { IAuthRepository } from "./auth.repository"
export { SupabaseAuthRepositoryLive, makeSupabaseAuthRepository } from "./auth.repository.supabase"
```

- [ ] **Step 3: Verify compilation**

Run: `cd apps/website && npx tsc --noEmit --strict`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/domain/auth/
git commit -m "feat(auth): implement SupabaseAuthRepositoryLive adapter"
```

---

### Task 3.3: App Runtime (ManagedRuntime + AppLayer)

**Files:**
- Create: `apps/website/src/infra/runtime/app.runtime.ts`

- [ ] **Step 1: Create `app.runtime.ts`**

```typescript
import { ManagedRuntime, Layer } from "effect"

// We build the AppLayer with the auth repository
// The Supabase client is injected at request time via the API route
// So the layer here is an empty composition root for now
// The real layer composition happens in API routes by providing the supabase client
export const AppLayer = Layer.empty

export const AppRuntime = ManagedRuntime.make(AppLayer)

/**
 * runApp is the single entry point from Effect world to async world.
 * It takes an Effect requiring `IAuthRepository` and provides the layer at call time.
 * 
 * Usage: const result = await runApp(program, supabaseClient)
 */
export const runApp = <A, E>(
  effect: Effect.Effect<A, E, IAuthRepository>,
  supabase: SupabaseClient,
): Promise<A> =>
  AppRuntime.runPromise(
    effect.pipe(
      Effect.provide(
        Layer.succeed(IAuthRepository, makeSupabaseAuthRepository(supabase)),
      ),
    ),
  )
```



- [ ] **Step 2: Ensure `Effect` is imported**

Make sure `import { Effect } from "effect"` is added at the top.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/infra/runtime/
git commit -m "feat(auth): add AppRuntime and runApp helper"
```

---

## Phase 4: Programs (Use Cases)

### Task 4.1: Create all auth programs

**Files:**
- Create: `apps/website/src/domain/auth/auth.programs.ts`

- [ ] **Step 1: Create `auth.programs.ts`**

```typescript
import { Effect, pipe } from "effect"
import { Schema } from "@effect/schema"
import { IAuthRepository } from "./auth.repository"
import { SignUpSchema, LoginSchema, ForgotPasswordSchema, ResetPasswordSchema, OtpVerificationSchema } from "./auth.schemas"
import { toAuthDto } from "./auth.dto"
import type { TAuthDto } from "./auth.dto"
import { ValidationError } from "@/shared/errors/application.errors"
import {
  InvalidCredentialsError,
  EmailAlreadyRegisteredError,
  EmailNotVerifiedError,
  SessionExpiredError,
  AuthProviderError,
  UserNotFoundError,
} from "./auth.errors"

export type AuthProgramError =
  | InvalidCredentialsError
  | EmailAlreadyRegisteredError
  | EmailNotVerifiedError
  | SessionExpiredError
  | AuthProviderError
  | UserNotFoundError
  | ValidationError

// ── Sign Up ─────────────────────────────────────────────────────────────
export const signUpProgram = (body: unknown): Effect.Effect<
  TAuthDto,
  AuthProgramError,
  IAuthRepository
> =>
  pipe(
    Schema.decodeUnknown(SignUpSchema)(body),
    Effect.mapError((e) => new ValidationError({ issues: e.message })),
    Effect.flatMap(({ email, password }) =>
      pipe(
        IAuthRepository,
        Effect.flatMap((repo) => repo.signUp(email, password)),
        Effect.map(toAuthDto),
      ),
    ),
  )

// ── Sign In ─────────────────────────────────────────────────────────────
export const signInProgram = (body: unknown): Effect.Effect<
  TAuthDto,
  AuthProgramError,
  IAuthRepository
> =>
  pipe(
    Schema.decodeUnknown(LoginSchema)(body),
    Effect.mapError((e) => new ValidationError({ issues: e.message })),
    Effect.flatMap(({ email, password }) =>
      pipe(
        IAuthRepository,
        Effect.flatMap((repo) => repo.signIn(email, password)),
        Effect.map(toAuthDto),
      ),
    ),
  )

// ── Sign Out ─────────────────────────────────────────────────────────────
export const signOutProgram = (): Effect.Effect<
  void,
  AuthProviderError,
  IAuthRepository
> =>
  pipe(
    IAuthRepository,
    Effect.flatMap((repo) => repo.signOut()),
  )

// ── Get Session ─────────────────────────────────────────────────────────
export const getSessionProgram = (): Effect.Effect<
  TAuthDto | null,
  AuthProviderError,
  IAuthRepository
> =>
  pipe(
    IAuthRepository,
    Effect.flatMap((repo) => repo.getSession()),
    Effect.map((result) => (result ? toAuthDto(result) : null)),
  )

// ── Verify OTP ──────────────────────────────────────────────────────────
export const verifyOtpProgram = (body: unknown): Effect.Effect<
  TAuthDto,
  AuthProgramError,
  IAuthRepository
> =>
  pipe(
    Schema.decodeUnknown(OtpVerificationSchema)(body),
    Effect.mapError((e) => new ValidationError({ issues: e.message })),
    Effect.flatMap(({ email, token, type }) =>
      pipe(
        IAuthRepository,
        Effect.flatMap((repo) => repo.verifyOtp(email, token, type)),
        Effect.map(toAuthDto),
      ),
    ),
  )

// ── Forgot Password ─────────────────────────────────────────────────────
export const forgotPasswordProgram = (body: unknown): Effect.Effect<
  void,
  AuthProgramError,
  IAuthRepository
> =>
  pipe(
    Schema.decodeUnknown(ForgotPasswordSchema)(body),
    Effect.mapError((e) => new ValidationError({ issues: e.message })),
    Effect.flatMap(({ email }) =>
      pipe(
        IAuthRepository,
        Effect.flatMap((repo) => repo.sendPasswordResetEmail(email)),
      ),
    ),
  )

// ── Reset Password ──────────────────────────────────────────────────────
export const resetPasswordProgram = (body: unknown): Effect.Effect<
  void,
  AuthProgramError,
  IAuthRepository
> =>
  pipe(
    Schema.decodeUnknown(ResetPasswordSchema)(body),
    Effect.mapError((e) => new ValidationError({ issues: e.message })),
    Effect.flatMap(({ password }) =>
      pipe(
        IAuthRepository,
        Effect.flatMap((repo) => repo.updatePassword(password)),
      ),
    ),
  )

// ── OAuth Sign In ───────────────────────────────────────────────────────
export const oauthSignInProgram = (
  provider: "google" | "github",
  redirectTo: string,
): Effect.Effect<
  { readonly url: string },
  AuthProviderError,
  IAuthRepository
> =>
  pipe(
    IAuthRepository,
    Effect.flatMap((repo) => repo.signInWithOAuth(provider, redirectTo)),
  )
```

- [ ] **Step 2: Create shared application errors if they don"t exist yet**

**Files:**
- Create: `apps/website/src/shared/errors/application.errors.ts`

```typescript
import { Data } from "effect"

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly issues: string
}>() {}
```

- [ ] **Step 3: Verify typecheck**

Run: `cd apps/website && npx tsc --noEmit --strict`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/domain/auth/auth.programs.ts apps/website/src/shared/errors/
git commit -m "feat(auth): add all auth use case programs"
```

---

## Phase 5: API Routes

### Task 5.1: Create api helpers

**Files:**
- Create: `apps/website/src/lib/api-helpers.ts`

- [ ] **Step 1: Create `lib/api-helpers.ts`**

```typescript
import type { APIRoute, APIContext } from "astro"
import { Effect, Layer } from "effect"
import type { TApiMeta, TApiResponse } from "@/shared/types/common.types"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { IAuthRepository, makeSupabaseAuthRepository } from "@/domain/auth/index"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const makeMeta = (): TApiMeta => ({
  requestId: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
})

export const jsonOk = <T>(data: T, meta: TApiMeta, status = 200): Response =>
  Response.json({ success: true, data, meta } as TApiResponse<T>, { status })

export const jsonError = (error: { _tag: string; message: string }, meta: TApiMeta, status: number): Response =>
  Response.json({ success: false, error, meta } as TApiResponse<never>, { status })

export const runAuthEffect = <A>(
  context: APIContext,
  effect: Effect.Effect<A, { _tag: string; message: string }, IAuthRepository>,
): Promise<A> => {
  const supabase = createSupabaseServerClient(context)
  const supabaseRepo = makeSupabaseAuthRepository(supabase)
  return Effect.runPromise(
    effect.pipe(Effect.provide(Layer.succeed(IAuthRepository, supabaseRepo))),
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/lib/api-helpers.ts
git commit -m "feat(auth): add API helper utilities for Effect execution"
```

---

### Task 5.2: Create all auth API routes

**Files:**
- Create: `apps/website/src/pages/api/auth/signup.ts`
- Create: `apps/website/src/pages/api/auth/login.ts`
- Create: `apps/website/src/pages/api/auth/logout.ts`
- Create: `apps/website/src/pages/api/auth/session.ts`
- Create: `apps/website/src/pages/api/auth/verify.ts`
- Create: `apps/website/src/pages/api/auth/forgot-password.ts`
- Create: `apps/website/src/pages/api/auth/reset-password.ts`
- Create: `apps/website/src/pages/api/auth/2fa.ts`

- [ ] **Step 1: Create `signup.ts`**

```typescript
import type { APIRoute } from "astro"
import { Effect } from "effect"
import { signUpProgram } from "@/domain/auth/auth.programs"
import { makeMeta, jsonOk, jsonError, runAuthEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { InvalidCredentialsError, EmailAlreadyRegisteredError, AuthProviderError } from "@/domain/auth/index"

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: () => new ValidationError({ issues: "Invalid JSON body" }),
    }),
    Effect.flatMap(signUpProgram),
    Effect.map((data) => jsonOk(data, meta, HTTP_STATUS.CREATED)),
    Effect.catchTags({
      ValidationError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.issues }, meta, HTTP_STATUS.BAD_REQUEST)),
      EmailAlreadyRegisteredError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: `Email "${e.email}" sudah terdaftar` }, meta, HTTP_STATUS.CONFLICT)),
      AuthProviderError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.BAD_REQUEST)),
    }),
  )

  const result = await runAuthEffect(context, program)
  return result
}
```

- [ ] **Step 2: Create `login.ts`**

```typescript
import type { APIRoute } from "astro"
import { Effect, pipe } from "effect"
import { signInProgram } from "@/domain/auth/auth.programs"
import { makeMeta, jsonOk, jsonError, runAuthEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { ValidationError } from "@/shared/errors/application.errors"
import { InvalidCredentialsError, EmailNotVerifiedError, AuthProviderError } from "@/domain/auth/index"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: () => new ValidationError({ issues: "Invalid JSON body" }),
    }),
    Effect.flatMap(signInProgram),
    Effect.map((data) => jsonOk(data, meta, HTTP_STATUS.OK)),
    Effect.catchTags({
      ValidationError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.issues }, meta, HTTP_STATUS.BAD_REQUEST)),
      InvalidCredentialsError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
      EmailNotVerifiedError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: "Email belum diverifikasi. Cek inbox kamu." }, meta, HTTP_STATUS.FORBIDDEN)),
      AuthProviderError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.BAD_REQUEST)),
    }),
  )

  const result = await runAuthEffect(context, program)
  return result
}
```

- [ ] **Step 3: Create `logout.ts`**

```typescript
import type { APIRoute } from "astro"
import { Effect, pipe } from "effect"
import { signOutProgram } from "@/domain/auth/auth.programs"
import { makeMeta, jsonOk, jsonError, runAuthEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { AuthProviderError } from "@/domain/auth/index"

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    signOutProgram(),
    Effect.map(() => jsonOk(null, meta, HTTP_STATUS.OK)),
    Effect.catchTags({
      AuthProviderError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  const result = await runAuthEffect(context, program)
  return result
}
```

- [ ] **Step 4: Create `session.ts`**

```typescript
import type { APIRoute } from "astro"
import { Effect, pipe } from "effect"
import { getSessionProgram } from "@/domain/auth/auth.programs"
import { makeMeta, jsonOk, jsonError, runAuthEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { AuthProviderError } from "@/domain/auth/index"

export const GET: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    getSessionProgram(),
    Effect.map((session) => jsonOk(session, meta, HTTP_STATUS.OK)),
    Effect.catchTags({
      AuthProviderError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  const result = await runAuthEffect(context, program)
  return result
}
```

- [ ] **Step 5: Create `verify.ts`**

```typescript
import type { APIRoute } from "astro"
import { Effect, pipe } from "effect"
import { verifyOtpProgram } from "@/domain/auth/auth.programs"
import { makeMeta, jsonOk, jsonError, runAuthEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { ValidationError } from "@/shared/errors/application.errors"
import { AuthProviderError, UserNotFoundError } from "@/domain/auth/index"

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: () => new ValidationError({ issues: "Invalid JSON body" }),
    }),
    Effect.flatMap(verifyOtpProgram),
    Effect.map((data) => jsonOk(data, meta, HTTP_STATUS.OK)),
    Effect.catchTags({
      ValidationError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.issues }, meta, HTTP_STATUS.BAD_REQUEST)),
      UserNotFoundError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: "User tidak ditemukan" }, meta, HTTP_STATUS.NOT_FOUND)),
      AuthProviderError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.BAD_REQUEST)),
    }),
  )

  const result = await runAuthEffect(context, program)
  return result
}
```

- [ ] **Step 6: Create `forgot-password.ts`**

```typescript
import type { APIRoute } from "astro"
import { Effect, pipe } from "effect"
import { forgotPasswordProgram } from "@/domain/auth/auth.programs"
import { makeMeta, jsonOk, jsonError, runAuthEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { ValidationError } from "@/shared/errors/application.errors"
import { AuthProviderError, UserNotFoundError } from "@/domain/auth/index"

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: () => new ValidationError({ issues: "Invalid JSON body" }),
    }),
    Effect.flatMap(forgotPasswordProgram),
    Effect.map(() => jsonOk(null, meta, HTTP_STATUS.OK)),
    Effect.catchTags({
      ValidationError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.issues }, meta, HTTP_STATUS.BAD_REQUEST)),
      UserNotFoundError: () => Effect.succeed(jsonOk(null, meta, HTTP_STATUS.OK)), // Always return OK to prevent email enumeration
      AuthProviderError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.BAD_REQUEST)),
    }),
  )

  const result = await runAuthEffect(context, program)
  return result
}
```

- [ ] **Step 7: Create `reset-password.ts`**

```typescript
import type { APIRoute } from "astro"
import { Effect, pipe } from "effect"
import { resetPasswordProgram } from "@/domain/auth/auth.programs"
import { makeMeta, jsonOk, jsonError, runAuthEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { ValidationError } from "@/shared/errors/application.errors"
import { AuthProviderError, SessionExpiredError } from "@/domain/auth/index"

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: () => new ValidationError({ issues: "Invalid JSON body" }),
    }),
    Effect.flatMap(resetPasswordProgram),
    Effect.map(() => jsonOk(null, meta, HTTP_STATUS.OK)),
    Effect.catchTags({
      ValidationError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.issues }, meta, HTTP_STATUS.BAD_REQUEST)),
      SessionExpiredError: () => Effect.succeed(jsonError({ _tag: "SessionExpiredError", message: "Sesi reset password telah kedaluwarsa. Silakan minta tautan baru." }, meta, HTTP_STATUS.UNAUTHORIZED)),
      AuthProviderError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.BAD_REQUEST)),
    }),
  )

  const result = await runAuthEffect(context, program)
  return result
}
```

- [ ] **Step 8: Create `2fa.ts`**

```typescript
import type { APIRoute } from "astro"
import { Effect, pipe } from "effect"
import { verifyOtpProgram } from "@/domain/auth/auth.programs"
import { makeMeta, jsonOk, jsonError, runAuthEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { ValidationError } from "@/shared/errors/application.errors"
import { AuthProviderError, UserNotFoundError } from "@/domain/auth/index"

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: () => new ValidationError({ issues: "Invalid JSON body" }),
    }),
    Effect.flatMap(verifyOtpProgram),
    Effect.map((data) => jsonOk(data, meta, HTTP_STATUS.OK)),
    Effect.catchTags({
      ValidationError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.issues }, meta, HTTP_STATUS.BAD_REQUEST)),
      UserNotFoundError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: "Kode tidak valid" }, meta, HTTP_STATUS.NOT_FOUND)),
      AuthProviderError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.BAD_REQUEST)),
    }),
  )

  const result = await runAuthEffect(context, program)
  return result
}
```

- [ ] **Step 9: Typecheck and commit**

Run: `cd apps/website && npx tsc --noEmit`

```bash
git add apps/website/src/pages/api/auth/
git commit -m "feat(auth): add all auth API route handlers"
```

---

## Phase 6: Astro Middleware

### Task 6.1: Auth middleware

**Files:**
- Create: `apps/website/src/middleware/auth.ts`
- Create: `apps/website/src/middleware/index.ts`
- Modify: `apps/website/astro.config.mjs` (enable middleware)

- [ ] **Step 1: Create `middleware/auth.ts`**

```typescript
import { defineMiddleware } from "astro/middleware"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ROUTES } from "@/shared/constants/api.constants"

const PROTECTED_PATHS = ROUTES.PROTECTED
const GUEST_ONLY_PATHS = ROUTES.GUEST_ONLY

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url)
  const pathname = url.pathname

  // Skip middleware for static assets and API routes
  if (pathname.startsWith("/_astro") || pathname.startsWith("/api/") || pathname === "/") {
    return next()
  }

  // Create Supabase SSR client
  const supabase = createSupabaseServerClient(context)

  // Get current session
  const { data: { session }, error } = await supabase.auth.getSession()

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p))
  const isGuestOnly = GUEST_ONLY_PATHS.some((p) => pathname.startsWith(p))

  // Protected route: redirect to login if no session
  if (isProtected && !session) {
    return context.redirect(ROUTES.PAGE.LOGIN)
  }

  // Guest-only route: redirect to dashboard if already logged in
  if (isGuestOnly && session) {
    return context.redirect(ROUTES.PAGE.DASHBOARD)
  }

  // Inject session into locals for page access
  context.locals.session = session
    ? {
        userId: session.user.id,
        email: session.user.email ?? "",
        sessionId: session.access_token,
      }
    : null

  return next()
})
```

- [ ] **Step 2: Create `middleware/index.ts`**

```typescript
export { onRequest } from "./auth"
```

- [ ] **Step 3: Update `src/env.d.ts` to type the locals**

```typescript
/// <reference types="astro/client" />
/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    session: {
      userId: string
      email: string
      sessionId: string
    } | null
  }
}
```

- [ ] **Step 4: Enable middleware in `astro.config.mjs`**

The middleware directory `src/middleware/` with `index.ts` exporting `onRequest` is automatically picked up by Astro. Verify by checking if Astro detects it during dev/build.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/middleware/ apps/website/src/env.d.ts
git commit -m "feat(auth): add auth middleware for route protection and session injection"
```

---

## Phase 7: Frontend Integration (React Blocks)

### Task 7.1: Update Login block

**Files:**
- Modify: `apps/website/blocks/login/one/index.tsx`

- [ ] **Step 1: Update `login/one/index.tsx`**

Add `"use client"`, form state management, and API call:

```typescript
"use client"

import { useState, useCallback } from "react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@treonstudio/bungas-core/ui/label"
import { ROUTES } from "@/shared/constants/api.constants.ts"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(ROUTES.API.AUTH.LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const result = await res.json()

      if (!result.success) {
        setError(result.error.message)
        return
      }

      window.location.href = ROUTES.PAGE.DASHBOARD
    } catch {
      setError("Gagal menghubungi server. Coba lagi.")
    } finally {
      setIsLoading(false)
    }
  }, [email, password])

  // ... rest of JSX, wrap form onSubmit with handleSubmit
  return (
    <section className="bg-background flex grid min-h-screen grid-rows-[auto_1fr] px-4">
      {/* ... existing layout ... */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ... existing form fields with controlled state ... */}
        {error && <div className="text-sm text-red-500">{error}</div>}
        <Button className="w-full" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/blocks/login/one/index.tsx
git commit -m "feat(auth): wire login block to API"
```

---

### Task 7.2: Update Sign-Up block

**Files:**
- Modify: `apps/website/blocks/sign-up/one/index.tsx`

- [ ] **Step 1: Update `sign-up/one/index.tsx`**

Similar pattern as login:

```typescript
"use client"

import { useState, useCallback } from "react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@treonstudio/bungas-core/ui/label"
import { ROUTES } from "@/shared/constants/api.constants.ts"

export default function SignUp() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(ROUTES.API.AUTH.SIGNUP, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const result = await res.json()

      if (!result.success) {
        setError(result.error.message)
        return
      }

      setSuccess(true)
    } catch {
      setError("Gagal menghubungi server. Coba lagi.")
    } finally {
      setIsLoading(false)
    }
  }, [email, password])

  if (success) {
    return (
      <section className="bg-background flex grid min-h-screen grid-rows-[auto_1fr] px-4">
        <div className="m-auto w-full max-w-sm text-center">
          <h1 className="font-serif text-4xl font-medium">Check your email</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Kami telah mengirim tautan verifikasi ke <strong>{email}</strong>
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-background flex grid min-h-screen grid-rows-[auto_1fr] px-4">
      {/* ... existing JSX with controlled inputs + error display ... */}
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/blocks/sign-up/one/index.tsx
git commit -m "feat(auth): wire sign-up block to API"
```

---

### Task 7.3: Update Forgot Password block

**Files:**
- Modify: `apps/website/blocks/forgot-password/one/index.tsx`

- [ ] **Step 1: Update `forgot-password/one/index.tsx`**

```typescript
"use client"

import { useState, useCallback } from "react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@treonstudio/bungas-core/ui/label"
import { ROUTES } from "@/shared/constants/api.constants.ts"

export default function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await fetch(ROUTES.API.AUTH.FORGOT_PASSWORD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
    } finally {
      setIsLoading(false)
      setSent(true) // Always show success to prevent email enumeration
    }
  }, [email])

  if (sent) {
    return (
      <section className="bg-background flex grid min-h-screen grid-rows-[auto_1fr] px-4">
        <div className="m-auto w-full max-w-sm text-center">
          <h1 className="font-serif text-4xl font-medium">Check your email</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Jika email terdaftar, kami telah mengirim tautan reset password.
          </p>
          <a href="/login" className="text-primary mt-4 inline-block font-medium hover:underline">
            Back to Login
          </a>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-background flex grid min-h-screen grid-rows-[auto_1fr] px-4">
      {/* ... existing JSX with controlled email input ... */}
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/blocks/forgot-password/one/index.tsx
git commit -m "feat(auth): wire forgot-password block to API"
```

---

### Task 7.4: Update Reset Password block

**Files:**
- Modify: `apps/website/blocks/reset-password/index.tsx`

- [ ] **Step 1: Update `reset-password/index.tsx`**

Replace the mock setTimeout with a real API call:

```typescript
"use client"
import React, { useState, useEffect } from "react"
import { ROUTES } from "@/shared/constants/api.constants.ts"

export default function ResetPassword() {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [tokenHash, setTokenHash] = useState("")

  useEffect(() => {
    // Extract token from URL query params (set by Supabase redirect)
    const params = new URLSearchParams(window.location.search)
    setTokenHash(params.get("token_hash") ?? params.get("code") ?? "")
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(ROUTES.API.AUTH.RESET_PASSWORD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, tokenHash }),
      })
      const result = await res.json()

      if (!result.success) {
        setError(result.error.message)
        return
      }

      setSubmitted(true)
    } catch {
      setError("Gagal menghubungi server")
    } finally {
      setIsLoading(false)
    }
  }

  // ... rest of JSX (mostly existing, with error display)
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/blocks/reset-password/index.tsx
git commit -m "feat(auth): wire reset-password block to API"
```

---

### Task 7.5: Update Verify Email block

**Files:**
- Modify: `apps/website/blocks/verify/index.tsx`

- [ ] **Step 1: Update `verify/index.tsx`**

Replace mock setTimeout with real API call:

```typescript
"use client"
import React, { useState, useEffect } from "react"
import { ROUTES } from "@/shared/constants/api.constants.ts"

export default function VerifyEmail() {
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying")
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const email = params.get("email") ?? ""
    const token = params.get("token") ?? params.get("token_hash") ?? ""

    if (!email || !token) {
      setStatus("error")
      setErrorMsg("Link verifikasi tidak valid.")
      return
    }

    const verify = async () => {
      try {
        const res = await fetch(ROUTES.API.AUTH.VERIFY, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token, type: "signup" }),
        })
        const result = await res.json()

        if (result.success) {
          setStatus("success")
        } else {
          setStatus("error")
          setErrorMsg(result.error.message)
        }
      } catch {
        setStatus("error")
        setErrorMsg("Gagal memverifikasi email. Coba lagi.")
      }
    }

    verify()
  }, [])

  // ... rest JSX (existing styles, success/error states)
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/blocks/verify/index.tsx
git commit -m "feat(auth): wire verify-email block to API"
```

---

### Task 7.6: Update Two-Factor block

**Files:**
- Modify: `apps/website/blocks/auth/two-factor.tsx`

- [ ] **Step 1: Update `auth/two-factor.tsx`**

Replace mock setTimeout with real API call:

```typescript
"use client"
import React, { useState, useCallback, useEffect } from "react"
import { ROUTES } from "@/shared/constants/api.constants.ts"

export default function TwoFactorScreen() {
  const [email, setEmail] = useState("")
  const [token, setToken] = useState("")
  const [backupCode, setBackupCode] = useState("")
  const [useBackup, setUseBackup] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setEmail(params.get("email") ?? "")
  }, [])

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")

    const code = useBackup ? backupCode : token
    if (code.length < (useBackup ? 8 : 6)) {
      setErrorMsg(`Masukkan kode ${useBackup ? "8" : "6"} digit`)
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch(ROUTES.API.AUTH.TWO_FACTOR, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: code, type: "2fa" }),
      })
      const result = await res.json()

      if (result.success) {
        window.location.href = ROUTES.PAGE.DASHBOARD
      } else {
        setErrorMsg(result.error.message)
      }
    } catch {
      setErrorMsg("Gagal menghubungi server")
    } finally {
      setIsLoading(false)
    }
  }, [email, token, backupCode, useBackup])

  // ... rest JSX (existing OTP input UI)
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/blocks/auth/two-factor.tsx
git commit -m "feat(auth): wire 2FA block to API"
```

---

## Phase 8: Verification & Build

### Task 8.1: Build verification

- [ ] **Step 1: Run typecheck**

Run: `cd apps/website && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 2: Run lint**

Run: `cd apps/website && pnpm lint`
Expected: No lint errors

- [ ] **Step 3: Run build**

Run: `cd apps/website && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Start dev server and smoke test**

Run: `pnpm dev`
Visit each auth page:
- `/login` → form submits correctly
- `/sign-up` → form submits and redirects to verify screen
- `/forgot-password` → form submits and shows success
- `/api/auth/session` → returns proper session response

- [ ] **Step 5: Commit final verification**

```bash
git add .
git commit -m "chore(auth): final verification and cleanup"
```
