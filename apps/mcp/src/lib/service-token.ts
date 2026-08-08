import { SignJWT } from 'jose';

const SERVICE_TOKEN_TTL_SECONDS = 5 * 60;

export async function mintServiceToken(tenantSlug: string, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret);
  const expirationTime = Math.floor(Date.now() / 1000) + SERVICE_TOKEN_TTL_SECONDS;
  return await new SignJWT({ tenantSlug })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('haro-mcp')
    .setAudience('memory-fabric')
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(key);
}
