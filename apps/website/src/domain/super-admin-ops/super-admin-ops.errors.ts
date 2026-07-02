import { Data } from "effect"

export class OpsFetchError extends Data.TaggedError("OpsFetchError")<{ readonly message: string }> {}
export class OpsUpdateError extends Data.TaggedError("OpsUpdateError")<{ readonly message: string }> {}
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{ readonly message: string }> {}
