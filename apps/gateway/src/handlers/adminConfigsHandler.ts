import { Context } from 'hono';
import { neonQuery } from '../config/neonClient';
import { kvDel } from '../config/kvCrypto';
import type { GatewayEnv } from '../config/types';
import { z } from 'zod';

const getCrypto = (): any => (globalThis as any).crypto;

function generateSlug(prefix: string): string {
  const arr = new Uint8Array(4);
  getCrypto().getRandomValues(arr);
  return prefix + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Mitigasi 9: Zod Schema Validation
const ConfigPresetSchema = z.object({
  company_id: z.string().uuid(),
  name: z.string().min(1),
  config: z.record(z.any()),
  created_by: z.string().uuid().optional(),
});

export const listConfigsHandler = async (c: Context) => {
  const env = c.env as GatewayEnv;
  const companyId = c.req.query('company_id');
  try {
    const query = companyId
      ? 'SELECT id, name, slug, config, is_active, created_at FROM public.gateway_configs WHERE company_id = $1 AND is_active = true ORDER BY created_at DESC'
      : 'SELECT id, name, slug, config, is_active, created_at FROM public.gateway_configs WHERE is_active = true ORDER BY created_at DESC';
    const params = companyId ? [companyId] : [];
    const rows = await neonQuery(query, params, env);
    return c.json(rows, 200);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};

export const createConfigHandler = async (c: Context) => {
  const env = c.env as GatewayEnv;
  let rawBody: any;
  try { rawBody = await c.req.json(); } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  // Strict Validation
  const result = ConfigPresetSchema.safeParse(rawBody);
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.format() }, 400);
  }
  const body = result.data;

  try {
    const slug = generateSlug('cfg_');
    const createdBy = body.created_by || body.company_id;

    await neonQuery(
      'INSERT INTO public.gateway_configs (company_id, created_by, name, slug, config) VALUES ($1, $2, $3, $4, $5)',
      [body.company_id, createdBy, body.name, slug, JSON.stringify(body.config)],
      env
    );

    return c.json({ slug }, 201);
  } catch (err: any) {
    return c.json({ error: 'Failed to create config preset: ' + err.message }, 500);
  }
};

export const deleteConfigHandler = async (c: Context) => {
  const env = c.env as GatewayEnv;
  const slug = c.req.param('slug');
  try {
    await neonQuery(
      'UPDATE public.gateway_configs SET is_active = false, updated_at = NOW() WHERE slug = $1',
      [slug],
      env
    );
    await kvDel(`cfg:${slug}`, env);
    return c.json({ deactivated: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};
