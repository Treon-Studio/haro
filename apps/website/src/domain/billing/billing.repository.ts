import { Context, Effect } from "effect"
import type { TBillingInfo } from "./billing.types"
import { BillingFetchError, BillingUpdateError, UnauthorizedError } from "./billing.errors"

export class IBillingRepository extends Context.Tag("IBillingRepository")<
  IBillingRepository,
  {
    readonly getBillingInfo: (companyId: string) => Effect.Effect<TBillingInfo, BillingFetchError | UnauthorizedError>
    readonly incrementSessionUsage: (companyId: string) => Effect.Effect<TBillingInfo, BillingUpdateError | UnauthorizedError>
  }
> () {}
