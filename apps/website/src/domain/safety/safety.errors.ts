import { Data } from "effect"

export class SafetyFetchError extends Data.TaggedError("SafetyFetchError")<{ readonly message: string }> {}
export class SafetyUpdateError extends Data.TaggedError("SafetyUpdateError")<{ readonly message: string }> {}
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{ readonly message: string }> {}
