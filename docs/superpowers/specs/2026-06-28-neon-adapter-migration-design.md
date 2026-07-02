# Spec: Neon Database Adapter Architecture Migration

Tujuan dokumen ini adalah memindahkan semua database access logic di aplikasi Tenang dari Supabase client shim (`NeonCompatClient`) ke Neon murni dengan raw SQL, menggunakan DDD Adapter Architecture.

## Background & Architecture

Saat ini, `apps/website` mengimplementasikan repository domain (seperti `projects`, `skills`, dll.) menggunakan adapter Supabase (`makeSupabaseProjectsRepository`). Namun, karena Supabase client sebenarnya di-shim menggunakan `NeonCompatClient` yang berjalan di atas `@neondatabase/serverless`, query PostgREST diterjemahkan secara dinamis ke SQL.

Dengan migrasi ini, kita akan:
1. Menghilangkan layer abstraksi `NeonCompatClient` untuk query.
2. Menghilangkan runtime parser PostgREST-to-SQL yang rawan bug.
3. Mengimplementasikan raw SQL parameterized query murni menggunakan `@/lib/neon/client`.
4. Mengamankan query server-side murni dengan memverifikasi token session `tenang-session` dan memasukkan `userId` / `companyId` langsung ke dalam parameter SQL (RLS di level Application/Service Adapter).

### DDD Adapter Pattern Structure

Setiap domain akan memiliki:
1. **Repository Interface (Port)**: `domain/<name>/<name>.repository.ts` (misal `IProjectsRepository` Tag)
2. **Neon Infrastructure Adapter**: `domain/<name>/<name>.repository.neon.ts` (misal `makeNeonProjectsRepository`)
3. **Penyambungan (Binding)**: `lib/api-helpers.ts` menyambungkan HTTP API Context ke Neon repository.

---

## Technical Specifications

### 1. Session & Auth Context Extraction
Neon repository akan mengekstrak user session menggunakan helper dari `getSessionToken` dan `verifySession` (JWT decoding murni secara server-side).

Setiap repository method yang membutuhkan otorisasi akan:
1. Membaca cookie `tenang-session` atau cookie header dari request context.
2. Memverifikasi session payload.
3. Menggunakan `userId` / `companyId` dari session payload sebagai SQL parameters.

### 2. SQL Query Mapping (Supabase -> Neon Raw SQL)

Contoh pemetaan untuk Projects:
- **Supabase**:
  ```ts
  supabase.from("projects").insert({ name, user_id: userId, company_id: companyId }).select().single()
  ```
- **Neon Raw SQL**:
  ```sql
  INSERT INTO public.projects (name, user_id, company_id) VALUES ($1, $2, $3) RETURNING *
  ```

### 3. Binding di `api-helpers.ts`

`api-helpers.ts` akan di-update untuk menginstansiasi Neon repository:
```ts
export const runProjectsEffect = <A>(
  context: APIContext,
  effect: Effect.Effect<A, any, IProjectsRepository>,
): Promise<A> => {
  const neonRepo = makeNeonProjectsRepository(context)
  // provide service projects
}
```

---

## Migration Roadmap (15 Domains)

Semua file `.repository.supabase.ts` berikut akan digantikan oleh `.repository.neon.ts`:
1. **agents** (`agents.repository.supabase.ts` -> `agents.repository.neon.ts`)
2. **analytics** (`analytics.repository.supabase.ts` -> `analytics.repository.neon.ts`)
3. **billing** (`billing.repository.supabase.ts` -> `billing.repository.neon.ts`)
4. **branding** (`branding.repository.supabase.ts` -> `branding.repository.neon.ts`)
5. **companies** (`companies.repository.supabase.ts` -> `companies.repository.neon.ts`)
6. **company-admin-ops** (`company-admin-ops.repository.supabase.ts` -> `company-admin-ops.repository.neon.ts`)
7. **invitations** (`invitations.repository.supabase.ts` -> `invitations.repository.neon.ts`)
8. **notifications** (`notifications.repository.supabase.ts` -> `notifications.repository.neon.ts`)
9. **profiles** (`profiles.repository.supabase.ts` -> `profiles.repository.neon.ts`)
10. **projects** (`projects.repository.supabase.ts` -> `projects.repository.neon.ts`)
11. **prompts** (`prompts.repository.supabase.ts` -> `prompts.repository.neon.ts`)
12. **safety** (`safety.repository.supabase.ts` -> `safety.repository.neon.ts`)
13. **skills** (`skills.repository.supabase.ts` -> `skills.repository.neon.ts`)
14. **super-admin** (`super-admin.repository.supabase.ts` -> `super-admin.repository.neon.ts`)
15. **super-admin-ops** (`super-admin-ops.repository.supabase.ts` -> `super-admin-ops.repository.neon.ts`)

---

## Verification & Testing
1. Semua unit tests untuk masing-masing domain (`pnpm test` dari `apps/website`) wajib lulus.
2. Build pipeline `pnpm build` wajib sukses.
