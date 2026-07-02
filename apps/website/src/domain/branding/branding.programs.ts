import { Effect, pipe } from "effect"
import { Schema } from "@effect/schema"
import { IBrandingRepository } from "./branding.repository"
import { UpdateBrandingSchema } from "./branding.schemas"
import { toBrandingDto } from "./branding.types"
import type { TBrandingDto, TBranding } from "./branding.types"
import { ValidationError } from "@/shared/errors/application.errors"
import {
  BrandingCreationError,
  BrandingFetchError,
  BrandingUpdateError,
  UnauthorizedError,
} from "./branding.errors"

export type BrandingProgramError =
  | BrandingCreationError
  | BrandingFetchError
  | BrandingUpdateError
  | UnauthorizedError
  | ValidationError

// Fallback B2C / Unconfigured Corporate Branding (earthy ochre defaults)
const DEFAULT_BRANDING = (companyId: string): TBranding => ({
  companyId,
  logoUrl: null,
  primaryColor: "#9B5B3E", // Haro's earthy ochre hex equivalent
  welcomeMessage: "Selamat datang di Haro — ruang aman kesehatan mental Anda.",
  defaultLanguage: "id",
  notificationSettings: {},
  updatedAt: new Date().toISOString(),
  updatedBy: null,
})

export const getBrandingProgram = (
  companyId: string,
): Effect.Effect<
  TBrandingDto,
  BrandingProgramError,
  IBrandingRepository
> =>
  pipe(
    IBrandingRepository,
    Effect.flatMap((repo) => repo.getBranding(companyId)),
    Effect.map((branding) => branding || DEFAULT_BRANDING(companyId)),
    Effect.map(toBrandingDto),
  )

export const updateBrandingProgram = (body: unknown): Effect.Effect<
  TBrandingDto,
  BrandingProgramError,
  IBrandingRepository
> =>
  pipe(
    Schema.decodeUnknown(UpdateBrandingSchema)(body),
    Effect.mapError((e) => new ValidationError({ issues: e.message })),
    Effect.flatMap(({ companyId, ...data }) =>
      pipe(
        IBrandingRepository,
        Effect.flatMap((repo) => repo.updateBranding(companyId, data as Partial<TBranding>)),
        Effect.map(toBrandingDto),
      ),
    ),
  )
