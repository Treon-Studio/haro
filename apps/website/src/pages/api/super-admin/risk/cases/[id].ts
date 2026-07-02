import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { assignCaseProgram, logFollowupAttemptProgram, resolveCaseProgram } from "@/domain/safety/safety.programs"
import { makeMeta, jsonOk, jsonError, runSafetyEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { ValidationError } from "@/shared/errors/application.errors"

export const PATCH: APIRoute = async (context) => {
  const meta = makeMeta()
  const caseId = context.params.id as string

  if (!caseId) {
    return jsonError({ _tag: "ValidationError", message: "Case ID is required" }, meta, HTTP_STATUS.BAD_REQUEST)
  }

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: () => new ValidationError({ issues: "Invalid JSON body" }),
    }),
    Effect.flatMap((body: any): any => {
      if (body.action === "assign") {
        return assignCaseProgram(caseId, body.assigneeId)
      } else if (body.action === "log_attempt") {
        return logFollowupAttemptProgram(caseId, body.notes)
      } else if (body.action === "resolve") {
        return resolveCaseProgram(caseId, body.outcome, body.notes)
      }
      return Effect.fail(new ValidationError({ issues: "Aksi tidak dikenal" }))
    }),
    Effect.map((data) => jsonOk(data, meta)),
    Effect.catchTags({
      ValidationError: (e: any) => Effect.succeed(jsonError({ _tag: e._tag, message: e.issues }, meta, HTTP_STATUS.BAD_REQUEST)),
      UnauthorizedError: (e: any) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
      SafetyUpdateError: (e: any) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
      SafetyFetchError: (e: any) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runSafetyEffect(context, program)
}
