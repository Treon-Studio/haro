import { Effect, pipe } from "effect"
import { ISuperAdminOpsRepository } from "./super-admin-ops.repository"
import type { TFeatureFlag, TPlatformStatus } from "./super-admin-ops.types"
import { OpsFetchError, OpsUpdateError, UnauthorizedError } from "./super-admin-ops.errors"

export type OpsProgramError = OpsFetchError | OpsUpdateError | UnauthorizedError

export const getFeatureFlagsProgram = (
  companyId: string,
): Effect.Effect<readonly TFeatureFlag[], OpsProgramError, ISuperAdminOpsRepository> =>
  pipe(
    ISuperAdminOpsRepository,
    Effect.flatMap((repo) => repo.getFeatureFlags(companyId)),
  )

export const updateFeatureFlagProgram = (
  companyId: string,
  flag: string,
  enabled: boolean,
): Effect.Effect<TFeatureFlag, OpsProgramError, ISuperAdminOpsRepository> =>
  pipe(
    ISuperAdminOpsRepository,
    Effect.flatMap((repo) => repo.updateFeatureFlag(companyId, flag, enabled)),
  )

export const getPlatformStatusProgram = (): Effect.Effect<TPlatformStatus | null, OpsProgramError, ISuperAdminOpsRepository> =>
  pipe(
    ISuperAdminOpsRepository,
    Effect.flatMap((repo) => repo.getPlatformStatus()),
  )

export const updatePlatformStatusProgram = (
  message: string,
  isActive: boolean,
  severity: "info" | "warning" | "critical",
  expectedResolution?: string | null,
): Effect.Effect<TPlatformStatus, OpsProgramError, ISuperAdminOpsRepository> =>
  pipe(
    ISuperAdminOpsRepository,
    Effect.flatMap((repo) => repo.updatePlatformStatus(message, isActive, severity, expectedResolution)),
  )
