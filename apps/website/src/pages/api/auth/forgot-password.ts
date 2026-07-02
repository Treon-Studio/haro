import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { forgotPasswordProgram } from "@/domain/auth/auth.programs"
import { makeMeta, jsonOk, runAuthEffect } from "@/lib/api-helpers"
import { ValidationError } from "@/shared/errors/application.errors"

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: () => new ValidationError({ issues: "Invalid JSON body" }),
    }),
    Effect.flatMap(forgotPasswordProgram),
    Effect.catchAll(() => Effect.succeed(null)),
    Effect.map(() => jsonOk({ message: "Jika email terdaftar, tautan reset telah dikirim" }, meta)),
  )

  const result = await runAuthEffect(context, program)
  return result
}
