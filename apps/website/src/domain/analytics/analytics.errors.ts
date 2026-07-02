import { Data } from "effect"

export class AnalyticsFetchError extends Data.TaggedError("AnalyticsFetchError")<{ readonly message: string }> {}
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{ readonly message: string }> {}
