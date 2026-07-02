import { Data } from "effect"

export class ProjectCreationError extends Data.TaggedError("ProjectCreationError")<{ readonly message: string }> {}
export class ProjectFetchError extends Data.TaggedError("ProjectFetchError")<{ readonly message: string }> {}
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{ readonly message: string }> {}
