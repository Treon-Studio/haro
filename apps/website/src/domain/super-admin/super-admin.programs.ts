import { Effect, pipe } from "effect"
import { Schema } from "@effect/schema"
import { ISuperAdminRepository } from "./super-admin.repository"
import { CreateHandoffSchema } from "./super-admin.schemas"
import { toHandoffDto } from "./super-admin.types"
import type { THandoffDto } from "./super-admin.types"
import type { TCompanyDto } from "@/domain/companies/index"
import { toCompanyDto } from "@/domain/companies/index"
import { ValidationError } from "@/shared/errors/application.errors"
import {
  HandoffCreationError,
  HandoffFetchError,
  TenantProvisionError,
  UnauthorizedError,
} from "./super-admin.errors"

export type SuperAdminProgramError =
  | HandoffCreationError
  | HandoffFetchError
  | TenantProvisionError
  | UnauthorizedError
  | ValidationError

export const createHandoffProgram = (body: unknown): Effect.Effect<
  THandoffDto,
  SuperAdminProgramError,
  ISuperAdminRepository
> =>
  pipe(
    Schema.decodeUnknown(CreateHandoffSchema)(body),
    Effect.mapError((e) => new ValidationError({ issues: e.message })),
    Effect.flatMap((command) =>
      pipe(
        ISuperAdminRepository,
        Effect.flatMap((repo) => repo.createHandoff(command)),
        Effect.map(toHandoffDto),
      ),
    ),
  )

export const getHandoffsProgram = (): Effect.Effect<
  readonly THandoffDto[],
  SuperAdminProgramError,
  ISuperAdminRepository
> =>
  pipe(
    ISuperAdminRepository,
    Effect.flatMap((repo) => repo.getHandoffs()),
    Effect.map((handoffs) => handoffs.map(toHandoffDto)),
  )

export const provisionTenantProgram = (
  handoffId: string,
): Effect.Effect<
  TCompanyDto,
  SuperAdminProgramError,
  ISuperAdminRepository
> =>
  pipe(
    ISuperAdminRepository,
    Effect.flatMap((repo) => repo.provisionTenant(handoffId)),
    Effect.map(toCompanyDto),
  )
