import { Context } from 'hono';
import { kvDel } from '../config/kvCrypto';
import type { GatewayEnv } from '../config/types';

export const invalidateCacheHandler = async (c: Context) => {
  const env = c.env as GatewayEnv;
  let body: { key: string };
  try { body = await c.req.json(); } catch {
    return c.json({ error: 'Invalid JSON body. Expected { key: string }' }, 400);
  }
  if (!body.key) return c.json({ error: 'key is required' }, 400);
  await kvDel(body.key, env);
  return c.json({ invalidated: body.key });
};
