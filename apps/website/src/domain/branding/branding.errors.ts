import { Data } from "effect"

export class BrandingCreationError extends Data.TaggedError("BrandingCreationError")<{ readonly message: string }> {}
export class BrandingFetchError extends Data.TaggedError("BrandingFetchError")<{ readonly message: string }> {}
export class BrandingUpdateError extends Data.TaggedError("BrandingUpdateError")<{ readonly message: string }> {}
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{ readonly message: string }> {}
