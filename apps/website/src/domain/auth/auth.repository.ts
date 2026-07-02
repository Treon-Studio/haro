import { Context, Effect } from "effect"
import type { TAuthResult } from "./auth.types"
import {
  InvalidCredentialsError,
  EmailAlreadyRegisteredError,
  EmailNotVerifiedError,
  SessionExpiredError,
  AuthProviderError,
  UserNotFoundError,
} from "./auth.errors"

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
