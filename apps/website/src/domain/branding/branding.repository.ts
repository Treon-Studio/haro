import { Context, Effect } from "effect"
import type { TBranding } from "./branding.types"
import { BrandingFetchError, BrandingUpdateError, UnauthorizedError } from "./branding.errors"

export class IBrandingRepository extends Context.Tag("IBrandingRepository")<
  IBrandingRepository,
  {
    readonly getBranding: (
      companyId: string,
    ) => Effect.Effect<TBranding | null, BrandingFetchError | UnauthorizedError>

    readonly updateBranding: (
      companyId: string,
      data: Partial<TBranding>,
    ) => Effect.Effect<TBranding, BrandingUpdateError | UnauthorizedError>
  }
> () {}
