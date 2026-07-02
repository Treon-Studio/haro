import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { broadcastAnnouncementProgram } from "@/domain/notifications/notifications.programs"
import { makeMeta, jsonOk, jsonError, runNotificationsEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { ValidationError } from "@/shared/errors/application.errors"

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()
  const companyId = context.params.id as string

  if (!companyId) {
    return jsonError({ _tag: "ValidationError", message: "Company ID is required" }, meta, HTTP_STATUS.BAD_REQUEST)
  }

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: () => new ValidationError({ issues: "Invalid JSON body" }),
    }),
    Effect.flatMap((body: any): any => {
      if (!body.title || !body.body) {
        return Effect.fail(new ValidationError({ issues: "title and body are required" }))
      }
      return broadcastAnnouncementProgram(companyId, body.title, body.body, body.link)
    }),
    Effect.map((data) => jsonOk(data, meta, HTTP_STATUS.CREATED)),
    Effect.catchTags({
      ValidationError: (e: any) => Effect.succeed(jsonError({ _tag: e._tag, message: e.issues }, meta, HTTP_STATUS.BAD_REQUEST)),
      UnauthorizedError: (e: any) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
      NotificationUpdateError: (e: any) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runNotificationsEffect(context, program)
}
