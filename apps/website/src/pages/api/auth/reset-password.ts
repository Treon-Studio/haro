import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { resetPasswordProgram } from "@/domain/auth/auth.programs"
import { makeMeta, jsonOk, jsonError, runAuthEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { ValidationError } from "@/shared/errors/application.errors"

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: () => new ValidationError({ issues: "Invalid JSON body" }),
    }),
    Effect.flatMap(resetPasswordProgram),
    Effect.map(() => jsonOk({ message: "Password berhasil diubah" }, meta)),
    Effect.catchTags({
      ValidationError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.issues }, meta, HTTP_STATUS.BAD_REQUEST)),
      SessionExpiredError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: "Sesi telah berakhir" }, meta, HTTP_STATUS.UNAUTHORIZED)),
      AuthProviderError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.BAD_REQUEST)),
    }),
  )

  const result = await runAuthEffect(context, program)
  return result
}
