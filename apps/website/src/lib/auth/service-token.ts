import { SignJWT } from "jose"

const SERVICE_JWT_SECRET = import.meta.env.SERVICE_JWT_SECRET || (() => {
  if (typeof process !== "undefined" && process.env?.SERVICE_JWT_SECRET) {
    return process.env.SERVICE_JWT_SECRET
  }
  throw new Error("CRITICAL: SERVICE_JWT_SECRET environment variable is not configured.")
})()

const key = new TextEncoder().encode(SERVICE_JWT_SECRET)
const SERVICE_TOKEN_TTL_SECONDS = 5 * 60

/**
 * Mints a short-lived JWT scoped to one tenant, used for service-to-service
 * calls into memory-fabric's /api/tool. Never sent to a browser.
 */
export async function mintServiceToken(tenantSlug: string): Promise<string> {
  const expirationTime = Math.floor(Date.now() / 1000) + SERVICE_TOKEN_TTL_SECONDS
  return await new SignJWT({ tenantSlug })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("haro-website")
    .setAudience("memory-fabric")
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(key)
}
