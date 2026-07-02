import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { IAuthRepository } from "../auth.repository"
import { IInvitationsRepository } from "@/domain/invitations/index"
import {
  signUpProgram,
  signInProgram,
  signOutProgram,
  getSessionProgram,
  verifyOtpProgram,
  forgotPasswordProgram,
  resetPasswordProgram,
  oauthSignInProgram,
} from "../auth.programs"
import {
  InvalidCredentialsError,
  EmailAlreadyRegisteredError,
  EmailNotVerifiedError,
  SessionExpiredError,
  AuthProviderError,
  UserNotFoundError,
} from "../auth.errors"
import { ValidationError } from "@/shared/errors/application.errors"
import type { TAuthResult } from "../auth.types"

const mockAuthResult: TAuthResult = {
  user: {
    id: "user-1" as never,
    email: "user@example.com",
    fullName: "John",
    avatarUrl: null,
    emailVerifiedAt: "2024-01-01T00:00:00Z",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  session: {
    id: "session-1" as never,
    userId: "user-1" as never,
    expiresAt: "2024-12-31T00:00:00Z",
    createdAt: "2024-01-01T00:00:00Z",
  },
}

const mockRepo = {
  signUp: (_email: string, _password: string) => Effect.succeed(mockAuthResult),
  signIn: (_email: string, _password: string) => Effect.succeed(mockAuthResult),
  signOut: () => Effect.void,
  getSession: () => Effect.succeed(mockAuthResult),
  verifyOtp: (_email: string, _token: string, _type: "signup" | "recovery" | "2fa") => Effect.succeed(mockAuthResult),
  sendPasswordResetEmail: (_email: string) => Effect.void,
  updatePassword: (_newPassword: string) => Effect.void,
  signInWithOAuth: (_provider: "google" | "github", _redirectTo: string) => Effect.succeed({ url: "https://example.com/auth" }),
} satisfies IAuthRepository["Type"]

const mockInvitationsRepo = {
  createInvitation: () => Effect.fail(new Error("Not implemented") as any),
  getInvitations: () => Effect.succeed([]),
  verifyInvitation: () => Effect.succeed({ id: "invitation-123", companyId: "company-1", email: "user@example.com", role: "member", tokenHash: "hash", invitedBy: "admin", expiresAt: "2027", status: "pending", acceptedAt: null, createdAt: "now" } as any),
  acceptInvitation: () => Effect.succeed({ id: "invitation-123", status: "accepted" } as any),
  revokeInvitation: () => Effect.void,
} satisfies IInvitationsRepository["Type"]

const runWithRepo = (effect: any): Promise<any> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provideService(IAuthRepository, mockRepo),
      Effect.provideService(IInvitationsRepository, mockInvitationsRepo),
    )
  )

describe("signUpProgram", () => {
  it("validates and signs up", async () => {
    const result = await runWithRepo(signUpProgram({ email: "user@example.com", password: "password123" }))
    expect(result.user.email).toBe("user@example.com")
    expect(result.session.id).toBe("session-1")
  })

  it("rejects invalid email", async () => {
    const result = await Effect.runPromise(
      signUpProgram({ email: "invalid", password: "password123" }).pipe(
        Effect.provideService(IAuthRepository, mockRepo),
        Effect.provideService(IInvitationsRepository, mockInvitationsRepo),
        Effect.catchAll((e) => Effect.succeed(e)),
      ),
    )
    expect(result).toBeInstanceOf(ValidationError)
  })

  it("rejects short password", async () => {
    const result = await Effect.runPromise(
      signUpProgram({ email: "user@example.com", password: "12" }).pipe(
        Effect.provideService(IAuthRepository, mockRepo),
        Effect.provideService(IInvitationsRepository, mockInvitationsRepo),
        Effect.catchAll((e) => Effect.succeed(e)),
      ),
    )
    expect(result).toBeInstanceOf(ValidationError)
  })
})

describe("signInProgram", () => {
  it("validates and signs in", async () => {
    const result = await runWithRepo(signInProgram({ email: "user@example.com", password: "password123" }))
    expect(result.user.email).toBe("user@example.com")
    expect(result.session.id).toBe("session-1")
  })

  it("rejects invalid email", async () => {
    const result = await Effect.runPromise(
      signInProgram({ email: "", password: "password123" }).pipe(
        Effect.provideService(IAuthRepository, mockRepo),
        Effect.catchAll((e) => Effect.succeed(e)),
      ),
    )
    expect(result).toBeInstanceOf(ValidationError)
  })
})

describe("signOutProgram", () => {
  it("signs out", async () => {
    await runWithRepo(signOutProgram())
  })
})

describe("getSessionProgram", () => {
  it("returns session", async () => {
    const result = await runWithRepo(getSessionProgram())
    expect(result).not.toBeNull()
    expect(result!.user.id).toBe("user-1")
  })
})

describe("verifyOtpProgram", () => {
  it("succeeds with valid params", async () => {
    const result = await runWithRepo(verifyOtpProgram({ email: "user@example.com", token: "123456", type: "signup" }))
    expect(result.user.email).toBe("user@example.com")
  })

  it("rejects invalid type", async () => {
    const result = await Effect.runPromise(
      verifyOtpProgram({ email: "user@example.com", token: "123456", type: "invalid" as any }).pipe(
        Effect.provideService(IAuthRepository, mockRepo),
        Effect.catchAll((e) => Effect.succeed(e)),
      ),
    )
    expect(result).toBeInstanceOf(ValidationError)
  })
})

describe("forgotPasswordProgram", () => {
  it("succeeds with valid email", async () => {
    await runWithRepo(forgotPasswordProgram({ email: "user@example.com" }))
  })

  it("rejects invalid email", async () => {
    const result = await Effect.runPromise(
      forgotPasswordProgram({ email: "" }).pipe(
        Effect.provideService(IAuthRepository, mockRepo),
        Effect.catchAll((e) => Effect.succeed(e)),
      ),
    )
    expect(result).toBeInstanceOf(ValidationError)
  })
})

describe("resetPasswordProgram", () => {
  it("succeeds with valid password and tokenHash", async () => {
    await runWithRepo(resetPasswordProgram({ password: "newpass123", tokenHash: "tok_abc" }))
  })

  it("rejects short password", async () => {
    const result = await Effect.runPromise(
      resetPasswordProgram({ password: "12", tokenHash: "tok_abc" }).pipe(
        Effect.provideService(IAuthRepository, mockRepo),
        Effect.catchAll((e) => Effect.succeed(e)),
      ),
    )
    expect(result).toBeInstanceOf(ValidationError)
  })
})

describe("oauthSignInProgram", () => {
  it("succeeds with google", async () => {
    const result = await runWithRepo(oauthSignInProgram("google", "https://example.com/callback"))
    expect(result.url).toBe("https://example.com/auth")
  })

  it("succeeds with github", async () => {
    const result = await runWithRepo(oauthSignInProgram("github", "https://example.com/callback"))
    expect(result.url).toBeDefined()
  })
})

describe("program error propagation", () => {
  it("propagates EmailAlreadyRegisteredError from signUp", async () => {
    const failingRepo = { ...mockRepo, signUp: () => Effect.fail(new EmailAlreadyRegisteredError({ message: "Taken" })) }
    const result = await Effect.runPromise(
      signUpProgram({ email: "existing@example.com", password: "password123" }).pipe(
        Effect.provideService(IAuthRepository, failingRepo),
        Effect.provideService(IInvitationsRepository, mockInvitationsRepo),
        Effect.flip,
        Effect.map((e) => { expect(e._tag).toBe("EmailAlreadyRegisteredError"); return e }),
      ),
    )
  })

  it("propagates InvalidCredentialsError from signIn", async () => {
    const failingRepo = { ...mockRepo, signIn: () => Effect.fail(new InvalidCredentialsError({ message: "Bad" })) }
    const result = await Effect.runPromise(
      signInProgram({ email: "user@example.com", password: "password123" }).pipe(
        Effect.provideService(IAuthRepository, failingRepo),
        Effect.flip,
        Effect.map((e) => { expect(e._tag).toBe("InvalidCredentialsError"); return e }),
      ),
    )
  })

  it("propagates EmailNotVerifiedError from signIn", async () => {
    const failingRepo = { ...mockRepo, signIn: () => Effect.fail(new EmailNotVerifiedError({ message: "Not confirmed" })) }
    const result = await Effect.runPromise(
      signInProgram({ email: "user@example.com", password: "password123" }).pipe(
        Effect.provideService(IAuthRepository, failingRepo),
        Effect.flip,
        Effect.map((e) => { expect(e._tag).toBe("EmailNotVerifiedError"); return e }),
      ),
    )
  })

  it("propagates SessionExpiredError from resetPassword", async () => {
    const failingRepo = { ...mockRepo, updatePassword: () => Effect.fail(new SessionExpiredError({ message: "Expired" })) }
    const result = await Effect.runPromise(
      resetPasswordProgram({ password: "newpass123", tokenHash: "tok_abc" }).pipe(
        Effect.provideService(IAuthRepository, failingRepo),
        Effect.flip,
        Effect.map((e) => { expect(e._tag).toBe("SessionExpiredError"); return e }),
      ),
    )
  })

  it("propagates AuthProviderError from OAuth", async () => {
    const failingRepo = { ...mockRepo, signInWithOAuth: () => Effect.fail(new AuthProviderError({ message: "Provider down" })) }
    const result = await Effect.runPromise(
      oauthSignInProgram("google", "https://example.com/cb").pipe(
        Effect.provideService(IAuthRepository, failingRepo),
        Effect.flip,
        Effect.map((e) => { expect(e._tag).toBe("AuthProviderError"); return e }),
      ),
    )
  })

  it("propagates AuthProviderError from getSession", async () => {
    const failingRepo = { ...mockRepo, getSession: () => Effect.fail(new AuthProviderError({ message: "Down" })) }
    const result = await Effect.runPromise(
      getSessionProgram().pipe(
        Effect.provideService(IAuthRepository, failingRepo),
        Effect.flip,
        Effect.map((e) => { expect(e._tag).toBe("AuthProviderError"); return e }),
      ),
    )
  })

  it("propagates UserNotFoundError from verifyOtp", async () => {
    const failingRepo = {
      ...mockRepo,
      verifyOtp: () => Effect.fail(new UserNotFoundError({ message: "Not found" })),
    }
    const result = await Effect.runPromise(
      verifyOtpProgram({ email: "nonexistent@example.com", token: "123456", type: "signup" }).pipe(
        Effect.provideService(IAuthRepository, failingRepo),
        Effect.flip,
        Effect.map((e) => { expect(e._tag).toBe("UserNotFoundError"); return e }),
      ),
    )
  })
})
