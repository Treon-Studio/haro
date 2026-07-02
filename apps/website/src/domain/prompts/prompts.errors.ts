import { Data } from "effect"

export class PromptCreationError extends Data.TaggedError("PromptCreationError")<{ readonly message: string }> {}
export class PromptFetchError extends Data.TaggedError("PromptFetchError")<{ readonly message: string }> {}
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{ readonly message: string }> {}
