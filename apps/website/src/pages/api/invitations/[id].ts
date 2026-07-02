import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { revokeInvitationProgram } from "@/domain/invitations/invitations.programs"
import { makeMeta, jsonOk, jsonError, runInvitationsEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"

export const DELETE: APIRoute = async (context) => {
  const meta = makeMeta()
  const id = context.params.id

  if (!id) {
    return jsonError({ _tag: "ValidationError", message: "Invitation ID is required" }, meta, HTTP_STATUS.BAD_REQUEST)
  }

  const program = pipe(
    revokeInvitationProgram(id),
    Effect.map(() => jsonOk({ success: true }, meta)),
    Effect.catchTags({
      UnauthorizedError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.UNAUTHORIZED)),
      InvitationAcceptError: (e) => Effect.succeed(jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR)),
    }),
  )

  return await runInvitationsEffect(context, program)
}
