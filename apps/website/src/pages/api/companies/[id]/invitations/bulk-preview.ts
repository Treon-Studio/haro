import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { previewBulkInviteProgram } from "@/domain/invitations/invitations.programs"
import { makeMeta, jsonOk, jsonError, runInvitationsEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { ValidationError } from "@/shared/errors/application.errors"

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()
  const companyId = context.params.id

  if (!companyId) {
    return jsonError({ _tag: "ValidationError", message: "Company ID is required" }, meta, HTTP_STATUS.BAD_REQUEST)
  }

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: () => new ValidationError({ issues: "Invalid JSON body" }),
    }),
    Effect.flatMap((body: any) => {
      if (!body?.csvText) {
        return Effect.fail(new ValidationError({ issues: "csvText is required" }))
      }
      return Effect.succeed(body.csvText as string)
    }),
    Effect.flatMap((csvText) => previewBulkInviteProgram(companyId, csvText)),
    Effect.map((data) => jsonOk(data, meta)),
    Effect.catchTags({
      ValidationError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.issues }, meta, HTTP_STATUS.BAD_REQUEST)),
      UnauthorizedError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
    }),
  )

  return await runInvitationsEffect(context, program)
}
