import { Data } from "effect"

export class HandoffCreationError extends Data.TaggedError("HandoffCreationError")<{ readonly message: string }> {}
export class HandoffFetchError extends Data.TaggedError("HandoffFetchError")<{ readonly message: string }> {}
export class TenantProvisionError extends Data.TaggedError("TenantProvisionError")<{ readonly message: string }> {}
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{ readonly message: string }> {}
