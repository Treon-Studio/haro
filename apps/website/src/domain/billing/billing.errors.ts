import { Data } from "effect"

export class BillingFetchError extends Data.TaggedError("BillingFetchError")<{ readonly message: string }> {}
export class BillingUpdateError extends Data.TaggedError("BillingUpdateError")<{ readonly message: string }> {}
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{ readonly message: string }> {}
