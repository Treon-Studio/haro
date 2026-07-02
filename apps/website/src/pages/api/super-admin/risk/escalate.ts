import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { flagRiskProgram } from "@/domain/safety/safety.programs"
import { makeMeta, jsonOk, jsonError, runSafetyEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: () => new Error("Invalid JSON body"),
    }),
    Effect.flatMap((body: any) =>
      flagRiskProgram(body.userId, body.companyId, body.sessionId, body.tier, body.summary, body.trigger)
    ),
    Effect.map((data) => jsonOk(data, meta, HTTP_STATUS.CREATED)),
    Effect.catchAll((err: any) => Effect.succeed(jsonError({ _tag: "SafetyError", message: err.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR))),
  )

  return await runSafetyEffect(context, program)
}
