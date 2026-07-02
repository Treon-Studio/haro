import { Effect, pipe } from "effect"
import { Schema } from "@effect/schema"
import { IAuthRepository } from "./auth.repository"
import { SignUpSchema, LoginSchema, ForgotPasswordSchema, ResetPasswordSchema, OtpVerificationSchema } from "./auth.schemas"
import { toAuthDto } from "./auth.dto"
import type { TAuthDto } from "./auth.types"
import { ValidationError } from "@/shared/errors/application.errors"
import {
  InvalidCredentialsError,
  EmailAlreadyRegisteredError,
  EmailNotVerifiedError,
  SessionExpiredError,
  AuthProviderError,
  UserNotFoundError,
} from "./auth.errors"

import { IInvitationsRepository, hashToken } from "@/domain/invitations/index"

export type AuthProgramError =
  | InvalidCredentialsError
  | EmailAlreadyRegisteredError
  | EmailNotVerifiedError
  | SessionExpiredError
  | AuthProviderError
  | UserNotFoundError
  | ValidationError
  | any // support invitation errors

export const signUpProgram = (body: unknown): Effect.Effect<
  TAuthDto,
  AuthProgramError,
  IAuthRepository | IInvitationsRepository
> =>
  pipe(
    Schema.decodeUnknown(SignUpSchema)(body),
    Effect.mapError((e) => new ValidationError({ issues: e.message })),
    Effect.flatMap(({ email, password, invitationToken }) => {
      const processSignUp = (invitedRole?: string): Effect.Effect<
        TAuthDto,
        AuthProgramError,
        IAuthRepository | IInvitationsRepository
      > =>
        pipe(
          IAuthRepository,
          Effect.flatMap((repo) => repo.signUp(email, password)),
          Effect.flatMap((authResult) => {
            if (invitationToken) {
              // Accept the invitation with the new userId
              return pipe(
                IInvitationsRepository,
                Effect.flatMap((invRepo) => {
                  const tokenHash = hashToken(invitationToken)
                  return pipe(
                    invRepo.verifyInvitation(tokenHash),
                    Effect.flatMap((invitation) =>
                      invRepo.acceptInvitation(invitation.id, authResult.user.id)
                    ),
                  )
                }),
                Effect.map(() => authResult),
              )
            }
            return Effect.succeed(authResult)
          }),
          Effect.map(toAuthDto),
        )

      if (invitationToken) {
        // First verify invitation
        return pipe(
          IInvitationsRepository,
          Effect.flatMap((invRepo) => {
            const tokenHash = hashToken(invitationToken)
            return invRepo.verifyInvitation(tokenHash)
          }),
          Effect.flatMap((invitation) => {
            if (invitation.email.toLowerCase() !== email.toLowerCase()) {
              return Effect.fail(new ValidationError({ issues: "Email tidak cocok dengan undangan" }))
            }
            return processSignUp(invitation.role)
          }),
        ) as Effect.Effect<TAuthDto, AuthProgramError, IAuthRepository | IInvitationsRepository>
      }

      return processSignUp()
    }),
  )

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

export const signOutProgram = (): Effect.Effect<
  void,
  AuthProviderError,
  IAuthRepository
> =>
  pipe(
    IAuthRepository,
    Effect.flatMap((repo) => repo.signOut()),
  )

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
