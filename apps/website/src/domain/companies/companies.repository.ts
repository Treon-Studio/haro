import { Context, Effect } from "effect"
import type { TCompany, TCompanyMembership } from "./companies.types"
import {
  CompanyCreationError,
  CompanyFetchError,
  CompanyUpdateError,
  CompanyNotFoundError,
  CompanyMembershipError,
  UnauthorizedError,
} from "./companies.errors"

export class ICompaniesRepository extends Context.Tag("ICompaniesRepository")<
  ICompaniesRepository,
  {
    readonly createCompany: (
      name: string,
    ) => Effect.Effect<TCompany, CompanyCreationError | UnauthorizedError>

    readonly getCompanies: () => Effect.Effect<readonly TCompany[], CompanyFetchError | UnauthorizedError>

    readonly updateCompany: (
      id: string,
      name: string,
    ) => Effect.Effect<TCompany, CompanyUpdateError | CompanyNotFoundError | UnauthorizedError>

    readonly getCompanyMembers: (
      companyId: string,
    ) => Effect.Effect<readonly TCompanyMembership[], CompanyMembershipError | UnauthorizedError>

    readonly addCompanyMember: (
      companyId: string,
      userId: string,
      role: "owner" | "admin" | "member",
    ) => Effect.Effect<TCompanyMembership, CompanyMembershipError | UnauthorizedError>

    readonly updateCompanyMember: (
      membershipId: string,
      role: "owner" | "admin" | "member",
      status: "active" | "invited" | "suspended",
    ) => Effect.Effect<TCompanyMembership, CompanyMembershipError | UnauthorizedError>

    readonly removeCompanyMember: (
      membershipId: string,
    ) => Effect.Effect<void, CompanyMembershipError | UnauthorizedError>
  }
> () {}
