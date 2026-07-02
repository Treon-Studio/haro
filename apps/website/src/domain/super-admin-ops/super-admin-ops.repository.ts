import { Context, Effect } from "effect"
import type { TFeatureFlag, TPlatformStatus } from "./super-admin-ops.types"
import { OpsFetchError, OpsUpdateError, UnauthorizedError } from "./super-admin-ops.errors"

export class ISuperAdminOpsRepository extends Context.Tag("ISuperAdminOpsRepository")<
  ISuperAdminOpsRepository,
  {
    readonly getFeatureFlags: (companyId: string) => Effect.Effect<readonly TFeatureFlag[], OpsFetchError | UnauthorizedError>
    readonly updateFeatureFlag: (companyId: string, flag: string, enabled: boolean) => Effect.Effect<TFeatureFlag, OpsUpdateError | UnauthorizedError>
    readonly getPlatformStatus: () => Effect.Effect<TPlatformStatus | null, OpsFetchError>
    readonly updatePlatformStatus: (message: string, isActive: boolean, severity: "info" | "warning" | "critical", expectedResolution?: string | null) => Effect.Effect<TPlatformStatus, OpsUpdateError | UnauthorizedError>
  }
> () {}
