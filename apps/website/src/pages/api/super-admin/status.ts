import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { getPlatformStatusProgram, updatePlatformStatusProgram } from "@/domain/super-admin-ops/super-admin-ops.programs"
import { makeMeta, jsonOk, jsonError, runSuperAdminOpsEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { ValidationError } from "@/shared/errors/application.errors"

export const GET: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    getPlatformStatusProgram(),
    Effect.map((data) => jsonOk(data, meta)),
    Effect.catchTags({
      OpsFetchError: (e: any) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runSuperAdminOpsEffect(context, program)
}

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: () => new ValidationError({ issues: "Invalid JSON body" }),
    }),
    Effect.flatMap((body: any): any => {
      if (!body.message || body.isActive === undefined || !body.severity) {
        return Effect.fail(new ValidationError({ issues: "message, isActive, and severity are required" }))
      }
      return updatePlatformStatusProgram(body.message, body.isActive, body.severity, body.expectedResolution)
    }),
    Effect.map((data) => jsonOk(data, meta)),
    Effect.catchTags({
      ValidationError: (e: any) => Effect.succeed(jsonError({ _tag: e._tag, message: e.issues }, meta, HTTP_STATUS.BAD_REQUEST)),
      UnauthorizedError: (e: any) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
      OpsUpdateError: (e: any) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runSuperAdminOpsEffect(context, program)
}
