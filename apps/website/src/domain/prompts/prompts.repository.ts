import { Context, Effect } from "effect"
import type { TPrompt } from "./prompts.types"
import { PromptCreationError, PromptFetchError, UnauthorizedError } from "./prompts.errors"

export class IPromptsRepository extends Context.Tag("IPromptsRepository")<
  IPromptsRepository,
  {
    readonly createPrompt: (
      name: string,
      category: string,
      snippet: string,
      authorName?: string,
      isPublic?: boolean,
      companyId?: string | null,
    ) => Effect.Effect<TPrompt, PromptCreationError | UnauthorizedError>

    readonly getPrompts: (
      companyId?: string | null,
    ) => Effect.Effect<readonly TPrompt[], PromptFetchError | UnauthorizedError>
  }
> () {}
