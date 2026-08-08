import { Context } from 'hono';
import { neonQuery } from '../config/neonClient';
import { kvDel } from '../config/kvCrypto';
import type { GatewayEnv } from '../config/types';

const getCrypto = (): any => (globalThis as any).crypto;

function generateSlug(prefix: string): string {
  const arr = new Uint8Array(4);
  getCrypto().getRandomValues(arr);
  return prefix + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function encryptKey(plaintext: string, base64Key: string): Promise<string> {
  const rawKey = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  const cryptoKey = await getCrypto().subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']);
  const iv = getCrypto().getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await getCrypto().subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encoded);

  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

export const listVirtualKeysHandler = async (c: Context) => {
  const env = c.env as GatewayEnv;
  const companyId = c.req.query('company_id');
  try {
    const query = companyId 
      ? 'SELECT id, name, slug, provider, masked_key, is_active, rate_limit_rpm, created_at FROM public.gateway_virtual_keys WHERE company_id = $1 ORDER BY created_at DESC'
      : 'SELECT id, name, slug, provider, masked_key, is_active, rate_limit_rpm, created_at FROM public.gateway_virtual_keys ORDER BY created_at DESC';
    const params = companyId ? [companyId] : [];
    const rows = await neonQuery(query, params, env);
    return c.json(rows, 200);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};

export const createVirtualKeyHandler = async (c: Context) => {
  const env = c.env as GatewayEnv;
  let body: { company_id: string; name: string; provider: string; apiKey: string; rate_limit_rpm?: number; created_by?: string };
  try { body = await c.req.json(); } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  if (!body.company_id || !body.name || !body.provider || !body.apiKey) {
    return c.json({ error: 'Required: company_id, name, provider, apiKey' }, 400);
  }

  try {
    // 1. Encrypt API key locally (AES-256-GCM)
    const encrypted_key = await encryptKey(body.apiKey, env.KV_ENCRYPTION_KEY);

    // Mitigasi 4: Secure Masking
    const masked_key = body.apiKey.length > 8
      ? `...${body.apiKey.slice(-4)}`
      : `...${body.apiKey.slice(-2)}`;

    const slug = generateSlug('vk_');
    const createdBy = body.created_by || body.company_id; // Profiles reference

    // 2. Insert directly to Neon
    await neonQuery(
      'INSERT INTO public.gateway_virtual_keys (company_id, created_by, name, slug, provider, encrypted_key, masked_key, rate_limit_rpm) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [body.company_id, createdBy, body.name, slug, body.provider, encrypted_key, masked_key, body.rate_limit_rpm ?? null],
      env
    );

    return c.json({ slug, masked_key, provider: body.provider }, 201);
  } catch (err: any) {
    return c.json({ error: 'Failed to create virtual key: ' + err.message }, 500);
  }
};

export const deleteVirtualKeyHandler = async (c: Context) => {
  const env = c.env as GatewayEnv;
  const slug = c.req.param('slug');
  try {
    await neonQuery(
      'UPDATE public.gateway_virtual_keys SET is_active = false, updated_at = NOW() WHERE slug = $1',
      [slug],
      env
    );
    await kvDel(`vk:${slug}`, env);
    return c.json({ deactivated: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};
