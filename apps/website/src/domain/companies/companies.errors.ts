import { Data } from "effect"

export class CompanyCreationError extends Data.TaggedError("CompanyCreationError")<{ readonly message: string }> {}
export class CompanyFetchError extends Data.TaggedError("CompanyFetchError")<{ readonly message: string }> {}
export class CompanyUpdateError extends Data.TaggedError("CompanyUpdateError")<{ readonly message: string }> {}
export class CompanyMembershipError extends Data.TaggedError("CompanyMembershipError")<{ readonly message: string }> {}
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{ readonly message: string }> {}
export class CompanyNotFoundError extends Data.TaggedError("CompanyNotFoundError")<{ readonly message: string }> {}
