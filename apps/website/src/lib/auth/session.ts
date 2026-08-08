import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { query } from "@/lib/neon/client";

// Load JWT_SECRET from environment variables, fail fast if missing
const JWT_SECRET = import.meta.env.JWT_SECRET || (() => {
  if (typeof process !== "undefined" && process.env?.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  throw new Error("CRITICAL: JWT_SECRET environment variable is not configured. Session management cannot start.");
})();

const key = new TextEncoder().encode(JWT_SECRET);

export interface SessionPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Signs a session payload into a symmetric JWT
 */
export async function signSession(
  payload: SessionPayload,
  expiresInSeconds: number
): Promise<string> {
  const expirationTime = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(key);
}

/**
 * Verifies a symmetric JWT session token and returns the payload, or null if invalid/expired
 */
export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
    });

    if (
      payload &&
      typeof payload === "object" &&
      typeof payload.userId === "string" &&
      typeof payload.email === "string" &&
      typeof payload.role === "string"
    ) {
      return {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      };
    }

    return null;
  } catch (error) {
    // Gracefully handle invalid or expired tokens
    console.warn(
      "Session verification failed:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/**
 * Resolves tenant information for a session from the DB.
 * Looks up the user's active company membership and returns the linked tenant slug.
 * Falls back to "default" when no membership is found.
 */
export async function getTenantForSession(
  session: { userId: string } | null,
): Promise<{ tenantSlug: string; companyId?: string }> {
  if (!session?.userId) {
    return { tenantSlug: "default" };
  }

  try {
    const result = await query`
      SELECT t.slug AS tenant_slug, cm.company_id
      FROM company_memberships cm
      JOIN tenants t ON t.company_id = cm.company_id
      WHERE cm.user_id = ${session.userId} AND cm.status = 'active'
      LIMIT 1
    `;

    if (result.rowCount > 0 && result.rows[0]) {
      const row = result.rows[0];
      return {
        tenantSlug: row.tenant_slug as string,
        companyId: row.company_id as string,
      };
    }
  } catch (err) {
    console.warn(
      "Failed to resolve tenant for session:",
      err instanceof Error ? err.message : err,
    );
  }

  return { tenantSlug: "default" };
}

/**
 * Hashes a plaintext password using bcryptjs with 10 salt rounds
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Compares a plaintext password with a bcryptjs hash
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
