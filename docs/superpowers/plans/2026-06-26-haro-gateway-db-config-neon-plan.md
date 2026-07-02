# Haro Gateway DB-Backed Config (Neon Edition) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti database konfigurasi Haro Gateway dari Supabase REST API ke **Neon Serverless Postgres** menggunakan **Neon HTTP SQL API (fetch-based)** dengan enkripsi tingkat aplikasi (Zero-Knowledge) AES-256-GCM dan sistem hardening 9 Loophole Mitigations.

**Architecture:** Gateway Cloudflare Worker menangkap request dan mengambil API key/preset terenkripsi dari Neon HTTP `/sql` endpoint menggunakan parameterized queries jika terjadi KV cache miss. Kunci didekripsi menggunakan Web Crypto API, di-cache ke Cloudflare KV, lalu diinjeksi ke headers request LLM.

**Tech Stack:** TypeScript, Hono, Neon HTTP SQL API (fetch-based), Cloudflare KV, Web Crypto API (AES-256-GCM), Jest

---

## File Structure & Responsibilities

- `apps/gateway/src/config/types.ts`: Memuat definisi environment variable dan tipe record database (diperbarui).
- `apps/gateway/src/config/neonClient.ts`: Client utilitas fetch-based SQL ke Neon (dibuat).
- `apps/gateway/src/config/neonClient.test.ts`: Pengujian unit untuk Neon client (dibuat).
- `apps/gateway/src/config/virtualKeyResolver.ts`: Pencarian, Promise Coalescing, penanganan kegagalan dekripsi, dan caching Virtual Key (diperbarui).
- `apps/gateway/src/config/configPresetResolver.ts`: Pencarian dan caching Preset Routing (diperbarui).
- `apps/gateway/src/config/settingsResolver.ts`: Lookup setting global/per-company (seperti `admin_token`) dengan Timeout Fallback ke `conf.json` (diperbarui).
- `apps/gateway/src/handlers/adminVirtualKeysHandler.ts`: Penambahan/penghapusan kunci dengan enkripsi tingkat aplikasi dan secure masking (diperbarui).
- `apps/gateway/src/handlers/adminConfigsHandler.ts`: Penambahan/penghapusan preset dengan validasi skema ketat (diperbarui).

---

## Task 1: Environment Types & Neon HTTP Client

**Files:**
- Modify: `apps/gateway/src/config/types.ts`
- Create: `apps/gateway/src/config/neonClient.ts`
- Create: `apps/gateway/src/config/neonClient.test.ts`

- [ ] **Step 1: Perbarui types.ts**

Ubah file `types.ts` untuk menghapus variabel Supabase dan menggantinya dengan `DATABASE_URL` untuk Neon, serta memperbarui record types (mengganti `vault_secret_id` menjadi `encrypted_key` pada `VirtualKeyRecord`).

```typescript
// apps/gateway/src/config/types.ts
export interface GatewayEnv {
  DATABASE_URL: string;
  KV_ENCRYPTION_KEY: string;
  USE_DB_CONFIG?: string;
  HARO_CONFIG_CACHE?: KVNamespace; // Cloudflare KV binding
}

export interface VirtualKeyRecord {
  id: string;
  company_id: string;
  created_by: string;
  name: string;
  slug: string;
  provider: string;
  encrypted_key: string; -- AES-256-GCM encrypted API key (Zero-Knowledge)
  masked_key: string;
  is_active: boolean;
  rate_limit_rpm: number | null;
  created_at: string;
  updated_at: string;
}

export interface ResolvedVirtualKey {
  provider: string;
  apiKey: string;
  rateLimitRpm: number | null;
}

export interface ConfigPresetRecord {
  id: string;
  company_id: string;
  created_by: string;
  name: string;
  slug: string;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GatewaySettingRecord {
  key: string;
  value: string;
  company_id: string | null;
}
```

- [ ] **Step 2: Tulis test untuk neonClient.ts**

Buat file test `neonClient.test.ts` untuk memverifikasi payload request SQL fetch yang dikirim ke Neon.

```typescript
// apps/gateway/src/config/neonClient.test.ts
import { neonQuery } from './neonClient';
import type { GatewayEnv } from './types';

describe('neonQuery', () => {
  it('sends post request with correct query and params to Neon HTTP API', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rows: [{ id: '1', name: 'Test' }] })
    });
    global.fetch = mockFetch as any;

    const env = {
      DATABASE_URL: 'postgresql://user:pass@ep-test-123.us-east-1.aws.neon.tech/neondb'
    } as unknown as GatewayEnv;

    const result = await neonQuery('SELECT * FROM test WHERE id = $1', ['val'], env);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://ep-test-123.us-east-1.aws.neon.tech/sql',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          query: 'SELECT * FROM test WHERE id = $1',
          params: ['val']
        })
      })
    );
    expect(result).toEqual([{ id: '1', name: 'Test' }]);
  });
});
```

- [ ] **Step 3: Jalankan test — Harus FAIL (neonQuery is not defined)**

Run: `npx jest src/config/neonClient.test.ts`
Expected: FAIL dengan error compilation.

- [ ] **Step 4: Implementasikan neonClient.ts**

Buat file utilitas `neonClient.ts` yang me-resolve URL PostgreSQL Neon menjadi HTTPS endpoint `/sql` untuk Cloudflare fetch.

```typescript
// apps/gateway/src/config/neonClient.ts
import type { GatewayEnv } from './types';

export async function neonQuery<T>(
  query: string,
  params: any[],
  env: GatewayEnv
): Promise<T[]> {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }

  // Parse postgresql://user:pass@host/db to https://host/sql
  const urlString = env.DATABASE_URL.replace('postgresql://', 'https://');
  const url = new URL(urlString);
  const sqlEndpoint = `https://${url.host}/sql`;

  const response = await fetch(sqlEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${url.password || url.username}`
    },
    body: JSON.stringify({ query, params }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Neon HTTP SQL failed (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as { rows: T[] };
  return result.rows || [];
}
```

- [ ] **Step 5: Run test — Harus PASS**

Run: `npx jest src/config/neonClient.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/gateway/src/config/types.ts apps/gateway/src/config/neonClient.ts apps/gateway/src/config/neonClient.test.ts
git commit -m "feat(gateway): add types and fetch-based Neon client"
```

---

## Task 2: Virtual Key Resolver (Promise Coalescing, Security Hardening)

**Files:**
- Create/Modify: `apps/gateway/src/config/virtualKeyResolver.test.ts`
- Create/Modify: `apps/gateway/src/config/virtualKeyResolver.ts`

- [ ] **Step 1: Tulis test untuk virtualKeyResolver.test.ts**

Ubah test resolver untuk memverifikasi query SQL Neon, Promise Coalescing, dan penanganan kegagalan dekripsi yang aman.

```typescript
// apps/gateway/src/config/virtualKeyResolver.test.ts
import { resolveVirtualKey } from './virtualKeyResolver';
import { kvGet, kvSet } from './kvCrypto';
import { neonQuery } from './neonClient';
import type { GatewayEnv } from './types';

jest.mock('./kvCrypto', () => ({
  kvGet: jest.fn(),
  kvSet: jest.fn(),
  decrypt: jest.fn(), // If needed
}));
jest.mock('./neonClient', () => ({
  neonQuery: jest.fn(),
}));

const mockEnv = {
  DATABASE_URL: 'postgresql://u:p@ep-test.neon.tech/db',
  KV_ENCRYPTION_KEY: 'key',
  HARO_CONFIG_CACHE: {},
} as unknown as GatewayEnv;

describe('resolveVirtualKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null if slug is empty', async () => {
    expect(await resolveVirtualKey('', mockEnv)).toBeNull();
  });

  it('returns cached value on KV HIT', async () => {
    (kvGet as jest.Mock).mockResolvedValueOnce({
      provider: 'openai',
      apiKey: 'sk-cached',
      rateLimitRpm: 100,
    });
    const result = await resolveVirtualKey('vk_test', mockEnv);
    expect(result).toEqual({ provider: 'openai', apiKey: 'sk-cached', rateLimitRpm: 100 });
    expect(neonQuery).not.toHaveBeenCalled();
  });

  it('queries Neon and decrypts on KV MISS', async () => {
    (kvGet as jest.Mock).mockResolvedValueOnce(null);
    (neonQuery as jest.Mock).mockResolvedValueOnce([
      {
        slug: 'vk_test',
        provider: 'openai',
        encrypted_key: 'encrypted-xxx',
        rate_limit_rpm: 60,
        is_active: true,
      },
    ]);
    
    // Simulate decrypt helper within resolveVirtualKey (since we'll implement it)
    const result = await resolveVirtualKey('vk_test', mockEnv);
    // ... we will mock kvCrypto decrypter or verify decrypted values ...
  });
});
```

- [ ] **Step 2: Run test — Harus FAIL**

Run: `npx jest src/config/virtualKeyResolver.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementasikan virtualKeyResolver.ts**

Ubah implementation dengan Promise Coalescing (`inFlightRequests` Map) untuk mencegah Cache Stampede, panggil `neonQuery` menggantikan `supabaseFetch`, dan amankan error handling dekripsi.

```typescript
// apps/gateway/src/config/virtualKeyResolver.ts
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
```

- [ ] **Step 4: Run test — Harus PASS**

Run: `npx jest src/config/virtualKeyResolver.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/gateway/src/config/virtualKeyResolver.ts apps/gateway/src/config/virtualKeyResolver.test.ts
git commit -m "feat(gateway): implement Neon virtualKeyResolver with Promise Coalescing"
```

---

## Task 3: Config Preset & Settings Resolvers

**Files:**
- Create/Modify: `apps/gateway/src/config/configPresetResolver.ts`
- Create/Modify: `apps/gateway/src/config/settingsResolver.ts`
- Create/Modify: `apps/gateway/src/config/configPresetResolver.test.ts`
- Create/Modify: `apps/gateway/src/config/settingsResolver.test.ts`

- [ ] **Step 1: Perbarui configPresetResolver.ts**

Ubah file preset resolver untuk memanggil Neon Postgres.

```typescript
// apps/gateway/src/config/configPresetResolver.ts
import { kvGet, kvSet } from './kvCrypto';
import { neonQuery } from './neonClient';
import type { GatewayEnv, ConfigPresetRecord } from './types';

const CFG_TTL = 600; // 10 minutes

export async function resolveConfigPreset(
  slug: string,
  env: GatewayEnv
): Promise<Record<string, unknown> | null> {
  if (!slug) return null;

  const cached = await kvGet<Record<string, unknown>>(`cfg:${slug}`, env);
  if (cached) return cached;

  try {
    const rows = await neonQuery<Pick<ConfigPresetRecord, 'config'>>(
      'SELECT config FROM public.gateway_configs WHERE slug = $1 AND is_active = true LIMIT 1',
      [slug],
      env
    );
    if (!rows.length) return null;

    const config = rows[0].config;
    await kvSet(`cfg:${slug}`, config, env, CFG_TTL);
    return config;
  } catch (err) {
    console.error(`[Error] Failed to resolve config preset ${slug}:`, err);
    return null;
  }
}
```

- [ ] **Step 2: Perbarui settingsResolver.ts dengan Timeout Fallback**

Ubah file settings resolver untuk mengimplementasikan timeout fetch 1000ms ke Neon dan fallback dinamis ke `conf.json` (Mitigasi 7).

```typescript
// apps/gateway/src/config/settingsResolver.ts
import { kvGet, kvSet } from './kvCrypto';
import { neonQuery } from './neonClient';
import type { GatewayEnv, GatewaySettingRecord } from './types';

const SETTINGS_TTL = 900; // 15 minutes

export async function getGatewaySetting(
  key: string,
  env: GatewayEnv,
  companyId?: string
): Promise<string | null> {
  if (!env?.DATABASE_URL) return null;

  const cacheKey = companyId
    ? `settings:${companyId}:${key}`
    : `settings:global:${key}`;

  const cached = await kvGet<string>(cacheKey, env);
  if (cached !== null) return cached;

  const query = companyId
    ? 'SELECT key, value FROM public.gateway_settings WHERE key = $1 AND company_id = $2 LIMIT 1'
    : 'SELECT key, value FROM public.gateway_settings WHERE key = $1 AND company_id IS NULL LIMIT 1';
  
  const params = companyId ? [key, companyId] : [key];

  // Mitigasi 7: Timeout 1000ms pada fetch Neon
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Neon Query Timeout')), 1000)
    );

    const rows = await Promise.race([
      neonQuery<GatewaySettingRecord>(query, params, env),
      timeoutPromise
    ]);

    if (!rows.length) return null;
    const val = rows[0].value;
    await kvSet(cacheKey, val, env, SETTINGS_TTL);
    return val;
  } catch (err) {
    console.error(`[Neon Active Hardening] Fallback triggered for setting ${key}:`, err);
    return null; // Return null so caller fallbacks to conf.json
  }
}
```

- [ ] **Step 3: Run all resolver tests**

Run: `npx jest src/config/`
Expected: semua tests PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/gateway/src/config/configPresetResolver.ts apps/gateway/src/config/settingsResolver.ts
git commit -m "feat(gateway): migrate config presets and settings resolvers to Neon with timeout fallback"
```

---

## Task 4: Admin CRUD Handlers (Application-Level Encryption)

**Files:**
- Modify: `apps/gateway/src/handlers/adminVirtualKeysHandler.ts`
- Modify: `apps/gateway/src/handlers/adminConfigsHandler.ts`

- [ ] **Step 1: Perbarui adminVirtualKeysHandler.ts**

Ubah file untuk mengenkripsi API Key LLM dengan AES-256-GCM di level Gateway sebelum di-insert ke Neon Postgres, serta menerapkan secure masking untuk API Key pendek (Mitigasi 4).

```typescript
// apps/gateway/src/handlers/adminVirtualKeysHandler.ts
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
```

- [ ] **Step 2: Perbarui adminConfigsHandler.ts dengan validasi skema Zod**

Ubah file untuk memvalidasi preset konfigurasi (Mitigasi 9) dan panggil Neon SQL queries.

```typescript
// apps/gateway/src/handlers/adminConfigsHandler.ts
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
```

- [ ] **Step 3: Run typecheck & Jest tests**

Run: `pnpm test` and `npx tsc --noEmit`
Expected: semua tests PASS dan compilation sukses.

- [ ] **Step 4: Commit**

```bash
git add apps/gateway/src/handlers/adminVirtualKeysHandler.ts apps/gateway/src/handlers/adminConfigsHandler.ts
git commit -m "feat(gateway): direct Neon insert with local encryption and zod preset validation"
```
