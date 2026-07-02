import { Effect } from "effect"
import { IAuthRepository } from "./auth.repository"
import type { TAuthResult } from "./auth.types"
import type { TUserId, TSessionId } from "@/shared/types/common.types"
import {
  InvalidCredentialsError,
  EmailAlreadyRegisteredError,
  AuthProviderError,
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
