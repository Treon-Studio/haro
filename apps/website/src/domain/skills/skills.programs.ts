import { Effect, pipe } from "effect"
import { Schema } from "@effect/schema"
import { ISkillsRepository } from "./skills.repository"
import { CreateSkillSchema } from "./skills.schemas"
import { toSkillDto } from "./skills.types"
import type { TSkillDto } from "./skills.types"
import { ValidationError } from "@/shared/errors/application.errors"
import { SkillCreationError, SkillFetchError, UnauthorizedError } from "./skills.errors"

export type SkillsProgramError =
  | SkillCreationError
  | SkillFetchError
  | UnauthorizedError
  | ValidationError

export const createSkillProgram = (body: unknown): Effect.Effect<
  TSkillDto,
  SkillsProgramError,
  ISkillsRepository
> =>
  pipe(
    Schema.decodeUnknown(CreateSkillSchema)(body),
    Effect.mapError((e) => new ValidationError({ issues: e.message })),
    Effect.flatMap(({ name, description, body, category, companyId }) =>
      pipe(
        ISkillsRepository,
        Effect.flatMap((repo) => repo.createSkill(name, description, body, category, companyId)),
        Effect.map(toSkillDto),
      ),
    ),
  )

export const getSkillsProgram = (companyId?: string | null): Effect.Effect<
  readonly TSkillDto[],
  SkillsProgramError,
  ISkillsRepository
> =>
  pipe(
    ISkillsRepository,
    Effect.flatMap((repo) => repo.getSkills(companyId)),
    Effect.map((skills) => skills.map(toSkillDto)),
  )
