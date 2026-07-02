import { Effect, pipe } from "effect"
import { Schema } from "@effect/schema"
import { IProjectsRepository } from "./projects.repository"
import { CreateProjectSchema } from "./projects.schemas"
import { toProjectDto } from "./projects.types"
import type { TProjectDto } from "./projects.types"
import { ValidationError } from "@/shared/errors/application.errors"
import { ProjectCreationError, ProjectFetchError, UnauthorizedError } from "./projects.errors"

export type ProjectsProgramError =
  | ProjectCreationError
  | ProjectFetchError
  | UnauthorizedError
  | ValidationError

export const createProjectProgram = (body: unknown): Effect.Effect<
  TProjectDto,
  ProjectsProgramError,
  IProjectsRepository
> =>
  pipe(
    Schema.decodeUnknown(CreateProjectSchema)(body),
    Effect.mapError((e) => new ValidationError({ issues: e.message })),
    Effect.flatMap(({ name, companyId }) =>
      pipe(
        IProjectsRepository,
        Effect.flatMap((repo) => repo.createProject(name, companyId)),
        Effect.map(toProjectDto),
      ),
    ),
  )

export const getProjectsProgram = (companyId?: string | null): Effect.Effect<
  readonly TProjectDto[],
  ProjectsProgramError,
  IProjectsRepository
> =>
  pipe(
    IProjectsRepository,
    Effect.flatMap((repo) => repo.getProjects(companyId)),
    Effect.map((projects) => projects.map(toProjectDto)),
  )
