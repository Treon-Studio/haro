import { Data } from "effect"

export class SkillCreationError extends Data.TaggedError("SkillCreationError")<{ readonly message: string }> {}
export class SkillFetchError extends Data.TaggedError("SkillFetchError")<{ readonly message: string }> {}
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{ readonly message: string }> {}
