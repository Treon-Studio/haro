import { Data } from "effect"

export class InvitationCreationError extends Data.TaggedError("InvitationCreationError")<{ readonly message: string }> {}
export class InvitationFetchError extends Data.TaggedError("InvitationFetchError")<{ readonly message: string }> {}
export class InvitationValidationError extends Data.TaggedError("InvitationValidationError")<{ readonly message: string }> {}
export class InvitationAcceptError extends Data.TaggedError("InvitationAcceptError")<{ readonly message: string }> {}
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{ readonly message: string }> {}
