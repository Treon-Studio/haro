import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { getAllAgentsProgram, createAgentProgram } from "@/domain/agents/index"
import { makeMeta, jsonOk, jsonError, runAgentsEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"

export const GET: APIRoute = async (context) => {
  const meta = makeMeta()
  const url = new URL(context.request.url)
  const companyId = url.searchParams.get("companyId")

  const program = pipe(
    getAllAgentsProgram(companyId),
    Effect.map((data) => jsonOk(data, meta)),
    Effect.catchTags({
      AgentFetchError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: String((e as any).cause) }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runAgentsEffect(context, program)
}

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: (e) => ({ _tag: 'ValidationError', message: "Invalid JSON body" }),
    }),
    Effect.flatMap(createAgentProgram),
    Effect.map((data) => jsonOk(data, meta, HTTP_STATUS.CREATED)),
    Effect.catchTags({
      ValidationError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.BAD_REQUEST)),
      AgentCreateError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: String((e as any).cause) }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runAgentsEffect(context, program)
}
