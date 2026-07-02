import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { createSupportTicketProgram, getSupportTicketsProgram } from "@/domain/company-admin-ops/company-admin-ops.programs"
import { makeMeta, jsonOk, jsonError, runCompanyAdminOpsEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { ValidationError } from "@/shared/errors/application.errors"

export const GET: APIRoute = async (context) => {
  const meta = makeMeta()
  const companyId = context.params.id as string

  if (!companyId) {
    return jsonError({ _tag: "ValidationError", message: "Company ID is required" }, meta, HTTP_STATUS.BAD_REQUEST)
  }

  const program = pipe(
    getSupportTicketsProgram(companyId),
    Effect.map((data) => jsonOk(data, meta)),
    Effect.catchTags({
      UnauthorizedError: (e: any) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
      AdminOpsFetchError: (e: any) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runCompanyAdminOpsEffect(context, program)
}

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
      if (!body.subject || !body.description || !body.priority) {
        return Effect.fail(new ValidationError({ issues: "subject, description, and priority are required" }))
      }
      return createSupportTicketProgram(companyId, body.subject, body.description, body.priority)
    }),
    Effect.map((data) => jsonOk(data, meta, HTTP_STATUS.CREATED)),
    Effect.catchTags({
      ValidationError: (e: any) => Effect.succeed(jsonError({ _tag: e._tag, message: e.issues }, meta, HTTP_STATUS.BAD_REQUEST)),
      UnauthorizedError: (e: any) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
      AdminOpsUpdateError: (e: any) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runCompanyAdminOpsEffect(context, program)
}
