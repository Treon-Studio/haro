import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { verifyInvitationTokenProgram } from "@/domain/invitations/invitations.programs"
import { makeMeta, jsonOk, jsonError, runInvitationsEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { ValidationError } from "@/shared/errors/application.errors"

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: () => new ValidationError({ issues: "Invalid JSON body" }),
    }),
    Effect.flatMap((body: any) => {
      if (!body?.token) {
        return Effect.fail(new ValidationError({ issues: "token is required" }))
      }
      return Effect.succeed(body.token as string)
    }),
    Effect.flatMap((token) => verifyInvitationTokenProgram(token)),
    Effect.map((data) => jsonOk(data, meta)),
    Effect.catchTags({
      ValidationError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.issues }, meta, HTTP_STATUS.BAD_REQUEST)),
      UnauthorizedError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
      InvitationValidationError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNPROCESSABLE_ENTITY)),
    }),
  )

  return await runInvitationsEffect(context, program)
}
