import { Data } from "effect"

export class ProfileFetchError extends Data.TaggedError("ProfileFetchError")<{ readonly message: string }> {}
export class ProfileUpdateError extends Data.TaggedError("ProfileUpdateError")<{ readonly message: string }> {}
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{ readonly message: string }> {}
