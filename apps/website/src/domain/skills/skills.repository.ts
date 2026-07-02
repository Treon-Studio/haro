import { Context, Effect } from "effect"
import type { TSkill } from "./skills.types"
import { SkillCreationError, SkillFetchError, UnauthorizedError } from "./skills.errors"

export class ISkillsRepository extends Context.Tag("ISkillsRepository")<
  ISkillsRepository,
  {
    readonly createSkill: (
      name: string,
      description: string,
      body: string,
      category: string,
      companyId?: string | null,
    ) => Effect.Effect<TSkill, SkillCreationError | UnauthorizedError>

    readonly getSkills: (
      companyId?: string | null,
    ) => Effect.Effect<readonly TSkill[], SkillFetchError | UnauthorizedError>
  }
> () {}
