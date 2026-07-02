import { Context, Effect } from "effect"
import type { TProject } from "./projects.types"
import { ProjectCreationError, ProjectFetchError, UnauthorizedError } from "./projects.errors"

export class IProjectsRepository extends Context.Tag("IProjectsRepository")<
  IProjectsRepository,
  {
    readonly createProject: (
      name: string,
      companyId?: string | null,
    ) => Effect.Effect<TProject, ProjectCreationError | UnauthorizedError>

    readonly getProjects: (
      companyId?: string | null,
    ) => Effect.Effect<readonly TProject[], ProjectFetchError | UnauthorizedError>
  }
> () {}
