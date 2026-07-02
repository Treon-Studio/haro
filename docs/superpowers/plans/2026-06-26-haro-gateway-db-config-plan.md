# Haro Gateway DB-Backed Config — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pindahkan seluruh gateway config dari `conf.json` ke Supabase dengan Cloudflare KV sebagai cache layer, mengimplementasikan Virtual Keys dan Config Presets per-tenant.

**Architecture:** Gateway Cloudflare Worker intercept headers `x-haro-virtual-key` dan `x-haro-config-id`, resolve dari Cloudflare KV (cache hit) atau Supabase REST API (cache miss), lalu inject credentials asli ke request sebelum diteruskan ke LLM provider.

**Tech Stack:** TypeScript, Hono (existing), Supabase REST API (fetch-based, no SDK), Cloudflare KV, Web Crypto API (AES-256-GCM), Supabase Vault (pg_vault), Vitest

## Global Constraints

- Runtime: Cloudflare Workers (`workerd`) dan Node.js — semua kode harus compatible
- Tidak boleh import `node:crypto` — gunakan Web Crypto API (`globalThis.crypto`)
- Tidak boleh tambah npm SDK Supabase — gunakan `fetch` ke Supabase REST API langsung
- File gateway ada di `apps/gateway/src/`
- Migrations ada di `apps/website/supabase/migrations/`
- Naming convention migration: `YYYYMMDDHHMMSS_<name>.sql`, nomor urut setelah `20260624000013`
- `conf.json` tetap sebagai fallback — jangan hapus
- Env vars baru: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `KV_ENCRYPTION_KEY`, `USE_DB_CONFIG`
- Header baru: `x-haro-virtual-key` (slug VK), `x-haro-config-id` (slug Config Preset)
- Slug format: VK = `vk_` + 8 hex chars; Config = `cfg_` + 8 hex chars

---

## Task 1: Supabase Migrations — Tiga Tabel Config

**Files:**
- Create: `apps/website/supabase/migrations/20260626000001_create_gateway_settings.sql`
- Create: `apps/website/supabase/migrations/20260626000002_create_gateway_virtual_keys.sql`
- Create: `apps/website/supabase/migrations/20260626000003_create_gateway_configs.sql`

**Interfaces:**
- Produces:
  - Table `public.gateway_settings(id, company_id, key, value, created_at, updated_at)` dengan `unique(company_id, key)`
  - Table `public.gateway_virtual_keys(id, company_id, created_by, name, slug, provider, vault_secret_id, masked_key, is_active, rate_limit_rpm, created_at, updated_at)` dengan `unique(company_id, slug)`
  - Table `public.gateway_configs(id, company_id, created_by, name, slug, config jsonb, is_active, created_at, updated_at)` dengan `unique(company_id, slug)`
  - RLS policies: member company bisa SELECT; owner/admin bisa INSERT/UPDATE/DELETE; service_role bypass semua

- [ ] **Step 1: Buat migration gateway_settings**

```sql
-- apps/website/supabase/migrations/20260626000001_create_gateway_settings.sql

create table if not exists public.gateway_settings (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  key        text not null,
  value      text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, key)
);

alter table public.gateway_settings enable row level security;

-- Members can read settings
create policy "Company members can view gateway settings"
  on public.gateway_settings for select
  using (
    company_id is null
    or exists (
      select 1 from public.company_memberships
      where company_id = gateway_settings.company_id
        and user_id = auth.uid()
        and status = 'active'
    )
  );

-- Only owner/admin can insert/update/delete
create policy "Admins can manage gateway settings"
  on public.gateway_settings for all
  using (
    exists (
      select 1 from public.company_memberships
      where company_id = gateway_settings.company_id
        and user_id = auth.uid()
        and role in ('owner', 'admin', 'super_admin')
        and status = 'active'
    )
  );

create trigger handle_gateway_settings_updated_at
  before update on public.gateway_settings
  for each row execute procedure public.handle_updated_at();
```

- [ ] **Step 2: Buat migration gateway_virtual_keys**

```sql
-- apps/website/supabase/migrations/20260626000002_create_gateway_virtual_keys.sql

create table if not exists public.gateway_virtual_keys (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  created_by      uuid not null references auth.users(id),
  name            text not null,
  slug            text not null,
  provider        text not null,
  vault_secret_id uuid not null,
  masked_key      text not null,
  is_active       boolean not null default true,
  rate_limit_rpm  integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(company_id, slug)
);

create index idx_gateway_virtual_keys_company on public.gateway_virtual_keys(company_id);
create index idx_gateway_virtual_keys_slug on public.gateway_virtual_keys(slug);

alter table public.gateway_virtual_keys enable row level security;

-- Members can view (slug + provider + masked_key only, NOT the actual key)
create policy "Company members can view virtual keys"
  on public.gateway_virtual_keys for select
  using (
    exists (
      select 1 from public.company_memberships
      where company_id = gateway_virtual_keys.company_id
        and user_id = auth.uid()
        and status = 'active'
    )
  );

-- Admins can manage
create policy "Admins can manage virtual keys"
  on public.gateway_virtual_keys for all
  using (
    exists (
      select 1 from public.company_memberships
      where company_id = gateway_virtual_keys.company_id
        and user_id = auth.uid()
        and role in ('owner', 'admin', 'super_admin')
        and status = 'active'
    )
  );

create trigger handle_gateway_virtual_keys_updated_at
  before update on public.gateway_virtual_keys
  for each row execute procedure public.handle_updated_at();
```

- [ ] **Step 3: Buat migration gateway_configs**

```sql
-- apps/website/supabase/migrations/20260626000003_create_gateway_configs.sql

create table if not exists public.gateway_configs (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  created_by  uuid not null references auth.users(id),
  name        text not null,
  slug        text not null,
  config      jsonb not null default '{}'::jsonb,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(company_id, slug)
);

create index idx_gateway_configs_company on public.gateway_configs(company_id);
create index idx_gateway_configs_slug on public.gateway_configs(slug);

alter table public.gateway_configs enable row level security;

create policy "Company members can view gateway configs"
  on public.gateway_configs for select
  using (
    exists (
      select 1 from public.company_memberships
      where company_id = gateway_configs.company_id
        and user_id = auth.uid()
        and status = 'active'
    )
  );

create policy "Admins can manage gateway configs"
  on public.gateway_configs for all
  using (
    exists (
      select 1 from public.company_memberships
      where company_id = gateway_configs.company_id
        and user_id = auth.uid()
        and role in ('owner', 'admin', 'super_admin')
        and status = 'active'
    )
  );

create trigger handle_gateway_configs_updated_at
  before update on public.gateway_configs
  for each row execute procedure public.handle_updated_at();
```

- [ ] **Step 4: Apply migrations ke Supabase local**

```bash
cd apps/website
npx supabase db reset
# atau jika hanya push migrations baru:
npx supabase migration up
```

Expected: `Applied 3 migrations successfully.`

- [ ] **Step 5: Commit**

```bash
git add apps/website/supabase/migrations/20260626000001_create_gateway_settings.sql
git add apps/website/supabase/migrations/20260626000002_create_gateway_virtual_keys.sql
git add apps/website/supabase/migrations/20260626000003_create_gateway_configs.sql
git commit -m "feat(db): add gateway_settings, gateway_virtual_keys, gateway_configs tables"
```

---

## Task 2: Gateway Config Types & Supabase Fetch Client

**Files:**
- Create: `apps/gateway/src/config/types.ts`
- Create: `apps/gateway/src/config/supabaseClient.ts`

**Interfaces:**
- Consumes: env vars `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Produces:
  - `type VirtualKeyRecord = { slug, provider, vault_secret_id, masked_key, is_active, rate_limit_rpm, company_id }`
  - `type ConfigPresetRecord = { slug, config: Record<string, unknown>, is_active, company_id }`
  - `type GatewaySettingRecord = { key, value, company_id }`
  - `function supabaseFetch(path: string, env: GatewayEnv): Promise<Response>`

- [ ] **Step 1: Tulis test untuk supabaseClient**

```typescript
// apps/gateway/src/config/supabaseClient.test.ts
import { describe, it, expect, vi } from 'vitest';
import { supabaseFetch } from './supabaseClient';

describe('supabaseFetch', () => {
  it('adds Authorization and apikey headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('[]'));
    global.fetch = mockFetch;

    const env = {
      SUPABASE_URL: 'https://abc.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key-xxx',
    } as any;

    await supabaseFetch('/rest/v1/gateway_virtual_keys?slug=eq.vk_test', env);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://abc.supabase.co/rest/v1/gateway_virtual_keys?slug=eq.vk_test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer service-key-xxx',
          apikey: 'service-key-xxx',
        }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test — harus FAIL**

```bash
cd apps/gateway
pnpm test src/config/supabaseClient.test.ts
```

Expected: `Error: Cannot find module './supabaseClient'`

- [ ] **Step 3: Buat types.ts**

```typescript
// apps/gateway/src/config/types.ts

export interface GatewayEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  KV_ENCRYPTION_KEY: string;
  USE_DB_CONFIG?: string;
  HARO_CONFIG_CACHE?: KVNamespace; // Cloudflare KV binding
}

export interface VirtualKeyRecord {
  id: string;
  slug: string;
  provider: string;
  vault_secret_id: string;
  masked_key: string;
  is_active: boolean;
  rate_limit_rpm: number | null;
  company_id: string;
}

export interface ResolvedVirtualKey {
  provider: string;
  apiKey: string;
  rateLimitRpm: number | null;
}

export interface ConfigPresetRecord {
  id: string;
  slug: string;
  config: Record<string, unknown>;
  is_active: boolean;
  company_id: string;
}

export interface GatewaySettingRecord {
  key: string;
  value: string;
  company_id: string | null;
}
```

- [ ] **Step 4: Buat supabaseClient.ts**

```typescript
// apps/gateway/src/config/supabaseClient.ts

import type { GatewayEnv } from './types';

export async function supabaseFetch(
  path: string,
  env: GatewayEnv,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${env.SUPABASE_URL}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Prefer: 'return=representation',
      ...(options.headers as Record<string, string> || {}),
    },
  });
}
```

- [ ] **Step 5: Run test — harus PASS**

```bash
cd apps/gateway
pnpm test src/config/supabaseClient.test.ts
```

Expected: `✓ adds Authorization and apikey headers`

- [ ] **Step 6: Commit**

```bash
git add apps/gateway/src/config/types.ts apps/gateway/src/config/supabaseClient.ts apps/gateway/src/config/supabaseClient.test.ts
git commit -m "feat(gateway): add config types and Supabase fetch client"
```

---

## Task 3: Cloudflare KV Crypto Utility (AES-256-GCM)

**Files:**
- Create: `apps/gateway/src/config/kvCrypto.ts`
- Create: `apps/gateway/src/config/kvCrypto.test.ts`

**Interfaces:**
- Consumes: `env.KV_ENCRYPTION_KEY` (base64-encoded 32-byte key), `env.HARO_CONFIG_CACHE` (KVNamespace)
- Produces:
  - `async function kvGet<T>(key: string, env: GatewayEnv): Promise<T | null>` — get + decrypt dari KV
  - `async function kvSet(key: string, value: unknown, env: GatewayEnv, ttlSeconds: number): Promise<void>` — encrypt + put ke KV
  - `async function kvDel(key: string, env: GatewayEnv): Promise<void>` — delete dari KV

- [ ] **Step 1: Tulis test untuk kvCrypto**

```typescript
// apps/gateway/src/config/kvCrypto.test.ts
import { describe, it, expect, vi } from 'vitest';
import { kvGet, kvSet, kvDel } from './kvCrypto';

// Mock KV namespace
const createMockKV = () => {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    delete: vi.fn(async (key: string) => { store.delete(key); }),
    _store: store,
  };
};

const makeEnv = (kv: any) => ({
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'key',
  // 32-byte key as base64 (test key)
  KV_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  HARO_CONFIG_CACHE: kv,
} as any);

describe('kvCrypto', () => {
  it('returns null when key does not exist', async () => {
    const kv = createMockKV();
    const result = await kvGet('missing-key', makeEnv(kv));
    expect(result).toBeNull();
  });

  it('roundtrips: set then get returns original value', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    const original = { provider: 'openai', apiKey: 'sk-test-123' };
    await kvSet('vk:vk_abc123', original, env, 300);
    const result = await kvGet<typeof original>('vk:vk_abc123', env);
    expect(result).toEqual(original);
  });

  it('encrypted value in KV is not plaintext', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    await kvSet('vk:test', { secret: 'my-api-key' }, env, 300);
    const stored = kv._store.get('vk:test')!;
    expect(stored).not.toContain('my-api-key');
  });

  it('kvDel removes key', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    await kvSet('vk:del_test', { x: 1 }, env, 300);
    await kvDel('vk:del_test', env);
    const result = await kvGet('vk:del_test', env);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — harus FAIL**

```bash
cd apps/gateway
pnpm test src/config/kvCrypto.test.ts
```

Expected: `Error: Cannot find module './kvCrypto'`

- [ ] **Step 3: Implementasikan kvCrypto.ts**

```typescript
// apps/gateway/src/config/kvCrypto.ts

import type { GatewayEnv } from './types';

async function importKey(base64Key: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  return globalThis.crypto.subtle.importKey('raw', raw, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

async function encrypt(data: string, key: CryptoKey): Promise<string> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(data);
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  // Combine iv + ciphertext, encode as base64
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(base64: string, key: CryptoKey): Promise<string> {
  const combined = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}

export async function kvGet<T>(
  key: string,
  env: GatewayEnv
): Promise<T | null> {
  if (!env.HARO_CONFIG_CACHE) return null;
  const encrypted = await env.HARO_CONFIG_CACHE.get(key);
  if (!encrypted) return null;
  const cryptoKey = await importKey(env.KV_ENCRYPTION_KEY);
  const json = await decrypt(encrypted, cryptoKey);
  return JSON.parse(json) as T;
}

export async function kvSet(
  key: string,
  value: unknown,
  env: GatewayEnv,
  ttlSeconds: number
): Promise<void> {
  if (!env.HARO_CONFIG_CACHE) return;
  const cryptoKey = await importKey(env.KV_ENCRYPTION_KEY);
  const encrypted = await encrypt(JSON.stringify(value), cryptoKey);
  await env.HARO_CONFIG_CACHE.put(key, encrypted, {
    expirationTtl: ttlSeconds,
  });
}

export async function kvDel(key: string, env: GatewayEnv): Promise<void> {
  if (!env.HARO_CONFIG_CACHE) return;
  await env.HARO_CONFIG_CACHE.delete(key);
}
```

- [ ] **Step 4: Run test — harus PASS**

```bash
cd apps/gateway
pnpm test src/config/kvCrypto.test.ts
```

Expected: `✓ returns null when key does not exist`, `✓ roundtrips`, `✓ encrypted value is not plaintext`, `✓ kvDel removes key`

- [ ] **Step 5: Commit**

```bash
git add apps/gateway/src/config/kvCrypto.ts apps/gateway/src/config/kvCrypto.test.ts
git commit -m "feat(gateway): add AES-256-GCM KV crypto utility"
```

---

## Task 4: Config Resolver Middleware

**Files:**
- Create: `apps/gateway/src/config/virtualKeyResolver.ts`
- Create: `apps/gateway/src/config/configPresetResolver.ts`
- Create: `apps/gateway/src/config/virtualKeyResolver.test.ts`
- Create: `apps/gateway/src/config/configPresetResolver.test.ts`
- Create: `apps/gateway/src/middlewares/configResolver/index.ts`
- Modify: `apps/gateway/src/index.ts` (line 106 — tambah middleware sebelum `hooks`)

**Interfaces:**
- Consumes:
  - `kvGet`, `kvSet` dari `../config/kvCrypto`
  - `supabaseFetch` dari `../config/supabaseClient`
  - `VirtualKeyRecord`, `ResolvedVirtualKey`, `ConfigPresetRecord`, `GatewayEnv` dari `../config/types`
  - Header `x-haro-virtual-key` dari request
  - Header `x-haro-config-id` dari request
- Produces:
  - `async function resolveVirtualKey(slug: string, env: GatewayEnv): Promise<ResolvedVirtualKey | null>`
  - `async function resolveConfigPreset(slug: string, env: GatewayEnv): Promise<Record<string, unknown> | null>`
  - Hono middleware `configResolver` yang inject headers ke request

KV TTL: Virtual Keys = 300 detik (5 menit), Config Presets = 600 detik (10 menit)

- [ ] **Step 1: Tulis test untuk virtualKeyResolver**

```typescript
// apps/gateway/src/config/virtualKeyResolver.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveVirtualKey } from './virtualKeyResolver';

vi.mock('./kvCrypto', () => ({
  kvGet: vi.fn(),
  kvSet: vi.fn(),
}));
vi.mock('./supabaseClient', () => ({
  supabaseFetch: vi.fn(),
}));

import { kvGet, kvSet } from './kvCrypto';
import { supabaseFetch } from './supabaseClient';

const mockEnv = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sk', KV_ENCRYPTION_KEY: 'key', HARO_CONFIG_CACHE: {} } as any;

describe('resolveVirtualKey', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null if slug is empty', async () => {
    const result = await resolveVirtualKey('', mockEnv);
    expect(result).toBeNull();
  });

  it('returns cached value from KV on HIT', async () => {
    vi.mocked(kvGet).mockResolvedValueOnce({ provider: 'openai', apiKey: 'sk-cached', rateLimitRpm: null });
    const result = await resolveVirtualKey('vk_abc123', mockEnv);
    expect(result).toEqual({ provider: 'openai', apiKey: 'sk-cached', rateLimitRpm: null });
    expect(supabaseFetch).not.toHaveBeenCalled();
  });

  it('queries Supabase on KV MISS and caches result', async () => {
    vi.mocked(kvGet).mockResolvedValueOnce(null);
    const mockVaultResponse = [{ secret: 'sk-from-vault' }];
    const mockVkResponse = [{ slug: 'vk_abc123', provider: 'openai', vault_secret_id: 'vault-id-1', masked_key: 'ey3f', is_active: true, rate_limit_rpm: null, company_id: 'company-1' }];

    vi.mocked(supabaseFetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(mockVkResponse)))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockVaultResponse)));

    const result = await resolveVirtualKey('vk_abc123', mockEnv);
    expect(result).toEqual({ provider: 'openai', apiKey: 'sk-from-vault', rateLimitRpm: null });
    expect(kvSet).toHaveBeenCalledWith('vk:vk_abc123', result, mockEnv, 300);
  });

  it('returns null if VK not found or inactive', async () => {
    vi.mocked(kvGet).mockResolvedValueOnce(null);
    vi.mocked(supabaseFetch).mockResolvedValueOnce(new Response('[]'));
    const result = await resolveVirtualKey('vk_notexist', mockEnv);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — harus FAIL**

```bash
cd apps/gateway
pnpm test src/config/virtualKeyResolver.test.ts
```

Expected: `Error: Cannot find module './virtualKeyResolver'`

- [ ] **Step 3: Implementasikan virtualKeyResolver.ts**

```typescript
// apps/gateway/src/config/virtualKeyResolver.ts

import { kvGet, kvSet } from './kvCrypto';
import { supabaseFetch } from './supabaseClient';
import type { GatewayEnv, VirtualKeyRecord, ResolvedVirtualKey } from './types';

const VK_TTL = 300; // 5 minutes

export async function resolveVirtualKey(
  slug: string,
  env: GatewayEnv
): Promise<ResolvedVirtualKey | null> {
  if (!slug) return null;

  // 1. KV cache lookup
  const cached = await kvGet<ResolvedVirtualKey>(`vk:${slug}`, env);
  if (cached) return cached;

  // 2. Supabase lookup for VK record
  const vkRes = await supabaseFetch(
    `/rest/v1/gateway_virtual_keys?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=*`,
    env
  );
  if (!vkRes.ok) return null;
  const vkRows: VirtualKeyRecord[] = await vkRes.json();
  if (!vkRows.length) return null;
  const vk = vkRows[0];

  // 3. Supabase Vault: get decrypted secret
  const vaultRes = await supabaseFetch(
    `/rest/v1/vault/decrypted_secrets?id=eq.${vk.vault_secret_id}&select=secret`,
    env
  );
  if (!vaultRes.ok) return null;
  const vaultRows: { secret: string }[] = await vaultRes.json();
  if (!vaultRows.length) return null;

  const resolved: ResolvedVirtualKey = {
    provider: vk.provider,
    apiKey: vaultRows[0].secret,
    rateLimitRpm: vk.rate_limit_rpm,
  };

  // 4. Cache to KV
  await kvSet(`vk:${slug}`, resolved, env, VK_TTL);
  return resolved;
}
```

- [ ] **Step 4: Tulis test untuk configPresetResolver**

```typescript
// apps/gateway/src/config/configPresetResolver.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveConfigPreset } from './configPresetResolver';

vi.mock('./kvCrypto', () => ({ kvGet: vi.fn(), kvSet: vi.fn() }));
vi.mock('./supabaseClient', () => ({ supabaseFetch: vi.fn() }));

import { kvGet, kvSet } from './kvCrypto';
import { supabaseFetch } from './supabaseClient';

const mockEnv = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sk', KV_ENCRYPTION_KEY: 'key', HARO_CONFIG_CACHE: {} } as any;

describe('resolveConfigPreset', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null for empty slug', async () => {
    expect(await resolveConfigPreset('', mockEnv)).toBeNull();
  });

  it('returns cached config on KV HIT', async () => {
    const config = { strategy: 'fallback', targets: [] };
    vi.mocked(kvGet).mockResolvedValueOnce(config);
    const result = await resolveConfigPreset('cfg_abc123', mockEnv);
    expect(result).toEqual(config);
    expect(supabaseFetch).not.toHaveBeenCalled();
  });

  it('queries Supabase on MISS and caches', async () => {
    vi.mocked(kvGet).mockResolvedValueOnce(null);
    const config = { strategy: 'loadbalance' };
    vi.mocked(supabaseFetch).mockResolvedValueOnce(new Response(JSON.stringify([{ slug: 'cfg_abc123', config, is_active: true }])));
    const result = await resolveConfigPreset('cfg_abc123', mockEnv);
    expect(result).toEqual(config);
    expect(kvSet).toHaveBeenCalledWith('cfg:cfg_abc123', config, mockEnv, 600);
  });
});
```

- [ ] **Step 5: Implementasikan configPresetResolver.ts**

```typescript
// apps/gateway/src/config/configPresetResolver.ts

import { kvGet, kvSet } from './kvCrypto';
import { supabaseFetch } from './supabaseClient';
import type { GatewayEnv, ConfigPresetRecord } from './types';

const CFG_TTL = 600; // 10 minutes

export async function resolveConfigPreset(
  slug: string,
  env: GatewayEnv
): Promise<Record<string, unknown> | null> {
  if (!slug) return null;

  const cached = await kvGet<Record<string, unknown>>(`cfg:${slug}`, env);
  if (cached) return cached;

  const res = await supabaseFetch(
    `/rest/v1/gateway_configs?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=config`,
    env
  );
  if (!res.ok) return null;
  const rows: Pick<ConfigPresetRecord, 'config'>[] = await res.json();
  if (!rows.length) return null;

  const config = rows[0].config;
  await kvSet(`cfg:${slug}`, config, env, CFG_TTL);
  return config;
}
```

- [ ] **Step 6: Run kedua test — harus PASS**

```bash
cd apps/gateway
pnpm test src/config/virtualKeyResolver.test.ts src/config/configPresetResolver.test.ts
```

Expected: semua `✓`

- [ ] **Step 7: Buat configResolver middleware**

```typescript
// apps/gateway/src/middlewares/configResolver/index.ts

import { Context, Next } from 'hono';
import { resolveVirtualKey } from '../../config/virtualKeyResolver';
import { resolveConfigPreset } from '../../config/configPresetResolver';
import { HEADER_KEYS } from '../../globals';

const VIRTUAL_KEY_HEADER = `x-haro-virtual-key`;
const CONFIG_ID_HEADER = `x-haro-config-id`;

export const configResolver = async (c: Context, next: Next) => {
  const env = c.env as any;

  // Only activate when USE_DB_CONFIG is set
  if (!env?.USE_DB_CONFIG || !env?.SUPABASE_URL) {
    return next();
  }

  // Resolve Virtual Key
  const vkSlug = c.req.header(VIRTUAL_KEY_HEADER);
  if (vkSlug) {
    const resolved = await resolveVirtualKey(vkSlug, env);
    if (resolved) {
      // Inject provider and API key into request (mutate headers via proxy)
      c.req.raw.headers.set(HEADER_KEYS.PROVIDER, resolved.provider);
      c.req.raw.headers.set('Authorization', `Bearer ${resolved.apiKey}`);
    }
  }

  // Resolve Config Preset
  const configSlug = c.req.header(CONFIG_ID_HEADER);
  if (configSlug) {
    const config = await resolveConfigPreset(configSlug, env);
    if (config) {
      c.req.raw.headers.set(HEADER_KEYS.CONFIG, JSON.stringify(config));
    }
  }

  return next();
};
```

- [ ] **Step 8: Register middleware di index.ts**

Di `apps/gateway/src/index.ts`, tambahkan import dan gunakan middleware SEBELUM `hooks`:

```typescript
// Tambahkan di bagian imports (setelah import hooks)
import { configResolver } from './middlewares/configResolver';

// Ganti baris:
// app.use('*', hooks);
// Menjadi:
app.use('*', configResolver);
app.use('*', hooks);
```

- [ ] **Step 9: Commit**

```bash
git add apps/gateway/src/config/virtualKeyResolver.ts \
        apps/gateway/src/config/virtualKeyResolver.test.ts \
        apps/gateway/src/config/configPresetResolver.ts \
        apps/gateway/src/config/configPresetResolver.test.ts \
        apps/gateway/src/middlewares/configResolver/index.ts \
        apps/gateway/src/index.ts
git commit -m "feat(gateway): add configResolver middleware with Virtual Key and Config Preset resolution"
```

---

## Task 5: Gateway Settings — Pindahkan admin_token + cache dari conf.json ke DB

**Files:**
- Create: `apps/gateway/src/config/settingsResolver.ts`
- Create: `apps/gateway/src/config/settingsResolver.test.ts`
- Modify: `apps/gateway/src/middlewares/adminAuth/index.ts` (ganti `conf.admin_token` dengan DB lookup)
- Modify: `apps/gateway/src/index.ts` (ganti `conf.cache` dengan DB lookup)

**Interfaces:**
- Consumes: `kvGet`, `kvSet` dari kvCrypto; `supabaseFetch`; `GatewayEnv`
- Produces: `async function getGatewaySetting(key: string, env: GatewayEnv, companyId?: string): Promise<string | null>`

Setting TTL di KV: 900 detik (15 menit)

- [ ] **Step 1: Tulis test untuk settingsResolver**

```typescript
// apps/gateway/src/config/settingsResolver.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGatewaySetting } from './settingsResolver';

vi.mock('./kvCrypto', () => ({ kvGet: vi.fn(), kvSet: vi.fn() }));
vi.mock('./supabaseClient', () => ({ supabaseFetch: vi.fn() }));

import { kvGet, kvSet } from './kvCrypto';
import { supabaseFetch } from './supabaseClient';

const mockEnv = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sk', KV_ENCRYPTION_KEY: 'k', HARO_CONFIG_CACHE: {} } as any;

describe('getGatewaySetting', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when env not configured', async () => {
    const result = await getGatewaySetting('admin_token', {} as any);
    expect(result).toBeNull();
  });

  it('returns cached value from KV', async () => {
    vi.mocked(kvGet).mockResolvedValueOnce('cached-token');
    const result = await getGatewaySetting('admin_token', mockEnv);
    expect(result).toBe('cached-token');
  });

  it('queries Supabase on miss and caches', async () => {
    vi.mocked(kvGet).mockResolvedValueOnce(null);
    vi.mocked(supabaseFetch).mockResolvedValueOnce(
      new Response(JSON.stringify([{ key: 'admin_token', value: 'db-token' }]))
    );
    const result = await getGatewaySetting('admin_token', mockEnv);
    expect(result).toBe('db-token');
    expect(kvSet).toHaveBeenCalledWith('settings:global:admin_token', 'db-token', mockEnv, 900);
  });
});
```

- [ ] **Step 2: Implementasikan settingsResolver.ts**

```typescript
// apps/gateway/src/config/settingsResolver.ts

import { kvGet, kvSet } from './kvCrypto';
import { supabaseFetch } from './supabaseClient';
import type { GatewayEnv, GatewaySettingRecord } from './types';

const SETTINGS_TTL = 900; // 15 minutes

export async function getGatewaySetting(
  key: string,
  env: GatewayEnv,
  companyId?: string
): Promise<string | null> {
  if (!env?.SUPABASE_URL || !env?.SUPABASE_SERVICE_ROLE_KEY) return null;

  const cacheKey = companyId
    ? `settings:${companyId}:${key}`
    : `settings:global:${key}`;

  const cached = await kvGet<string>(cacheKey, env);
  if (cached !== null) return cached;

  const filter = companyId
    ? `key=eq.${key}&company_id=eq.${companyId}`
    : `key=eq.${key}&company_id=is.null`;

  const res = await supabaseFetch(
    `/rest/v1/gateway_settings?${filter}&select=key,value&limit=1`,
    env
  );
  if (!res.ok) return null;
  const rows: GatewaySettingRecord[] = await res.json();
  if (!rows.length) return null;

  await kvSet(cacheKey, rows[0].value, env, SETTINGS_TTL);
  return rows[0].value;
}
```

- [ ] **Step 3: Run test — harus PASS**

```bash
cd apps/gateway
pnpm test src/config/settingsResolver.test.ts
```

- [ ] **Step 4: Update adminAuth middleware**

Di `apps/gateway/src/middlewares/adminAuth/index.ts`, update `getConfiguredAdminToken` untuk cek DB terlebih dahulu:

```typescript
// Tambahkan import di atas
import { getGatewaySetting } from '../../config/settingsResolver';

// Ganti fungsi getConfiguredAdminToken
const getConfiguredAdminToken = async (env?: any): Promise<string> => {
  // 1. Try DB if configured
  if (env?.USE_DB_CONFIG && env?.SUPABASE_URL) {
    const dbToken = await getGatewaySetting('admin_token', env);
    if (dbToken) return dbToken;
  }
  // 2. Fallback to conf.json
  const adminToken = (conf as Record<string, unknown>)?.admin_token;
  if (!adminToken || typeof adminToken !== 'string' || adminToken.trim() === '') {
    throw new Error(
      'Admin UI auth requires admin_token. Set it in gateway_settings DB table or conf.json.'
    );
  }
  return adminToken;
};
```

Kemudian update semua pemanggil `getConfiguredAdminToken()` untuk meneruskan `c.env`:

```typescript
// Dalam adminAuthMiddleware, adminAuthSessionStatusHandler, adminAuthLoginHandler
// Ubah dari: configuredToken = getConfiguredAdminToken();
// Menjadi:   configuredToken = await getConfiguredAdminToken(c.env);
```

- [ ] **Step 5: Commit**

```bash
git add apps/gateway/src/config/settingsResolver.ts \
        apps/gateway/src/config/settingsResolver.test.ts \
        apps/gateway/src/middlewares/adminAuth/index.ts
git commit -m "feat(gateway): gateway settings (admin_token) DB-backed with conf.json fallback"
```

---

## Task 6: Gateway Admin API — CRUD Virtual Keys & Configs

**Files:**
- Create: `apps/gateway/src/handlers/adminVirtualKeysHandler.ts`
- Create: `apps/gateway/src/handlers/adminConfigsHandler.ts`
- Create: `apps/gateway/src/handlers/adminCacheHandler.ts`
- Modify: `apps/gateway/src/start-server.ts` (register admin routes)

**Interfaces:**
- Consumes: `supabaseFetch`, `kvDel`, `adminAuthMiddleware`
- Produces: REST endpoints (dilindungi adminAuthMiddleware):
  - `GET /admin/virtual-keys?company_id=xxx` → list VKs (tanpa apiKey)
  - `POST /admin/virtual-keys` body: `{company_id, name, provider, apiKey}` → create + vault
  - `DELETE /admin/virtual-keys/:slug` → deactivate + invalidate KV
  - `GET /admin/configs?company_id=xxx` → list configs
  - `POST /admin/configs` body: `{company_id, name, config}` → create
  - `DELETE /admin/configs/:slug` → deactivate + invalidate KV
  - `POST /admin/cache/invalidate` body: `{key}` → delete KV entry

- [ ] **Step 1: Implementasikan adminVirtualKeysHandler.ts**

```typescript
// apps/gateway/src/handlers/adminVirtualKeysHandler.ts

import { Context } from 'hono';
import { supabaseFetch } from '../config/supabaseClient';
import { kvDel } from '../config/kvCrypto';
import type { GatewayEnv } from '../config/types';

// Generate slug: vk_ + 8 random hex chars
function generateSlug(prefix: string): string {
  const arr = new Uint8Array(4);
  globalThis.crypto.getRandomValues(arr);
  return prefix + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const listVirtualKeysHandler = async (c: Context) => {
  const env = c.env as GatewayEnv;
  const companyId = c.req.query('company_id');
  const filter = companyId ? `company_id=eq.${companyId}` : '';
  const res = await supabaseFetch(
    `/rest/v1/gateway_virtual_keys?${filter}&select=id,name,slug,provider,masked_key,is_active,rate_limit_rpm,created_at&order=created_at.desc`,
    env
  );
  const data = await res.json();
  return c.json(data, res.ok ? 200 : 500);
};

export const createVirtualKeyHandler = async (c: Context) => {
  const env = c.env as GatewayEnv;
  let body: { company_id: string; name: string; provider: string; apiKey: string; rate_limit_rpm?: number };
  try { body = await c.req.json(); } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  if (!body.company_id || !body.name || !body.provider || !body.apiKey) {
    return c.json({ error: 'Required: company_id, name, provider, apiKey' }, 400);
  }

  // 1. Store in Supabase Vault
  const vaultRes = await supabaseFetch('/rest/v1/vault/secrets', env, {
    method: 'POST',
    body: JSON.stringify({ secret: body.apiKey, name: `vk_${body.company_id}_${body.provider}_${Date.now()}` }),
  });
  if (!vaultRes.ok) return c.json({ error: 'Failed to store in vault' }, 500);
  const vault = await vaultRes.json() as { id: string };

  // 2. Create VK record
  const slug = generateSlug('vk_');
  const masked_key = body.apiKey.slice(-4);
  const vkRes = await supabaseFetch('/rest/v1/gateway_virtual_keys', env, {
    method: 'POST',
    body: JSON.stringify({
      company_id: body.company_id,
      created_by: body.company_id, // service role insert — created_by set to company owner
      name: body.name,
      slug,
      provider: body.provider,
      vault_secret_id: vault.id,
      masked_key,
      rate_limit_rpm: body.rate_limit_rpm ?? null,
    }),
  });
  if (!vkRes.ok) return c.json({ error: 'Failed to create virtual key' }, 500);
  const vk = await vkRes.json();
  return c.json({ slug, masked_key, provider: body.provider }, 201);
};

export const deleteVirtualKeyHandler = async (c: Context) => {
  const env = c.env as GatewayEnv;
  const slug = c.req.param('slug');
  const res = await supabaseFetch(
    `/rest/v1/gateway_virtual_keys?slug=eq.${slug}`,
    env,
    { method: 'PATCH', body: JSON.stringify({ is_active: false }) }
  );
  if (!res.ok) return c.json({ error: 'Failed to deactivate key' }, 500);
  await kvDel(`vk:${slug}`, env);
  return c.json({ deactivated: true });
};
```

- [ ] **Step 2: Implementasikan adminConfigsHandler.ts**

```typescript
// apps/gateway/src/handlers/adminConfigsHandler.ts

import { Context } from 'hono';
import { supabaseFetch } from '../config/supabaseClient';
import { kvDel } from '../config/kvCrypto';
import type { GatewayEnv } from '../config/types';

function generateSlug(prefix: string): string {
  const arr = new Uint8Array(4);
  globalThis.crypto.getRandomValues(arr);
  return prefix + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const listConfigsHandler = async (c: Context) => {
  const env = c.env as GatewayEnv;
  const companyId = c.req.query('company_id');
  const filter = companyId ? `company_id=eq.${companyId}` : '';
  const res = await supabaseFetch(
    `/rest/v1/gateway_configs?${filter}&select=id,name,slug,config,is_active,created_at&order=created_at.desc`,
    env
  );
  return c.json(await res.json(), res.ok ? 200 : 500);
};

export const createConfigHandler = async (c: Context) => {
  const env = c.env as GatewayEnv;
  let body: { company_id: string; name: string; config: Record<string, unknown>; created_by?: string };
  try { body = await c.req.json(); } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  if (!body.company_id || !body.name || !body.config) {
    return c.json({ error: 'Required: company_id, name, config' }, 400);
  }
  const slug = generateSlug('cfg_');
  const res = await supabaseFetch('/rest/v1/gateway_configs', env, {
    method: 'POST',
    body: JSON.stringify({ ...body, slug, created_by: body.created_by ?? body.company_id }),
  });
  if (!res.ok) return c.json({ error: 'Failed to create config' }, 500);
  return c.json({ slug }, 201);
};

export const deleteConfigHandler = async (c: Context) => {
  const env = c.env as GatewayEnv;
  const slug = c.req.param('slug');
  const res = await supabaseFetch(
    `/rest/v1/gateway_configs?slug=eq.${slug}`,
    env,
    { method: 'PATCH', body: JSON.stringify({ is_active: false }) }
  );
  if (!res.ok) return c.json({ error: 'Failed to deactivate config' }, 500);
  await kvDel(`cfg:${slug}`, env);
  return c.json({ deactivated: true });
};
```

- [ ] **Step 3: Implementasikan adminCacheHandler.ts**

```typescript
// apps/gateway/src/handlers/adminCacheHandler.ts

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
```

- [ ] **Step 4: Register routes di start-server.ts**

Di `apps/gateway/src/start-server.ts`, setelah `setupStaticServing()`:

```typescript
// Tambahkan imports
import { listVirtualKeysHandler, createVirtualKeyHandler, deleteVirtualKeyHandler } from './handlers/adminVirtualKeysHandler';
import { listConfigsHandler, createConfigHandler, deleteConfigHandler } from './handlers/adminConfigsHandler';
import { invalidateCacheHandler } from './handlers/adminCacheHandler';

// Tambahkan routes (setelah adminAuth routes)
app.get('/admin/virtual-keys', adminAuthMiddleware, listVirtualKeysHandler);
app.post('/admin/virtual-keys', adminAuthMiddleware, createVirtualKeyHandler);
app.delete('/admin/virtual-keys/:slug', adminAuthMiddleware, deleteVirtualKeyHandler);
app.get('/admin/configs', adminAuthMiddleware, listConfigsHandler);
app.post('/admin/configs', adminAuthMiddleware, createConfigHandler);
app.delete('/admin/configs/:slug', adminAuthMiddleware, deleteConfigHandler);
app.post('/admin/cache/invalidate', adminAuthMiddleware, invalidateCacheHandler);
```

- [ ] **Step 5: Update wrangler.toml — tambahkan KV binding dan vars**

```toml
# Tambahkan di apps/gateway/wrangler.toml setelah [vars]:

[[kv_namespaces]]
binding = "HARO_CONFIG_CACHE"
id = "YOUR_KV_NAMESPACE_ID_HERE"  # buat via: npx wrangler kv:namespace create HARO_CONFIG_CACHE

[vars]
ENVIRONMENT = 'dev'
CUSTOM_HEADERS_TO_IGNORE = []
USE_DB_CONFIG = 'true'
# Tambahkan secrets via: npx wrangler secret put SUPABASE_URL
# Tambahkan secrets via: npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Tambahkan secrets via: npx wrangler secret put KV_ENCRYPTION_KEY
```

- [ ] **Step 6: Buat KV namespace (jalankan sekali)**

```bash
cd apps/gateway
npx wrangler kv:namespace create HARO_CONFIG_CACHE
# Copy ID yang muncul, paste ke wrangler.toml di [[kv_namespaces]].id
```

- [ ] **Step 7: Run semua tests**

```bash
cd apps/gateway
pnpm test
```

Expected: semua tests pass, tidak ada failure baru

- [ ] **Step 8: Commit**

```bash
git add apps/gateway/src/handlers/adminVirtualKeysHandler.ts \
        apps/gateway/src/handlers/adminConfigsHandler.ts \
        apps/gateway/src/handlers/adminCacheHandler.ts \
        apps/gateway/src/start-server.ts \
        apps/gateway/wrangler.toml
git commit -m "feat(gateway): add admin API for virtual keys, configs, and cache invalidation"
```

---

## Verifikasi End-to-End

Setelah semua task selesai, lakukan smoke test:

```bash
# 1. Start gateway (Node.js mode)
cd apps/gateway
pnpm dev:node

# 2. Buat virtual key via admin API
curl -X POST http://localhost:8787/admin/virtual-keys \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"company_id":"<company-uuid>","name":"Test OpenAI","provider":"openai","apiKey":"sk-..."}'
# Response: {"slug":"vk_a1b2c3d4","masked_key":"...","provider":"openai"}

# 3. Use virtual key in request
curl -X POST http://localhost:8787/v1/chat/completions \
  -H "x-haro-virtual-key: vk_a1b2c3d4" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"ping"}]}'
# Expected: valid response from OpenAI, no API key in request headers

# 4. Check KV cache hit (second request should NOT query Supabase)
# Gateway logs akan menunjukkan "KV HIT" pada request kedua
```

---

## Env Vars Checklist (Node.js / Wrangler)

```bash
# Wrangler secrets (production)
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put KV_ENCRYPTION_KEY  # generate: openssl rand -base64 32

# .env local (Node.js dev, tambahkan ke apps/gateway/.env)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
KV_ENCRYPTION_KEY=<base64-32-bytes>
USE_DB_CONFIG=true
```
