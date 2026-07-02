import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { getBillingInfoProgram } from "@/domain/billing/billing.programs"
import { makeMeta, jsonOk, jsonError, runBillingEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"

export const GET: APIRoute = async (context) => {
  const meta = makeMeta()
  const companyId = context.params.id

  if (!companyId) {
    return jsonError({ _tag: "ValidationError", message: "Company ID is required" }, meta, HTTP_STATUS.BAD_REQUEST)
  }

  const program = pipe(
    getBillingInfoProgram(companyId),
    Effect.map((data) => jsonOk(data, meta)),
    Effect.catchTags({
      UnauthorizedError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
      BillingFetchError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runBillingEffect(context, program)
}
