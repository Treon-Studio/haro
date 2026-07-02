import { Schema } from "@effect/schema"

export const LoginSchema = Schema.Struct({
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  password: Schema.String.pipe(Schema.minLength(6)),
})

export const SignUpSchema = Schema.Struct({
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  password: Schema.String.pipe(Schema.minLength(8)),
  invitationToken: Schema.optional(Schema.String),
  fullName: Schema.optional(Schema.String),
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
