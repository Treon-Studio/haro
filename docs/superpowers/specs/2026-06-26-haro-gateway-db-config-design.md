# Haro Gateway — DB-Backed Config Design

**Date:** 2026-06-26
**Status:** Approved

---

## Problem Statement

Gateway config (`admin_token`, `cache` toggle, provider credentials, routing rules) saat ini disimpan di `conf.json` — sebuah file statis yang harus di-edit manual dan tidak bisa di-manage secara multi-tenant. Kita ingin memindahkan semua config ke Supabase sehingga:

1. Tidak ada file secrets di repository
2. Company/tenant bisa manage provider API keys mereka sendiri via dashboard
3. Config routing (fallback, retry, load balancing) bisa disimpan sebagai preset dan di-reuse
4. Gateway tetap cepat via Cloudflare KV cache

---

## Scope

**Tiga fitur dalam satu initiative:**

### A. Gateway Settings (admin_token, cache toggle)
Pindahkan dari `conf.json` ke tabel `gateway_settings` di Supabase. Gateway baca saat startup dari env var `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_URL`.

### B. Virtual Keys
User menyimpan API keys provider (OpenAI, Anthropic, dsb.) di Supabase ter-enkripsi dengan **Supabase Vault** (`pg_vault`). Request ke gateway cukup kirim `x-haro-virtual-key: vk_xxx` tanpa expose API key asli. Gateway resolve key dari DB/KV cache.

### C. Config Presets
Routing rules (fallback, retry, load balancing, rate limit) disimpan sebagai JSON preset di tabel `gateway_configs`. Request bisa kirim `x-haro-config-id: cfg_xxx` untuk menggunakan preset tersebut.

---

## Architecture

```
Client Request
    │
    ▼
Haro Gateway (Cloudflare Worker)
    │
    ├── Header: x-haro-virtual-key: vk_xxx
    │       │
    │       ├─► Cloudflare KV lookup (cache TTL: 5 menit)
    │       │       │ HIT → decrypt & inject API key
    │       │       │ MISS ↓
    │       └─► Supabase REST API → vault.decrypted_secrets
    │               → cache ke KV → inject API key
    │
    ├── Header: x-haro-config-id: cfg_xxx
    │       │
    │       ├─► Cloudflare KV lookup (cache TTL: 10 menit)
    │       │       │ HIT → inject as x-haro-config
    │       │       │ MISS ↓
    │       └─► Supabase REST API → gateway_configs
    │               → cache ke KV → inject config
    │
    └── Forward ke LLM Provider

```

---

## Database Schema

### 1. `gateway_settings` (menggantikan conf.json)
```sql
create table public.gateway_settings (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references public.companies(id) on delete cascade,
  key         text not null,         -- 'admin_token', 'cache_enabled'
  value       text not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(company_id, key)
);
```

### 2. `gateway_virtual_keys` (Virtual Keys)
```sql
create table public.gateway_virtual_keys (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  created_by      uuid not null references auth.users(id),
  name            text not null,
  slug            text not null,         -- vk_xxxxxxxx
  provider        text not null,         -- 'openai', 'anthropic', dsb.
  vault_secret_id uuid not null,         -- referensi ke vault.secrets
  masked_key      text not null,         -- 4 karakter terakhir
  is_active       boolean not null default true,
  rate_limit_rpm  integer,               -- null = unlimited
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique(company_id, slug)
);
```

### 3. `gateway_configs` (Config Presets)
```sql
create table public.gateway_configs (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  created_by  uuid not null references auth.users(id),
  name        text not null,
  slug        text not null,         -- cfg_xxxxxxxx
  config      jsonb not null,
  is_active   boolean not null default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(company_id, slug)
);
```

---

## Cloudflare KV Cache

KV namespace: `HARO_CONFIG_CACHE`

| Key pattern | Value | TTL |
|---|---|---|
| `vk:vk_xxxxxxxx` | `{provider, apiKey}` JSON (AES-256 encrypted) | 5 menit |
| `cfg:cfg_xxxxxxxx` | Config JSON string | 10 menit |
| `settings:{company_id}` | Settings JSON | 15 menit |

---

## Security Model

- **Supabase Vault** — API keys di-enkripsi at-rest via `pg_vault`
- **RLS** — Semua tabel punya Row Level Security per `company_id`
- **Service Role** — Gateway baca via `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS, trusted service)
- **KV Encryption** — Values di KV di-enkripsi AES-256 via Web Crypto API sebelum disimpan
- **Masked display** — `masked_key` hanya 4 karakter terakhir untuk UI

---

## Migration dari conf.json

1. `conf.json` tetap berfungsi sebagai fallback jika env var DB tidak tersedia
2. Env var `USE_DB_CONFIG=true` untuk opt-in ke DB config
3. Priority: DB config > conf.json fallback

---

## Tech Stack

- **Supabase** — PostgreSQL + Vault + REST API
- **Cloudflare KV** — `HARO_CONFIG_CACHE` namespace
- **Hono** — Framework gateway (existing)
- **TypeScript + Web Crypto API** — AES-256 untuk KV encryption
