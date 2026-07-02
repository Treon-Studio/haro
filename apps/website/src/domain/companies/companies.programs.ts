import { Effect, pipe } from "effect"
import { Schema } from "@effect/schema"
import { ICompaniesRepository } from "./companies.repository"
import {
  CreateCompanySchema,
  UpdateCompanySchema,
  AddMemberSchema,
  UpdateMemberSchema,
} from "./companies.schemas"
import { toCompanyDto, toCompanyMembershipDto } from "./companies.types"
import type { TCompanyDto, TCompanyMembershipDto } from "./companies.types"
import { ValidationError } from "@/shared/errors/application.errors"
import {
  CompanyCreationError,
  CompanyFetchError,
  CompanyUpdateError,
  CompanyNotFoundError,
  CompanyMembershipError,
  UnauthorizedError,
} from "./companies.errors"

export type CompaniesProgramError =
  | CompanyCreationError
  | CompanyFetchError
  | CompanyUpdateError
  | CompanyNotFoundError
  | CompanyMembershipError
  | UnauthorizedError
  | ValidationError

export const createCompanyProgram = (body: unknown): Effect.Effect<
  TCompanyDto,
  CompaniesProgramError,
  ICompaniesRepository
> =>
  pipe(
    Schema.decodeUnknown(CreateCompanySchema)(body),
    Effect.mapError((e) => new ValidationError({ issues: e.message })),
    Effect.flatMap(({ name }) =>
      pipe(
        ICompaniesRepository,
        Effect.flatMap((repo) => repo.createCompany(name)),
        Effect.map(toCompanyDto),
      ),
    ),
  )

export const getCompaniesProgram = (): Effect.Effect<
  readonly TCompanyDto[],
  CompaniesProgramError,
  ICompaniesRepository
> =>
  pipe(
    ICompaniesRepository,
    Effect.flatMap((repo) => repo.getCompanies()),
    Effect.map((companies) => companies.map(toCompanyDto)),
  )

export const updateCompanyProgram = (body: unknown): Effect.Effect<
  TCompanyDto,
  CompaniesProgramError,
  ICompaniesRepository
> =>
  pipe(
    Schema.decodeUnknown(UpdateCompanySchema)(body),
    Effect.mapError((e) => new ValidationError({ issues: e.message })),
    Effect.flatMap(({ id, name }) =>
      pipe(
        ICompaniesRepository,
        Effect.flatMap((repo) => repo.updateCompany(id, name)),
        Effect.map(toCompanyDto),
      ),
    ),
  )

export const getCompanyMembersProgram = (
  companyId: string,
): Effect.Effect<
  readonly TCompanyMembershipDto[],
  CompaniesProgramError,
  ICompaniesRepository
> =>
  pipe(
    ICompaniesRepository,
    Effect.flatMap((repo) => repo.getCompanyMembers(companyId)),
    Effect.map((memberships) => memberships.map(toCompanyMembershipDto)),
  )

export const addCompanyMemberProgram = (body: unknown): Effect.Effect<
  TCompanyMembershipDto,
  CompaniesProgramError,
  ICompaniesRepository
> =>
  pipe(
    Schema.decodeUnknown(AddMemberSchema)(body),
    Effect.mapError((e) => new ValidationError({ issues: e.message })),
    Effect.flatMap(({ companyId, userId, role }) =>
      pipe(
        ICompaniesRepository,
        Effect.flatMap((repo) => repo.addCompanyMember(companyId, userId, role)),
        Effect.map(toCompanyMembershipDto),
      ),
    ),
  )

export const updateCompanyMemberProgram = (body: unknown): Effect.Effect<
  TCompanyMembershipDto,
  CompaniesProgramError,
  ICompaniesRepository
> =>
  pipe(
    Schema.decodeUnknown(UpdateMemberSchema)(body),
    Effect.mapError((e) => new ValidationError({ issues: e.message })),
    Effect.flatMap(({ membershipId, role, status }) =>
      pipe(
        ICompaniesRepository,
        Effect.flatMap((repo) => repo.updateCompanyMember(membershipId, role, status)),
        Effect.map(toCompanyMembershipDto),
      ),
    ),
  )

export const removeCompanyMemberProgram = (
  membershipId: string,
): Effect.Effect<
  void,
  CompaniesProgramError,
  ICompaniesRepository
> =>
  pipe(
    ICompaniesRepository,
    Effect.flatMap((repo) => repo.removeCompanyMember(membershipId)),
  )
