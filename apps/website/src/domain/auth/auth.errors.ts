import { Data } from "effect"

export class InvalidCredentialsError extends Data.TaggedError("InvalidCredentialsError")<{
  readonly message: string
}> {}

export class EmailAlreadyRegisteredError extends Data.TaggedError("EmailAlreadyRegisteredError")<{
  readonly message: string
}> {}

export class EmailNotVerifiedError extends Data.TaggedError("EmailNotVerifiedError")<{
  readonly message: string
}> {}

export class SessionExpiredError extends Data.TaggedError("SessionExpiredError")<{
  readonly message: string
}> {}

export class UserNotFoundError extends Data.TaggedError("UserNotFoundError")<{
  readonly message: string
}> {}

export class AuthProviderError extends Data.TaggedError("AuthProviderError")<{
  readonly message: string
  readonly cause?: unknown
}> {}
