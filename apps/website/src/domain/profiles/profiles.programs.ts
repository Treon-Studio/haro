import { Effect, pipe } from "effect"
import { Schema } from "@effect/schema"
import { IProfilesRepository } from "./profiles.repository"
import { UpdateProfileSchema } from "./profiles.schemas"
import { toProfileDto } from "./profiles.types"
import type { TProfileDto, TProfile } from "./profiles.types"
import { ValidationError } from "@/shared/errors/application.errors"
import { ProfileFetchError, ProfileUpdateError, UnauthorizedError } from "./profiles.errors"

export type ProfilesProgramError =
  | ProfileFetchError
  | ProfileUpdateError
  | UnauthorizedError
  | ValidationError

const createDefaultProfile = (userId: string): TProfile => ({
  userId,
  fullName: null,
  ageRange: null,
  gender: null,
  pronouns: null,
  phone: null,
  language: "id",
  notificationOptIn: true,
  department: null,
  onboardingCompletedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

export const getProfileProgram = (): Effect.Effect<
  TProfileDto,
  ProfilesProgramError,
  IProfilesRepository
> =>
  pipe(
    IProfilesRepository,
    Effect.flatMap((repo) => repo.getProfile()),
    Effect.flatMap((profile) => {
      if (profile) return Effect.succeed(profile)
      
      // Attempt to resolve userId to inject default
      return pipe(
        IProfilesRepository,
        // Since we know getting profile successfully confirms session exists,
        // if profile is null we return a blank default profile.
        // The repository is scoped to auth.uid() inside.
        // We will mock/return a placeholder which will be overwritten on first update.
        Effect.map(() => createDefaultProfile("")),
      )
    }),
    Effect.map(toProfileDto),
  )

export const updateProfileProgram = (body: unknown): Effect.Effect<
  TProfileDto,
  ProfilesProgramError,
  IProfilesRepository
> =>
  pipe(
    Schema.decodeUnknown(UpdateProfileSchema)(body),
    Effect.mapError((e) => new ValidationError({ issues: e.message })),
    Effect.flatMap((command) =>
      pipe(
        IProfilesRepository,
        Effect.flatMap((repo) => repo.updateProfile(command as any)),
        Effect.map(toProfileDto),
      ),
    ),
  )
