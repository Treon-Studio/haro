import { Context, Effect } from "effect"
import type { TProfile } from "./profiles.types"
import { ProfileFetchError, ProfileUpdateError, UnauthorizedError } from "./profiles.errors"

export class IProfilesRepository extends Context.Tag("IProfilesRepository")<
  IProfilesRepository,
  {
    readonly getProfile: () => Effect.Effect<TProfile | null, ProfileFetchError | UnauthorizedError>

    readonly updateProfile: (
      data: Partial<TProfile> & { onboardingCompleted?: boolean },
    ) => Effect.Effect<TProfile, ProfileUpdateError | UnauthorizedError>
  }
> () {}
