import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { getBrandingProgram, updateBrandingProgram } from "@/domain/branding/branding.programs"
import { makeMeta, jsonOk, jsonError, runBrandingEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { ValidationError } from "@/shared/errors/application.errors"

export const GET: APIRoute = async (context) => {
  const meta = makeMeta()
  const companyId = context.params.id

  if (!companyId) {
    return jsonError({ _tag: "ValidationError", message: "Company ID is required" }, meta, HTTP_STATUS.BAD_REQUEST)
  }

  const program = pipe(
    getBrandingProgram(companyId),
    Effect.map((data) => jsonOk(data, meta)),
    Effect.catchTags({
      UnauthorizedError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
      BrandingFetchError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runBrandingEffect(context, program)
}

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()
  const companyId = context.params.id

  if (!companyId) {
    return jsonError({ _tag: "ValidationError", message: "Company ID is required" }, meta, HTTP_STATUS.BAD_REQUEST)
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
      return Effect.succeed({ ...body, companyId })
    }),
    Effect.flatMap(updateBrandingProgram),
    Effect.map((data) => jsonOk(data, meta, HTTP_STATUS.OK)),
    Effect.catchTags({
      ValidationError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.issues }, meta, HTTP_STATUS.BAD_REQUEST)),
      UnauthorizedError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
      BrandingUpdateError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runBrandingEffect(context, program)
}
