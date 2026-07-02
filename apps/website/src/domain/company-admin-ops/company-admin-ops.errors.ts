import { Data } from "effect"

export class AdminOpsFetchError extends Data.TaggedError("AdminOpsFetchError")<{ readonly message: string }> {}
export class AdminOpsUpdateError extends Data.TaggedError("AdminOpsUpdateError")<{ readonly message: string }> {}
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{ readonly message: string }> {}
