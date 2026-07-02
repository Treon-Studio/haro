import { Effect, pipe } from "effect"
import { Schema } from "@effect/schema"
import { IPromptsRepository } from "./prompts.repository"
import { CreatePromptSchema } from "./prompts.schemas"
import { toPromptDto } from "./prompts.types"
import type { TPromptDto } from "./prompts.types"
import { ValidationError } from "@/shared/errors/application.errors"
import { PromptCreationError, PromptFetchError, UnauthorizedError } from "./prompts.errors"

export type PromptsProgramError =
  | PromptCreationError
  | PromptFetchError
  | UnauthorizedError
  | ValidationError

export const createPromptProgram = (body: unknown): Effect.Effect<
  TPromptDto,
  PromptsProgramError,
  IPromptsRepository
> =>
  pipe(
    Schema.decodeUnknown(CreatePromptSchema)(body),
    Effect.mapError((e) => new ValidationError({ issues: e.message })),
    Effect.flatMap(({ name, category, snippet, authorName, isPublic, companyId }) =>
      pipe(
        IPromptsRepository,
        Effect.flatMap((repo) => repo.createPrompt(name, category, snippet, authorName, isPublic, companyId)),
        Effect.map(toPromptDto),
      ),
    ),
  )

export const getPromptsProgram = (companyId?: string | null): Effect.Effect<
  readonly TPromptDto[],
  PromptsProgramError,
  IPromptsRepository
> =>
  pipe(
    IPromptsRepository,
    Effect.flatMap((repo) => repo.getPrompts(companyId)),
    Effect.map((prompts) => prompts.map(toPromptDto)),
  )
