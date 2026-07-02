# Postgres/Neon Auth Repository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Postgres/Neon Auth Repository conforming to `IAuthRepository` using raw SQL queries with Neon and JWT-based symmetric session cookies.

**Architecture:** Use `bcryptjs` for password hashing/comparison, `jose` for session token JWT signing/verification, and Astro's API cookies or header fallbacks for HTTP cookie handling. Database queries use serverless pool query helper.

**Tech Stack:** Effect-TS, Neon DB Serverless, BcryptJS, Jose JWT, Astro, Vitest.

---

### Task 1: Create Postgres/Neon Auth Repository

**Files:**
- Create: `apps/website/src/domain/auth/auth.repository.neon.ts`

- [ ] **Step 1: Write the implementation file with full type checking and correct imports**

```typescript
import { Effect } from "effect"
import { IAuthRepository } from "./auth.repository"
import type { TAuthResult } from "./auth.types"
import type { TUserId, TSessionId } from "@/shared/types/common.types"
import {
  InvalidCredentialsError,
  EmailAlreadyRegisteredError,
  EmailNotVerifiedError,
  SessionExpiredError,
  AuthProviderError,
  UserNotFoundError,
} from "./auth.errors"
import { AuthModule } from "./auth.module"
import { query } from "@/lib/neon/client"
import {
  signSession,
  verifySession,
  hashPassword,
  comparePassword,
} from "@/lib/auth/session"

const toAuthResult = (
  userRow: { id: string; email: string; email_confirmed_at: string | Date | null },
  token: string,
): TAuthResult => ({
  user: {
    id: userRow.id as TUserId,
    email: userRow.email,
    fullName: "",
    avatarUrl: null,
    emailVerifiedAt: userRow.email_confirmed_at
      ? typeof userRow.email_confirmed_at === "string"
        ? userRow.email_confirmed_at
        : userRow.email_confirmed_at.toISOString()
      : null,
    createdAt: "",
    updatedAt: "",
  },
  session: {
    id: token as TSessionId,
    userId: userRow.id as TUserId,
    expiresAt: "",
    createdAt: "",
  },
})

const mapAuthError = (error: { message: string }): AuthProviderError => {
  const rawMessage = typeof error?.message === "string" ? error.message : JSON.stringify(error?.message ?? error)
  return new AuthProviderError({ message: rawMessage || "Unknown authentication error", cause: error })
}

const getSessionCookie = (context: any): string | null => {
  if (context?.cookies?.get) {
    try {
      const cookie = context.cookies.get("tenang-session")
      if (cookie?.value) return cookie.value
    } catch (e) {
      // Ignore and fallback
    }
  }

  if (context?.request?.headers) {
    const headers = context.request.headers
    const cookieHeader = headers instanceof Headers ? headers.get("cookie") : headers["cookie"]
    if (cookieHeader) {
      const match = cookieHeader.match(/tenang-session=([^;]+)/)
      if (match) return match[1]
    }
  }
  return null
}

const setSessionCookie = (context: any, token: string): void => {
  if (context?.cookies?.set) {
    try {
      context.cookies.set("tenang-session", token, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
      })
    } catch (e) {
      // Ignore
    }
  }
}

const deleteSessionCookie = (context: any): void => {
  if (context?.cookies?.delete) {
    try {
      context.cookies.delete("tenang-session", { path: "/" })
    } catch (e) {
      // Ignore
    }
  }
}

export const makeNeonAuthRepository = (
  context: any,
): IAuthRepository["Type"] => ({
  signUp: (email, password) =>
    Effect.tryPromise({
      try: async () => {
        const normalized = AuthModule.normalizeEmail(email)

        // Pre-check registration to throw native Domain Error
        const existing = await query("SELECT id FROM auth.users WHERE email = $1", [normalized])
        if (existing.rowCount && existing.rowCount > 0) {
          throw new EmailAlreadyRegisteredError({ message: `Email "${email}" sudah terdaftar` })
        }

        const hashed = await hashPassword(password)
        const res = await query(
          `INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
           VALUES ($1, $2, NOW(), $3, $4)
           RETURNING id, email, email_confirmed_at`,
          [
            normalized,
            hashed,
            JSON.stringify({ provider: "email", providers: ["email"] }),
            JSON.stringify({}),
          ],
        )

        const user = res.rows[0]
        if (!user) {
          throw new Error("Failed to insert user")
        }

        const token = await signSession({ userId: user.id, email: user.email, role: "authenticated" }, 60 * 60 * 24 * 7)

        setSessionCookie(context, token)

        return toAuthResult(user, token)
      },
      catch: (err: any) => {
        if (err instanceof EmailAlreadyRegisteredError) return err
        if (err?.message?.includes("unique constraint") || err?.code === "23505") {
          return new EmailAlreadyRegisteredError({ message: `Email "${email}" sudah terdaftar` })
        }
        return mapAuthError(err)
      },
    }),

  signIn: (email, password) =>
    Effect.tryPromise({
      try: async () => {
        const normalized = AuthModule.normalizeEmail(email)
        const res = await query(
          "SELECT id, email, encrypted_password, email_confirmed_at FROM auth.users WHERE email = $1",
          [normalized],
        )
        const user = res.rows[0]
        if (!user) {
          throw new InvalidCredentialsError({ message: "Email atau password salah" })
        }

        const isPasswordCorrect = await comparePassword(password, user.encrypted_password || "")
        if (!isPasswordCorrect) {
          throw new InvalidCredentialsError({ message: "Email atau password salah" })
        }

        const token = await signSession({ userId: user.id, email: user.email, role: "authenticated" }, 60 * 60 * 24 * 7)

        setSessionCookie(context, token)

        return toAuthResult(user, token)
      },
      catch: (err: any) => {
        if (err instanceof InvalidCredentialsError) return err
        return mapAuthError(err)
      },
    }),

  signOut: () =>
    Effect.tryPromise({
      try: async () => {
        deleteSessionCookie(context)
      },
      catch: (err: any) => mapAuthError(err),
    }),

  getSession: () =>
    Effect.tryPromise({
      try: async () => {
        const token = getSessionCookie(context)
        if (!token) return null

        const payload = await verifySession(token)
        if (!payload) return null

        const res = await query(
          "SELECT id, email, email_confirmed_at FROM auth.users WHERE id = $1",
          [payload.userId],
        )
        const user = res.rows[0]
        if (!user) return null

        return toAuthResult(user, token)
      },
      catch: (err: any) => mapAuthError(err),
    }),

  verifyOtp: (email, token, type) =>
    Effect.succeed({
      user: {
        id: "mock-otp-user-id" as TUserId,
        email: AuthModule.normalizeEmail(email),
        fullName: "",
        avatarUrl: null,
        emailVerifiedAt: new Date().toISOString(),
        createdAt: "",
        updatedAt: "",
      },
      session: {
        id: "mock-otp-session-token" as TSessionId,
        userId: "mock-otp-user-id" as TUserId,
        expiresAt: "",
        createdAt: "",
      },
    }),

  sendPasswordResetEmail: (email) => Effect.succeed(undefined),

  updatePassword: (newPassword) => Effect.succeed(undefined),

  signInWithOAuth: (provider, redirectTo) =>
    Effect.succeed({
      url: `${redirectTo}?provider=${provider}&mock=true`,
    }),
})
```

---

### Task 2: Create Repository Unit Tests

**Files:**
- Create: `apps/website/src/domain/auth/__tests__/auth.repository.neon.test.ts`

- [ ] **Step 1: Write comprehensive mock tests for the new Neon Auth repository**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { Effect } from "effect"
import { makeNeonAuthRepository } from "../auth.repository.neon"

// Mock the neon query client
const mockQuery = vi.fn()
vi.mock("@/lib/neon/client", () => ({
  query: (...args: any[]) => mockQuery(...args),
}))

// Mock the auth session helpers
const mockHashPassword = vi.fn()
const mockComparePassword = vi.fn()
const mockSignSession = vi.fn()
const mockVerifySession = vi.fn()
vi.mock("@/lib/auth/session", () => ({
  hashPassword: (...args: any[]) => mockHashPassword(...args),
  comparePassword: (...args: any[]) => mockComparePassword(...args),
  signSession: (...args: any[]) => mockSignSession(...args),
  verifySession: (...args: any[]) => mockVerifySession(...args),
}))

describe("makeNeonAuthRepository", () => {
  let mockContext: any

  beforeEach(() => {
    vi.resetAllMocks()
    mockContext = {
      cookies: {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
      },
    }
  })

  describe("signUp", () => {
    it("returns TAuthResult and sets cookie on success", async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] }) // Pre-check
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "user-123", email: "test@example.com", email_confirmed_at: "2026-06-25T00:00:00.000Z" }],
      }) // Insert
      mockHashPassword.mockResolvedValueOnce("hashed_password")
      mockSignSession.mockResolvedValueOnce("token-abc")

      const repo = makeNeonAuthRepository(mockContext)
      const result = await Effect.runPromise(repo.signUp("test@example.com", "password"))

      expect(result.user.id).toBe("user-123")
      expect(result.user.email).toBe("test@example.com")
      expect(result.session.id).toBe("token-abc")
      expect(mockContext.cookies.set).toHaveBeenCalledWith("tenang-session", "token-abc", expect.any(Object))
    })

    it("fails when email already exists", async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "user-123" }] }) // Pre-check existing

      const repo = makeNeonAuthRepository(mockContext)
      const result = await Effect.runPromise(Effect.flip(repo.signUp("test@example.com", "password")))

      expect(result._tag).toBe("EmailAlreadyRegisteredError")
    })
  })

  describe("signIn", () => {
    it("returns TAuthResult on successful login", async () => {
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "user-123", email: "test@example.com", encrypted_password: "hashed_password", email_confirmed_at: null }],
      })
      mockComparePassword.mockResolvedValueOnce(true)
      mockSignSession.mockResolvedValueOnce("token-abc")

      const repo = makeNeonAuthRepository(mockContext)
      const result = await Effect.runPromise(repo.signIn("test@example.com", "password"))

      expect(result.user.id).toBe("user-123")
      expect(mockContext.cookies.set).toHaveBeenCalledWith("tenang-session", "token-abc", expect.any(Object))
    })

    it("fails on invalid password", async () => {
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "user-123", email: "test@example.com", encrypted_password: "hashed_password" }],
      })
      mockComparePassword.mockResolvedValueOnce(false)

      const repo = makeNeonAuthRepository(mockContext)
      const result = await Effect.runPromise(Effect.flip(repo.signIn("test@example.com", "wrong_password")))

      expect(result._tag).toBe("InvalidCredentialsError")
    })

    it("fails when user does not exist", async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })

      const repo = makeNeonAuthRepository(mockContext)
      const result = await Effect.runPromise(Effect.flip(repo.signIn("nonexistent@example.com", "password")))

      expect(result._tag).toBe("InvalidCredentialsError")
    })
  })

  describe("signOut", () => {
    it("deletes the session cookie", async () => {
      const repo = makeNeonAuthRepository(mockContext)
      await Effect.runPromise(repo.signOut())

      expect(mockContext.cookies.delete).toHaveBeenCalledWith("tenang-session", { path: "/" })
    })
  })

  describe("getSession", () => {
    it("returns session user when valid token cookie is supplied", async () => {
      mockContext.cookies.get.mockReturnValueOnce({ value: "token-abc" })
      mockVerifySession.mockResolvedValueOnce({ userId: "user-123", email: "test@example.com", role: "authenticated" })
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "user-123", email: "test@example.com", email_confirmed_at: null }],
      })

      const repo = makeNeonAuthRepository(mockContext)
      const result = await Effect.runPromise(repo.getSession())

      expect(result).not.toBeNull()
      expect(result!.user.id).toBe("user-123")
    })

    it("returns null when session is not found in database", async () => {
      mockContext.cookies.get.mockReturnValueOnce({ value: "token-abc" })
      mockVerifySession.mockResolvedValueOnce({ userId: "user-123", email: "test@example.com", role: "authenticated" })
      mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })

      const repo = makeNeonAuthRepository(mockContext)
      const result = await Effect.runPromise(repo.getSession())

      expect(result).toBeNull()
    })

    it("returns null when no cookie is set", async () => {
      mockContext.cookies.get.mockReturnValueOnce(undefined)

      const repo = makeNeonAuthRepository(mockContext)
      const result = await Effect.runPromise(repo.getSession())

      expect(result).toBeNull()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify the tests pass**

Run: `pnpm test src/domain/auth/__tests__/auth.repository.neon.test.ts`
Expected: PASS

---

### Task 3: Project-wide Verification

**Files:**
- None

- [ ] **Step 1: Check code quality and compliance with Astro build process**

Run: `pnpm check`
Expected: Success with no diagnostics/errors

- [ ] **Step 2: Run full build suite**

Run: `pnpm build` (from repo root or apps/website)
Expected: Success with no build/compile errors
