import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { updateCompanyMemberProgram, removeCompanyMemberProgram } from "@/domain/companies/companies.programs"
import { makeMeta, jsonOk, jsonError, runCompaniesEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { ValidationError } from "@/shared/errors/application.errors"

export const PATCH: APIRoute = async (context) => {
  const meta = makeMeta()
  const membershipId = context.params.memberId

  if (!membershipId) {
    return jsonError({ _tag: "ValidationError", message: "Membership ID is required" }, meta, HTTP_STATUS.BAD_REQUEST)
  }

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: () => new ValidationError({ issues: "Invalid JSON body" }),
    }),
    Effect.flatMap((body) => {
      if (typeof body !== "object" || body === null) {
        return Effect.fail(new ValidationError({ issues: "Body must be an object" }))
      }
      return Effect.succeed({ ...body, membershipId })
    }),
    Effect.flatMap(updateCompanyMemberProgram),
    Effect.map((data) => jsonOk(data, meta)),
    Effect.catchTags({
      ValidationError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.issues }, meta, HTTP_STATUS.BAD_REQUEST)),
      UnauthorizedError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
      CompanyMembershipError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runCompaniesEffect(context, program)
}

export const DELETE: APIRoute = async (context) => {
  const meta = makeMeta()
  const membershipId = context.params.memberId

  if (!membershipId) {
    return jsonError({ _tag: "ValidationError", message: "Membership ID is required" }, meta, HTTP_STATUS.BAD_REQUEST)
  }

  const program = pipe(
    removeCompanyMemberProgram(membershipId),
    Effect.map(() => jsonOk({ success: true }, meta)),
    Effect.catchTags({
      UnauthorizedError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
      CompanyMembershipError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runCompaniesEffect(context, program)
}
