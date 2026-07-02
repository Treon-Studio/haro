import { Effect } from "effect"
import type { APIRoute } from "astro"
import { signOutProgram } from "@/domain/auth/auth.programs"
import { makeMeta, jsonOk, jsonError, runAuthEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = Effect.catchTags(
    signOutProgram(),
    {
      AuthProviderError: (e) =>
        Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.BAD_REQUEST)),
    },
  ).pipe(
    Effect.map(() => jsonOk({ message: "Logged out" }, meta)),
  )

  const result = await runAuthEffect(context, program)
  return result
}
