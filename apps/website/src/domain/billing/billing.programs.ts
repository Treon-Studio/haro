import { Effect, pipe } from "effect"
import { IBillingRepository } from "./billing.repository"
import { toBillingInfoDto } from "./billing.types"
import type { TBillingInfoDto } from "./billing.types"
import { BillingFetchError, BillingUpdateError, UnauthorizedError } from "./billing.errors"

export type BillingProgramError = BillingFetchError | BillingUpdateError | UnauthorizedError

export const getBillingInfoProgram = (
  companyId: string,
): Effect.Effect<TBillingInfoDto, BillingProgramError, IBillingRepository> =>
  pipe(
    IBillingRepository,
    Effect.flatMap((repo) => repo.getBillingInfo(companyId)),
    Effect.map(toBillingInfoDto),
  )

export const checkAndIncrementQuotaProgram = (
  companyId: string,
): Effect.Effect<boolean, BillingProgramError, IBillingRepository> =>
  pipe(
    IBillingRepository,
    Effect.flatMap((repo) =>
      pipe(
        repo.getBillingInfo(companyId),
        Effect.flatMap((info) => {
          if (info.isQuotaExceeded) {
            return Effect.succeed(false)
          }
          return pipe(
            repo.incrementSessionUsage(companyId),
            Effect.map(() => true),
          )
        }),
      )
    ),
  )
