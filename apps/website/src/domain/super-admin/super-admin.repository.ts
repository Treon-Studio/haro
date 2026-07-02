import { Context, Effect } from "effect"
import type { THandoff } from "./super-admin.types"
import type { TCompany, TCompanyMembership } from "@/domain/companies/index"
import {
  HandoffCreationError,
  HandoffFetchError,
  TenantProvisionError,
  UnauthorizedError,
} from "./super-admin.errors"
import type { CreateHandoffCommand } from "./super-admin.schemas"

export class ISuperAdminRepository extends Context.Tag("ISuperAdminRepository")<
  ISuperAdminRepository,
  {
    readonly createHandoff: (
      data: CreateHandoffCommand,
    ) => Effect.Effect<THandoff, HandoffCreationError | UnauthorizedError>

    readonly getHandoffs: () => Effect.Effect<readonly THandoff[], HandoffFetchError | UnauthorizedError>

    readonly provisionTenant: (
      handoffId: string,
    ) => Effect.Effect<TCompany, TenantProvisionError | UnauthorizedError>
  }
> () {}
