import { Effect, pipe, Data } from "effect"
import type { APIRoute } from "astro"
import { signUpProgram } from "@/domain/auth/auth.programs"
import { makeMeta, jsonOk, jsonError, runAuthEffect } from "@/lib/api-helpers"
import { HTTP_STATUS } from "@/shared/constants/api.constants"
import { ValidationError } from "@/shared/errors/application.errors"

const MANAGEMENT_API_KEY = import.meta.env.MANAGEMENT_API_KEY || ""
const PROVISIONING_URL = import.meta.env.MEMORY_FABRIC_URL
  ? `${import.meta.env.MEMORY_FABRIC_URL.replace(/\/$/, "")}/api/tenants/provision`
  : "https://haro-proxy.treonstudio.com/api/tenants/provision"

export class TenantProvisioningError extends Data.TaggedError("TenantProvisioningError")<{
  readonly message: string
}> {}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
}

async function provisionTenant(
  company: { id: string; name: string },
  userId: string,
): Promise<void> {
  if (!MANAGEMENT_API_KEY) return

  const slug = slugify(company.name)

  let res: Response
  try {
    res = await fetch(PROVISIONING_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MANAGEMENT_API_KEY}`,
      },
      body: JSON.stringify({ slug, name: company.name, company_id: company.id, created_by: userId, plan: "free" }),
    })
  } catch (err) {
    throw new TenantProvisioningError({
      message: err instanceof Error ? err.message : "Tenant provisioning error (VPS unreachable?)",
    })
  }

  if (res.ok) {
    const data = await res.json()
    console.log("Tenant provisioned:", data.data.slug)
    return
  }

  const err = await res.json().catch(() => ({}) as any)

  // The invited-signup case may race another invitee (or the inviter) who
  // already provisioned this company's tenant — that's success, not a failure.
  if (res.status === HTTP_STATUS.CONFLICT && err?.error?.code === "TENANT_SLUG_EXISTS") {
    console.log("Tenant already provisioned, skipping duplicate:", slug)
    return
  }

  console.error("Tenant provisioning failed:", err)
  throw new TenantProvisioningError({
    message: err?.error?.message || `Tenant provisioning failed (${res.status})`,
  })
}

// Decides which tenant to provision for a freshly created auth account:
// - invited signup (signUpProgram surfaced a company_id from the accepted
//   invitation) -> join the inviter's real company tenant
// - organic signup -> provision a personal tenant keyed to the new user.id
async function provisionSignupTenant(data: {
  readonly user: { readonly id: string; readonly full_name: string; readonly email: string }
  readonly company_id?: string
  readonly company_name?: string
}): Promise<void> {
  if (data.company_id) {
    await provisionTenant(
      { id: data.company_id, name: data.company_name || data.company_id },
      data.user.id,
    )
    return
  }

  await provisionTenant(
    { id: data.user.id, name: data.user.full_name || data.user.email },
    data.user.id,
  )
}

export const POST: APIRoute = async (context) => {
  const meta = makeMeta()

  const program = pipe(
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: () => new ValidationError({ issues: "Invalid JSON body" }),
    }),
    Effect.flatMap(signUpProgram),
    // Provisioning blocks signup completion: if it fails, the whole request
    // fails loudly instead of silently leaving the user without a tenant.
    Effect.tap((data) =>
      Effect.tryPromise({
        try: () => provisionSignupTenant(data),
        catch: (err) =>
          err instanceof TenantProvisioningError
            ? err
            : new TenantProvisioningError({
                message: err instanceof Error ? err.message : "Tenant provisioning failed",
              }),
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
      TenantProvisioningError: (e) =>
        Effect.succeed(
          jsonError({ _tag: e._tag, message: e.message }, meta, HTTP_STATUS.INTERNAL_SERVER_ERROR),
        ),
    }),
  )

  const result = await runAuthEffect(context, program)
  return result
}
