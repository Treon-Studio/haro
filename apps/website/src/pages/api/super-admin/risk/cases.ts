import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { getEscalationCasesProgram } from "@/domain/safety/safety.programs"
import { makeMeta, jsonOk, jsonError, runSafetyEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"

export const GET: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    getEscalationCasesProgram(),
    Effect.map((data) => jsonOk(data, meta)),
    Effect.catchAll((err: any) => Effect.succeed(jsonError({ _tag: "SafetyError", message: err.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR))),
  )

  return await runSafetyEffect(context, program)
}
