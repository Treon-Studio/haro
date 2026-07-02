import { Data } from "effect"

export class NotificationFetchError extends Data.TaggedError("NotificationFetchError")<{ readonly message: string }> {}
export class NotificationUpdateError extends Data.TaggedError("NotificationUpdateError")<{ readonly message: string }> {}
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{ readonly message: string }> {}
