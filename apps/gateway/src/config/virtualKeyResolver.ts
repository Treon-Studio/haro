import { kvGet, kvSet } from './kvCrypto';
import { neonQuery } from './neonClient';
import type { GatewayEnv, VirtualKeyRecord, ResolvedVirtualKey } from './types';

const VK_TTL = 60; // 60 seconds TTL (Mitigasi 3: Fast Revocation)
const inFlightRequests = new Map<string, Promise<ResolvedVirtualKey | null>>();

// Import decryption dynamically/inline to avoid circular dependencies
async function decryptKey(encryptedBase64: string, base64Key: string): Promise<string> {
  const getCrypto = (): any => (globalThis as any).crypto;
  const rawKey = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  const cryptoKey = await getCrypto().subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);

  const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await getCrypto().subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext);
  return new TextDecoder().decode(plaintext);
}

export async function resolveVirtualKey(
  slug: string,
  env: GatewayEnv
): Promise<ResolvedVirtualKey | null> {
  if (!slug) return null;

  // 1. KV cache lookup
  const cached = await kvGet<ResolvedVirtualKey>(`vk:${slug}`, env);
  if (cached) return cached;

  // Mitigasi 1: Cache Stampede Protection via Promise Coalescing
  const existingPromise = inFlightRequests.get(slug);
  if (existingPromise) return existingPromise;

  const promise = (async () => {
    try {
      // 2. Query Neon directly
      const rows = await neonQuery<VirtualKeyRecord>(
        'SELECT slug, provider, encrypted_key, rate_limit_rpm, is_active FROM public.gateway_virtual_keys WHERE slug = $1 AND is_active = true LIMIT 1',
        [slug],
        env
      );

      if (!rows.length) return null;
      const vk = rows[0];

      // 3. Decrypt API Key locally (Zero-Knowledge)
      let apiKey: string;
      try {
        apiKey = await decryptKey(vk.encrypted_key, env.KV_ENCRYPTION_KEY);
      } catch (err) {
        // Mitigasi 5: Zero Cryptography Leak
        console.error(`[Security Audit] Decryption failed for VK ${slug}`);
        return null;
      }

      const resolved: ResolvedVirtualKey = {
        provider: vk.provider,
        apiKey,
        rateLimitRpm: vk.rate_limit_rpm,
      };

      // 4. Cache to KV
      await kvSet(`vk:${slug}`, resolved, env, VK_TTL);
      return resolved;
    } finally {
      inFlightRequests.delete(slug);
    }
  })();

  inFlightRequests.set(slug, promise);
  return promise;
}
