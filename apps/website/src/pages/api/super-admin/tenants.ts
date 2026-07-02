import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { provisionTenantProgram } from "@/domain/super-admin/super-admin.programs"
import { makeMeta, jsonOk, jsonError, runSuperAdminEffect } from "@/lib/api-helpers"
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
      if (!body?.handoffId) {
        return Effect.fail(new ValidationError({ issues: "handoffId is required" }))
      }
      return Effect.succeed(body.handoffId as string)
    }),
    Effect.flatMap((handoffId) => provisionTenantProgram(handoffId)),
    Effect.map((data) => jsonOk(data, meta, HTTP_STATUS.CREATED)),
    Effect.catchTags({
      ValidationError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.issues }, meta, HTTP_STATUS.BAD_REQUEST)),
      UnauthorizedError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
      TenantProvisionError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runSuperAdminEffect(context, program)
}
