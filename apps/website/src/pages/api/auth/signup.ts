import { Effect, pipe } from "effect"
import type { APIRoute } from "astro"
import { signUpProgram } from "@/domain/auth/auth.programs"
import { makeMeta, jsonOk, jsonError, runAuthEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { ValidationError } from "@/shared/errors/application.errors"

const MANAGEMENT_API_KEY = import.meta.env.MANAGEMENT_API_KEY || ""
const PROVISIONING_URL = import.meta.env.MEMORY_FABRIC_URL
  ? `${import.meta.env.MEMORY_FABRIC_URL.replace(/\/$/, "")}/api/tenants/provision`
  : "https://haro-proxy.treonstudio.com/api/tenants/provision"

async function provisionTenant(
  company: { id: string; name: string },
  userId: string,
): Promise<void> {
  if (!MANAGEMENT_API_KEY) return

  const slug = company.name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)

  try {
    const res = await fetch(PROVISIONING_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MANAGEMENT_API_KEY}`,
      },
      body: JSON.stringify({ slug, name: company.name, company_id: company.id, created_by: userId, plan: "free" }),
    })
    if (!res.ok) {
      const err = await res.json()
      console.error("Tenant provisioning failed:", err)
      return
    }
    const data = await res.json()
    console.log("Tenant provisioned:", data.data.slug)
  } catch (err) {
    console.error("Tenant provisioning error (VPS unreachable?):", err)
  }
}

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: () => new ValidationError({ issues: "Invalid JSON body" }),
    }),
    Effect.flatMap(signUpProgram),
    Effect.tap((data) =>
      Effect.tryPromise({
        try: () => provisionTenant(
          { id: data.user.id, name: data.user.full_name || data.user.email },
          data.user.id,
        ),
        catch: () => {},
      }),
    ),
    Effect.map((data) => jsonOk(data, meta, HTTP_STATUS.CREATED)),
    Effect.catchTags({
      ValidationError: (e) =>
        Effect.succeed(
          jsonError({ _tag: e._tag, message: e.issues }, meta, HTTP_STATUS.BAD_REQUEST),
        ),
      EmailAlreadyRegisteredError: (e) =>
        Effect.succeed(
          jsonError(
            { _tag: e._tag, message: "Email sudah terdaftar" },
            meta,
            HTTP_STATUS.CONFLICT,
          ),
        ),
      AuthProviderError: (e) =>
        Effect.succeed(
          jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.BAD_REQUEST),
        ),
    }),
  )

  const result = await runAuthEffect(context, program)
  return result
}
