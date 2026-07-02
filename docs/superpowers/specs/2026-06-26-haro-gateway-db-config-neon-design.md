# Haro Gateway DB-Backed Config (Neon Edition) — Spec Design

**Status:** Approved, Enriched & Loopholes Hardened
**Date:** 2026-06-26
**Author:** opencode

## 1. Overview
Migrasi database konfigurasi Haro Gateway dari Supabase REST API ke **Neon Serverless Postgres** menggunakan **Neon HTTP SQL API (fetch-based)** untuk meminimalkan cold start, dependensi, dan TCP pool overhead di Cloudflare Workers.

Keamanan API Key pihak ketiga (seperti OpenAI/Anthropic) ditingkatkan menggunakan enkripsi tingkat aplikasi (**Application-Level Encryption / Zero-Knowledge**) berbasis AES-256-GCM. Database Neon hanya menyimpan cipher text terenkripsi.

---

## 2. Architecture & Data Flow

```
[Client Request]
       │ (Headers: x-haro-virtual-key, x-haro-config-id)
       ▼
[configResolver Middleware]
       │
       ├─► [Check Cloudflare KV Cache] ──(Hit)──► [Inject Header & Forward to LLM]
       │
       └─► (Miss) ──► [Promise Coalescing Check]
                            │ (In-Flight Request Lock)
                            ▼
                      [fetch to Neon HTTP API (/sql)]
                            │
                            ▼
                      [Decrypt API Key (AES-256-GCM)]
                            │
                            ▼
                      [Store to Cloudflare KV Cache]
                            │
                            ▼
                      [Inject Header & Forward to LLM]
```

---

## 3. Database Schema (Neon Postgres)

Tiga tabel akan dideklarasikan di skema `public` database Neon:

### `public.gateway_settings`
```sql
create table if not exists public.gateway_settings (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  key        text not null,
  value      text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, key)
);
```

### `public.gateway_virtual_keys`
```sql
create table if not exists public.gateway_virtual_keys (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  created_by      uuid not null references public.profiles(id), -- FIXED: referensi ke tabel profiles yang valid di Neon Anda
  name            text not null,
  slug            text not null,
  provider        text not null,
  encrypted_key   text not null, -- AES-256-GCM encrypted API key (Zero-Knowledge)
  masked_key      text not null, -- Masked version of key (e.g., ...1234)
  is_active       boolean not null default true,
  rate_limit_rpm  integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(company_id, slug)
);
```

### `public.gateway_configs`
```sql
create table if not exists public.gateway_configs (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  created_by  uuid not null references public.profiles(id), -- FIXED: referensi ke tabel profiles di Neon
  name        text not null,
  slug        text not null,
  config      jsonb not null default '{}'::jsonb,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(company_id, slug)
);
```

---

## 4. Neon HTTP Client & Security

### Neon Client Implementation (`neonClient.ts`)
Mengakses Neon menggunakan fetch native over HTTP ke `/sql` endpoint:

```typescript
export async function neonQuery<T>(
  query: string,
  params: any[],
  env: GatewayEnv
): Promise<T[]> {
  const response = await fetch(`${env.DATABASE_URL}/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Neon connection token is typically inside the DATABASE_URL or passed as a header
    },
    body: JSON.stringify({ query, params }),
  });
  
  if (!response.ok) {
    throw new Error(`Neon SQL error: ${response.statusText}`);
  }
  
  const result = await response.json() as { rows: T[] };
  return result.rows;
}
```

### Application-Level Encryption (`kvCrypto.ts`)
Menggunakan AES-256-GCM yang di-encode Base64 melalui Web Crypto API (`globalThis.crypto`).
*   **Enkripsi (saat POST Virtual Key):** API key dienkripsi di Gateway menggunakan kunci rahasia `env.KV_ENCRYPTION_KEY`, lalu disimpan ke database.
*   **Dekripsi (saat Routing Request):** Kunci didekripsi kembali di Gateway sebelum diinjeksi ke LLM provider.

---

## 5. Critical Path

Critical path menguraikan langkah-langkah kritis berurutan dengan latensi minimal (sub-1ms target pada cache hit) dari saat request masuk hingga diteruskan ke LLM provider:

1.  **Request Interception**: Middleware `configResolver` menangkap request dan membaca headers `x-haro-virtual-key` dan `x-haro-config-id`.
2.  **Fast Cache Check (KV Hit)**: 
    - Melakukan lookup ke Cloudflare KV menggunakan key `vk:<slug>` atau `cfg:<slug>`.
    - Jika data ditemukan (hit), gateway langsung mendekripsi API key dan menginjeksikannya ke request header, lalu memanggil `next()` untuk meneruskan request ke LLM Provider. **(Selesai dalam <1-2ms)**.
3.  **Neon Lookup & Decrypt (KV Miss)**:
    - Jika KV miss, lakukan fetch query SQL ke Neon HTTP SQL API `/sql`.
    - Ambil field `encrypted_key` (untuk Virtual Key) atau `config` (untuk Config Preset).
    - Dekripsi `encrypted_key` di level aplikasi menggunakan `kvCrypto.ts`.
4.  **Cache Population**:
    - Simpan data yang sudah di-resolve ke Cloudflare KV (`vk_ttl` = 5 menit, `cfg_ttl` = 10 menit) agar request berikutnya mendapatkan status KV Hit.
5.  **Request Injection**: Mutasi headers asli request dengan menyuntikkan `x-haro-provider` dan `Authorization: Bearer <decrypted_key>`, lalu teruskan ke LLM.

---

## 6. Test Cases & Scenarios

### Positive Cases (Jalur Sukses)

1.  **Resolusi Virtual Key dengan KV Cache HIT**
    - **Input**: Header `x-haro-virtual-key: vk_abcdef12` dikirim. KV Cache memiliki data `vk:vk_abcdef12` valid.
    - **Ekspektasi**: Kunci didekripsi instan, disuntikkan ke Header `Authorization` & `x-haro-provider`, dan request diteruskan ke provider asli tanpa query database Neon.
2.  **Resolusi Virtual Key dengan KV Cache MISS (First Load)**
    - **Input**: Header `x-haro-virtual-key: vk_abcdef12` dikirim. KV tidak memiliki data.
    - **Ekspektasi**: Gateway sukses memanggil Neon HTTP SQL API, mendekripsi API key, menyimpannya ke KV Cache, menyuntikkannya ke headers, dan meneruskan request ke LLM.
3.  **Lookup Config Preset Sukses**
    - **Input**: Header `x-haro-config-id: cfg_12345678` dikirim.
    - **Ekspektasi**: Gateway mengambil preset konfigurasi JSON dari Neon/KV, dan menyuntikkannya ke header `x-haro-config` dalam bentuk JSON string ter-serialize.
4.  **Admin CRUD Virtual Key Berhasil**
    - **Input**: POST `/admin/virtual-keys` dengan API key mentah.
    - **Ekspektasi**: API key berhasil dienkripsi dengan AES-256-GCM di level aplikasi, disimpan dalam bentuk cipher text ke database Neon, dan mengembalikan data metadata tersensor (masked key) dengan status `201 Created`.

### Negative Cases (Jalur Gagal & Fallbacks)

1.  **Database Connection / Neon API Timeout**
    - **Input**: KV Cache Miss dan server Neon lambat merespons atau mengembalikan error `500`.
    - **Ekspektasi**: Gateway tidak boleh crash. Resolver mendeteksi kegagalan koneksi Neon, mencatat log error, dan mengembalikan respons kegagalan yang aman (`502 Bad Gateway` atau `504 Gateway Timeout`) kepada pengguna, atau fallback ke `conf.json` lokal jika setting global menyalakan fallback.
2.  **Virtual Key Tidak Aktif / Dinonaktifkan**
    - **Input**: Request menyertakan `x-haro-virtual-key` milik kunci yang dinonaktifkan (`is_active = false` di database).
    - **Ekspektasi**: Neon/KV query mengembalikan status tidak ditemukan atau tidak aktif. Gateway menolak request dengan status `401 Unauthorized` atau `403 Forbidden` dan pesan error "Virtual key is inactive or invalid".
3.  **Kunci Enkripsi `KV_ENCRYPTION_KEY` Berubah/Salah**
    - **Input**: Environment variable `KV_ENCRYPTION_KEY` diubah secara salah, sehingga proses dekripsi data lama dari Neon gagal.
    - **Ekspektasi**: Blok dekripsi AES-256-GCM melempar error kriptografi (decryption failed). Gateway menangkap error ini secara aman, mencatat log audit error kritis, tidak mengekspos cipher text atau raw error ke client, dan mengembalikan respons `500 Internal Server Error`.
4.  **SQL Injection Attempt pada Header Slug**
    - **Input**: Header `x-haro-virtual-key` berisi muatan jahat seperti `vk_abc'; DROP TABLE gateway_virtual_keys;--`.
    - **Ekspektasi**: Karena database Neon menggunakan parameterized queries (`$1`, `$2`), input jahat tersebut sepenuhnya diperlakukan sebagai string slug statis dan tidak dieksekusi sebagai perintah SQL. Query Neon mengembalikan array kosong, dan gateway merespons `401 Unauthorized`.
5.  **Invalid Admin Token pada API CRUD**
    - **Input**: Request POST/DELETE ke endpoint `/admin/*` tanpa Authorization header yang valid atau menggunakan token admin yang salah.
    - **Ekspektasi**: `adminAuthMiddleware` menolak request dengan respons `401 Unauthorized` sebelum menyentuh layer database.

---

## 7. Stress Testing & Performance Limits Spec

Untuk membuktikan ketahanan Gateway terhadap lonjakan trafik tinggi (load spike) dan mengukur efisiensi caching layer, skenario Stress Testing dideklarasikan sebagai berikut:

### Target Benchmarks (SLA)
- **KV Cache HIT Latency**: `< 1.5ms` (99th percentile) tambahan overhead pada Gateway.
- **KV Cache MISS Latency**: `< 80ms` (ditentukan oleh kecepatan round-trip HTTP query ke Neon + dekripsi AES-256-GCM).
- **Concurrency Support**: Mampu menangani hingga `10,000` concurrent requests per detik tanpa crash atau kebocoran memori (memory leak) di runtime Cloudflare Workers.

### Skenario Stress Test (Load Testing Profile)
1.  **Warm-up Phase**: Mengirimkan 50 req/sec selama 10 detik untuk memastikan runtime di-warmup dan cache terisi sebagian.
2.  **Sustained Load Phase (KV Hit Dominant)**: Mengirimkan 2,000 req/sec selama 60 detik dengan header `x-haro-virtual-key` yang valid (ter-cache).
    *   *Kriteria Kelulusan*: Error rate `0%`, RTT tambahan `< 2ms`.
3.  **Spike Load Phase (KV Miss & Write Heavy)**: Mengirimkan spike mendadak sebesar 500 concurrent requests ke endpoint `/admin/virtual-keys` secara bersamaan. Skenario ini memaksa enkripsi intensif (AES-GCM) dan penulisan masif ke Neon.
    *   *Kriteria Kelulusan*: Max CPU/Memory usage di Cloudflare Workers tidak melebihi batas resource limits (`128MB` memory, `50ms` CPU execution time), dan Neon connection limit tidak jebol karena penggunaan fetch-based (stateless) alih-alih persistent TCP pooling.

---

## 8. Hardening against Loopholes (Case Bolong Mitigations)

Untuk memastikan keandalan tingkat produksi yang mutlak, berikut adalah mitigasi detail terhadap 9 "case-case bolong" yang telah diidentifikasi:

### Mitigasi 1: Cache Stampede Protection (Promise Coalescing)
*   **Masalah:** Ribuan request simultan saat terjadi KV Miss (atau sesaat setelah cache expired) memicu pemanggilan Neon query `/sql` secara berlebihan.
*   **Mitigasi:** Implementasikan map `inFlightRequests` dalam memori resolver untuk menduplikasi Promise resolver yang sama. Request kedua dan seterusnya yang masuk saat pencarian slug yang sama sedang berjalan akan membagikan Promise yang sama, sehingga hanya **satu** query database yang dieksekusi ke Neon.

### Mitigasi 2: Foreign Key Compatibility (`created_by` ref)
*   **Masalah:** Di Neon, tabel `auth.users` milik Supabase tidak ada secara default.
*   **Mitigasi:** Ganti semua constraint foreign key `created_by` untuk menunjuk langsung ke tabel `public.profiles(id)` yang valid dan sudah ada di Neon, memastikan integritas data terjamin dan migrasi database tidak crash.

### Mitigasi 3: Fast Revocation / Low TTL
*   **Masalah:** Penundaan sinkronisasi KV global (eventual consistency) menyebabkan kunci yang dideaktivasi oleh admin masih bisa digunakan di edge node tertentu.
*   **Mitigasi:** Batasi TTL cache KV untuk Virtual Keys maksimal hanya 60 detik (`VK_TTL = 60`), memastikan pencabutan hak akses sensitif paling lama terevokasi dalam 60 detik secara global.

### Mitigasi 4: Secure Key Masking untuk API Key Pendek
*   **Masalah:** Masking key sederhana (`slice(-4)`) membocorkan keseluruhan kunci jika panjang API key sangat pendek.
*   **Mitigasi:** Implementasikan fallback masking bersyarat berdasarkan panjang input asli:
    ```typescript
    const masked = apiKey.length > 8 
      ? `...${apiKey.slice(-4)}` 
      : `...${apiKey.slice(-2)}`;
    ```

### Mitigasi 5: Zero Kriptografi Leak (Sanitized Error Handlers)
*   **Masalah:** Pesan error enkripsi internal yang mentah bocor ke pengguna luar saat terjadi kegagalan kunci enkripsi global.
*   **Mitigasi:** Semua operasi kripto di `kvCrypto.ts` dibungkus dalam blok `try...catch` yang bersih. Jika dekripsi gagal, kembalikan null secara senyap, catat log error audit secara internal, dan kembalikan response `500` generik yang aman tanpa membocorkan pesan error kriptografi mentah.

### Mitigasi 6: In-Memory Sliding-Window Rate Limiter
*   **Masalah:** Kunci LLM disalahgunakan melebihi rate limit yang ditentukan tanpa deteksi real-time (menyebabkan tagihan bengkak).
*   **Mitigasi:** Terapkan sliding-window rate limiter stateless menggunakan Cloudflare Workers Cache API atau Workers KV dengan increment atomic, untuk melacak penggunaan RPM (Request Per Minute) secara efisien tanpa membebani database Neon.

### Mitigasi 7: Neon Active Keep-Warm & Timeout Fallback
*   **Masalah:** Neon compute suspends setelah tidak aktif, memicu cold start latency yang mengganggu UX obrolan (3-5 detik loading).
*   **Mitigasi:** 
    1. Konfigurasikan Gateway resolver dengan batas timeout ketat (`timeout: 1000ms`) untuk query ke Neon.
    2. Jika Neon tidak merespons dalam waktu 1 detik, resolver otomatis melakukan fallback membaca `conf.json` lokal untuk melayani request tanpa membuat user menunggu lama.

### Mitigasi 8: CLI Key Rotation Script
*   **Masalah:** Merotasi kunci enkripsi global `KV_ENCRYPTION_KEY` mematahkan proses dekripsi seluruh data lama di database.
*   **Mitigasi:** Sediakan script CLI administratif mandiri yang membaca seluruh Virtual Keys dari Neon menggunakan kunci enkripsi lama, mendekripsinya, mengenkripsi ulang dengan kunci baru, dan memperbarui baris-baris data tersebut di database secara otomatis sebelum deployment kunci baru diaktifkan.

### Mitigasi 9: Strict Zod JSONB Schema Validation
*   **Masalah:** Pengguna memasukkan konfigurasi preset LLM yang cacat/malformed di API admin, merusak fungsionalitas perutean global.
*   **Mitigasi:** Terapkan skema validasi Zod ketat pada endpoint `POST /admin/configs` untuk memastikan struktur preset JSON terbukti valid sebelum di-insert ke kolom `config` database.
