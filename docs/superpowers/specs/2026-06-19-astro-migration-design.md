# Design: Migrate Tenang Web from Next.js to Astro + Cloudflare Workers

**Date:** 2026-06-19
**Status:** Draft, pending user review
**Author:** brainstorming session

## Goal

Migrate the `apps/website` workspace from Next.js 15 to Astro 5, with React islands for interactive blocks, deploying to Cloudflare Workers. The shared component library `@treonstudio/bungas-core` and the shadcn registry output remain unchanged.

## Non-goals

- Not changing `packages/core` (no API refactor, no Node API removal beyond what Workers strictly requires).
- Not changing the shadcn registry output (still React-only).
- Not optimizing bundle size — that is a follow-up after migration succeeds.
- Not adding tests, CI, or a new deploy pipeline beyond `wrangler deploy`.

## Stack

| Layer | Before | After |
| --- | --- | --- |
| App framework | Next.js 15.3.8 (RSC + client) | Astro 5 (`.astro` + React island) |
| Bundler | Next/Turbopack | Vite (Astro's bundler) + `@tailwindcss/vite` |
| Styling | Tailwind v4 via `@tailwindcss/postcss` | Tailwind v4 via `@tailwindcss/vite` |
| Image | `next/image` | `astro:assets` `<Image />` di `.astro`, props-precomputed untuk island |
| Lint | `next lint` (deprecated) | `eslint .` flat config + `eslint-plugin-astro` |
| Type check | `next build` implicit | `astro check` (eksplisit) + `astro build` |
| Deploy | Vercel (implisit) | Cloudflare Workers via `@astrojs/cloudflare` + `wrangler` |
| Shared UI | `@treonstudio/bungas-core` (path alias) | sama, via Vite alias di `astro.config.mjs` |
| Registry | `shadcn build` → React output | sama, tidak berubah |

## Workspace structure

```
tenang/                                  # monorepo root
├── apps/
│   └── website/                         # Next.js → Astro
│       ├── astro.config.mjs             # BARU
│       ├── wrangler.jsonc               # BARU
│       ├── src/
│       │   ├── pages/
│       │   │   └── index.astro          # BARU — replacement untuk app/page.tsx
│       │   ├── layouts/
│       │   │   └── BaseLayout.astro     # BARU — <html>, <head>, font, css
│       │   ├── sections/                # BARU — blok-level components
│       │   │   ├── hero-section/
│       │   │   │   ├── hero-section.astro
│       │   │   │   └── variants/
│       │   │   │       ├── one/{index.tsx,header.tsx}
│       │   │   │       ├── two/{...}
│       │   │   │       ├── three/{...}
│       │   │   │       ├── four/{...}
│       │   │   │       └── five/{index.tsx,header.tsx}
│       │   │   ├── faqs/...
│       │   │   ├── footer/...
│       │   │   └── (lainya, lihat tabel klasifikasi)
│       │   ├── components/              # shared, non-blok
│       │   │   └── logo.astro           # konversi dari components/logo.tsx
│       │   ├── styles/
│       │   │   └── globals.css          # dipindah dari app/globals.css
│       │   └── env.d.ts                 # BARU — Astro types
│       ├── public/                      # static assets
│       ├── tsconfig.json                # extends @treonstudio/ts-config/astro.json (BARU)
│       ├── package.json                 # scripts diupdate
│       ├── components.json              # shadcn — tidak berubah
│       └── README.md                    # diupdate
├── packages/
│   ├── core/                            # tidak berubah
│   └── ts-config/
│       ├── base.json                    # tidak berubah
│       └── astro.json                   # BARU — Astro extends ini
├── turbo.json                           # diupdate minor
├── package.json                         # scripts diupdate
└── AGENTS.md                            # diupdate post-migrasi
```

**File yang dihapus dari `apps/website/`:**
- `app/` (Next.js App Router)
- `next.config.ts`
- `next-env.d.ts`
- `postcss.config.mjs` (Tailwind v4 pindah ke Vite)
- `eslint.config.mjs` (diganti config baru — atau di-drop dulu)

## Block migration strategy

### Klasifikasi (berdasarkan grep `'use client'` di repo)

| Section | Variants interaktif (→ React island) | Variants static (→ `.astro`) |
| --- | --- | --- |
| `hero-section` | 1, 2, 3, 4 (header.tsx) | 5 |
| `faqs` | 1, 2, 3, 5 (Accordion) | 4 |
| `footer` | 5 (theme switcher), 6 (social medians) | 1, 2, 3, 4 |
| `logo-cloud` | 2 (animasi) | 1 |
| `features` | 3 (animasi) | 1, 2 |
| `integrations` | — | 1, 2 |
| `content` | — | 1, 2, 3 |
| `stats` | — | 1, 2, 3, 4 |
| `testimonials` | — | 1, 2, 3, 4 |
| `team` | — | 1, 2 |
| `call-to-action` | — | 1, 2, 3, 4 |
| `pricing` | — | 1, 2, 3 |
| `comparator` | — | 1, 2, 3 |
| `login` | — | 1, 2, 3 |
| `sign-up` | — | 1, 2, 3 |
| `forgot-password` | — | 1, 2, 3 |
| `contact` | — | 1, 2 |

Total: **12 variants React island, 45 variants `.astro`**, 57 total block files.

### Konvensi folder per section

```
src/sections/<section>/
├── <section>.astro       # thin wrapper; render default variant
└── variants/
    └── <variant>/
        ├── index.tsx     # React component (untuk island)
        └── header.tsx    # opsional; sub-component
```

Atau untuk variant static:

```
src/sections/<section>/
├── <section>.astro
└── variants/
    └── <variant>/
        └── index.astro   # Astro component
```

**Rule konsisten:** nama file di `variants/<variant>/` adalah `index.tsx` (untuk React) atau `index.astro` (untuk static), TIDAK `one.tsx` flat seperti di Next.js layout lama. Ini migrasi yang baik karena:
- Konsisten dengan Astro idiom
- Memisahkan island vs static lebih eksplisit
- Header sub-file tetap di sibling yang sama

### Wrapper `<section>.astro`

```astro
---
// src/sections/hero-section/hero-section.astro
import HeroSectionThree from './variants/three/index.tsx'

// Default variant: three. Bisa di-override per page.
const { variant = 'three' } = Astro.props

const Variant = {
  one: () => import('./variants/one/index.tsx'),
  two: () => import('./variants/two/index.tsx'),
  three: () => import('./variants/three/index.tsx'),
  four: () => import('./variants/four/index.tsx'),
  five: () => import('./variants/five/index.tsx'),
}[variant]

const Comp = await Variant()
---

<Comp client:visible />
```

Untuk variant static (misal `logo-cloud/one`):

```astro
---
// src/sections/logo-cloud/logo-cloud.astro
import LogoCloudOne from './variants/one/index.astro'

const { variant = 'one' } = Astro.props
const Variant = {
  one: () => import('./variants/one/index.astro'),
  two: () => import('./variants/two/index.tsx'),  // variant 2 is interactive
}[variant]
const Comp = await Variant()
---

{variant === 'two' ? <Comp client:visible /> : <Comp />}
```

Catatan: `import()` dynamic dalam script Astro untuk code-splitting per-variant. Astro akan auto-bundle per-island.

### Page composition (`src/pages/index.astro`)

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro'
import HeroSection from '../sections/hero-section/hero-section.astro'
import LogoCloud from '../sections/logo-cloud/logo-cloud.astro'
// ... dst
---

<BaseLayout>
  <HeroSection />
  <LogoCloud />
  <!-- ... dst, urutan sama dengan app/page.tsx lama -->
</BaseLayout>
```

**`blockMap` registry lama (`apps/website/blocks/index.ts`) tidak dipakai lagi.** Astro tidak butuh code-splitting eksplisit di level page; setiap island sudah otomatis di-lazy-mount sesuai `client:*` directive.

`apps/website/blocks/` direktori akan dihapus seluruhnya.

## Astro config & tooling

### `apps/website/astro.config.mjs`

```js
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import cloudflare from '@astrojs/cloudflare'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@treonstudio/bungas-core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
      },
    },
    build: {
      sourcemap: true,  // ganti productionBrowserSourceMaps: true
    },
  },
  image: {
    domains: ['ik.imagekit.io', 'images.unsplash.com', 'avatars.githubusercontent.com'],
  },
})
```

- `output: 'server'` + `export const prerender = true` per route = hybrid (default static, opt-in ke Worker)
- `tailwindcss` Vite plugin (ganti PostCSS)
- `image.domains` whitelist — Astro 5 API. Astro 4: `image.remotePatterns`.
- `vite.build.sourcemap: true` menggantikan `next.config.ts#productionBrowserSourceMaps`

### `apps/website/wrangler.jsonc` (BARU)

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "tenang-web",
  "compatibility_date": "2025-01-15",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "directory": "./dist", "binding": "ASSETS" },
  "main": "./dist/_worker.js/index.js",
  "observability": { "enabled": true }
}
```

- `compatibility_date` di-pin (bukan `"latest"` — bisa break)
- `nodejs_compat` untuk amannya deps yang pakai Node API

### `packages/ts-config/astro.json` (BARU)

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "astro",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@treonstudio/bungas-core/*": ["../core/src/*"]
    }
  }
}
```

### `apps/website/tsconfig.json` (diupdate)

```json
{
  "extends": "@treonstudio/ts-config/astro.json",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

### `apps/website/package.json` (diupdate)

```json
{
  "name": "@treonstudio/website",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "deploy": "astro build && wrangler deploy",
    "check": "astro check",
    "lint": "eslint ."
  },
  "dependencies": {
    "@astrojs/check": "^0.9.0",
    "@astrojs/cloudflare": "^11.0.0",
    "@astrojs/react": "^4.0.0",
    "astro": "^5.0.0",
    "@treonstudio/bungas-core": "workspace:*",
    "@treonstudio/ts-config": "workspace:*",
    "@radix-ui/react-hover-card": "^1.1.13",
    "@radix-ui/react-slot": "^1.1.2",
    "@radix-ui/react-toggle": "^1.1.8",
    "@radix-ui/react-toggle-group": "^1.1.9",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.475.0",
    "motion": "^12.4.3",
    "next-themes": "^0.4.6",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^3.0.1",
    "wrangler": "^3.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.6",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-plugin-astro": "^1.3.0",
    "tailwindcss": "^4.1.6",
    "typescript": "latest"
  }
}
```

**Removed:** `next`, `next-themes` masih dipakai (ada di footer theme switcher — perlu dicek), `eslint-config-next`, `@tailwindcss/postcss`.

**Catatan `next-themes`:** dipake di `footer/six/theme-switcher.tsx` dan `footer/five/theme-switcher.tsx`. Hooks ini jalan di client (sudah `'use client'`), jadi aman di React island.

### Root `package.json` (diupdate)

```json
{
  "name": "tailark",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "start": "astro preview",
    "lint": "eslint .",
    "registry:build": "shadcn build"
  }
}
```

Catatan: `dev`/`build`/`start` di root jadi langsung Astro (tidak butuh turbo dispatch karena `apps/website` adalah satu-satunya app). Jika ingin keep turbo: ubah jadi `turbo run dev` dll, dan pastikan `turbo.json#tasks.dev` cache: false (sudah).

### `turbo.json` (diupdate minor)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "start": { "dependsOn": ["^build"] },
    "lint": { "cache": false, "outputs": [] },
    "dev": { "cache": false, "persistent": true },
    "check": { "cache": false, "outputs": [] },
    "registry:build": { "cache": false, "outputs": [] }
  }
}
```

## Image handling

**Audit dari repo saat ini:**
- 11 file `import Image from 'next/image'`: `stats/four`, `team/{one,two}`, `pricing/{one,two,three}` (salah — recheck: only `pricing/two` from Link, all pricing blocks use `next/link` for Link), `hero-section/{one,two,three,four,five}/index.tsx`, `testimonials/{one,two,three,four}/index.tsx`, `stats/three/index.tsx`. Total ~13 files.
- ~50 file `import Link from 'next/link'` (semua blok, kecuali yang tidak pakai navigasi).

**Strategi migrasi:**

- **Di `.astro` files:** pakai `<Image />` dari `astro:assets` dengan `import { Image } from 'astro:assets'`. Optimized otomatis.
- **Di React island:** `astro:assets` tidak bisa di-import di `.tsx` files. Solusi: `getImage()` di parent `.astro`, pass hasilnya sebagai props:
  ```astro
  ---
  import { getImage } from 'astro:assets'
  const img = await getImage({ src: import.meta.env.PUBLIC_LOGO, format: 'webp' })
  ---
  <HeroHeader image={img} client:visible />
  ```
  Component React menerima `image: { src, attributes, srcSet }` dan render `<img {...image.attributes} />` atau `<picture>`.
- **Untuk `next/link`:** replace dengan native `<a href>` di semua tempat. Marketing site tidak butuh client-side routing — tidak ada router. Astro `<a>` otomatis di-prefetch, tidak ada overhead.
- **Remote images:** set di `astro.config.mjs#image.domains`. Tetap 3 host yang di-allowlist saat ini.
- **Local assets:** taruh di `src/assets/`. Astro hash dan optimize otomatis.

## Lint & type check

### ESLint

`apps/website/eslint.config.mjs` (BARU):

```js
import { FlatCompat } from '@eslint/eslintrc'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const compat = new FlatCompat({ baseDirectory: __dirname })

export default [
  ...compat.extends('plugin:astro/recommended'),
  {
    rules: {
      // add project-specific rules
    },
  },
]
```

`pnpm lint` di root = `eslint .` di website (via turbo pipeline). Drop `next lint` sepenuhnya.

### Type check

`pnpm check` di website = `astro check` (perlu `@astrojs/check`).

Tambah `astro check` ke pipeline: `pnpm install` → `pnpm --filter @treonstudio/website build` (otomatis run `astro check` sebelum build).

## Shadcn registry

- `apps/website/components.json` — **tidak berubah** (new-york, RSC, lucide)
- `pnpm registry:build` — **tidak berubah** (`shadcn build` di root)
- Output blok: React `.tsx` files, seperti sekarang
- Block registry (`apps/website/blocks/index.ts`) — **dihapus**, karena:
  1. Astro mount blok langsung di `.astro` page, tidak butuh runtime registry
  2. shadcn registry publish sebagai installable file, bukan runtime module
- Consumer (project Astro di luar) yang install blok: mount via `client:visible` di `.astro` page mereka. Spec ini tidak menambah adapter.

## Deploy

### Pipeline

1. `pnpm install` di root
2. `pnpm build` (turbo) → `astro build` di `apps/website/` → output di `dist/`
3. `pnpm deploy` di `apps/website/` (atau `wrangler deploy`) → push ke Cloudflare Workers

### Cloudflare Workers config

- `compatibility_date: "2025-01-15"` di-pin
- `compatibility_flags: ["nodejs_compat"]` — banyak deps React assume Node API
- Static assets di-serve via `ASSETS` binding (Astro Cloudflare adapter handle otomatis)
- Observability enabled untuk debugging

### Local preview

- `pnpm --filter @treonstudio/website preview` → `astro preview` (preview built output)
- Untuk emulate Workers runtime: `wrangler dev` (lebih akurat dari `astro preview`)
- `astro dev` untuk dev dengan HMR (Vite-based)

## Verifikasi

Sebelum klaim migrasi selesai:

1. `pnpm install` — workspace sync tanpa error
2. `pnpm --filter @treonstudio/website check` — `astro check` lulus
3. `pnpm --filter @treonstudio/website build` — build sukses, no warnings
4. `pnpm --filter @treonstudio/bungas-core lint` — eslint lulus
5. `pnpm --filter @treonstudio/website lint` — eslint lulus
6. `pnpm --filter @treonstudio/website preview` — buka `http://localhost:4321` (atau port Astro), cek visual parity dengan Next.js version
7. `wrangler dev` (optional) — smoke test di Workers runtime
8. Cek `dist/` size — apakah mendekati 1 MB Workers limit (mitigasi via island splitting otomatis)

## Risks

1. **Bundle size Workers limit (1 MB free, 10 MB paid).** `motion` dan `recharts` (di `packages/core`) keduanya besar. Mitigasi: per-island splitting otomatis oleh Astro. **Validasi post-build:** ukur `dist/_worker.js/index.js`.

2. **`verbatimModuleSyntax: true` di `packages/core/tsconfig.app.json`.** Astro+Vite mungkin strict tentang `import type`. Validasi di iterasi pertama; jika break, override per-file di website tsconfig.

3. **`packages/core` punya deps Node-only yang tidak kompatibel dengan Workers.** Saat ini dependencies core: `@radix-ui/*`, `recharts`, `react-use-measure`, `motion`, `clsx`, `tailwind-merge`. Semuanya isomorphic. Tapi `react` dan `react-dom` perlu React 19, dan React Server Components tidak relevan di Astro. **Mitigasi:** tidak ada kode `packages/core/src/**` yang import `fs`/`path`/`process` (akan dicek saat implementation). Jika ada, refactor.

4. **`shadcn build` mungkin gagal jika `blocks/index.ts` dihapus.** Registry butuh file source. Mitigasi: shadcn build scan folder, bukan registry tertentu. Atau: keep `blocks/index.ts` sebagai registry source shadcn-only, tapi mark sebagai legacy dan exclude dari page composition. **Decision:** cek dokumentasi shadcn build; jika butuh registry file, keep `blocks/` dan ignore di page composition.

5. **Hero section interactive patterns** — beberapa variant hero pakai `useMedia` hook dari `@treonstudio/bungas-core/hooks/use-media`. Hook murni (pakai `window.matchMedia`), aman di island.

6. **`next-themes` di footer theme switcher.** `useTheme` dipakai di `footer/five/theme-switcher.tsx` dan `footer/six/theme-switcher.tsx`, **tapi TIDAK ada `<ThemeProvider>` di app** (sudah di-grep). Ini bug di versi Next.js saat ini juga — theme switcher tidak work karena context tidak ada. Saat migrasi, **tetap bug-for-bug compatible** (jangan fix). `next-themes` tetap di `package.json` karena dependensi masih dipakai. Validasi: `next-themes` work sebagai React-only library (tidak butuh Next.js context) asal `<ThemeProvider>` di-wrap di `BaseLayout.astro` via island kecil. **Decision:** tambahkan `<ThemeProvider>` island di `BaseLayout.astro` (1 small island) untuk restore fungsionalitas. Atau drop theme switcher entirely.

7. **Cloudflare `compatibility_date`** — di-pin ke `2025-01-15`. Jika deployment tertunda lama, update tanggal ini untuk dapat Workers runtime baru. Schedule review per quarter.

8. **Block `footer/six` import `next-themes` & `next/link`.** `next/link` perlu di-replace dengan `<a>` atau Astro `<Link>`. Validasi saat porting.

## Implementation phasing (high-level)

1. **Phase 0: Setup**
   - Init `astro.config.mjs`, `wrangler.jsonc`, `tsconfig.json` baru
   - Tambah dependencies di `apps/website/package.json`
   - `pnpm install`
2. **Phase 1: Layout & static blocks (`.astro`)**
   - `BaseLayout.astro` + `globals.css` (copy dari `app/`)
   - 45 static block variants → `index.astro` (rewrite JSX → Astro syntax)
   - Section wrappers `<section>.astro` yang import static variants
3. **Phase 2: React island blocks (`.tsx`)**
   - 12 interactive block variants → `index.tsx` (copy dari Next.js version, replace `next/link` → `<a>`, `next/image` → props)
   - Section wrappers render via `client:visible`
4. **Phase 3: Page composition**
   - `src/pages/index.astro` — sequence import blok
   - Hapus `app/`, `next.config.ts`, `blocks/index.ts`, `postcss.config.mjs`
5. **Phase 4: Image handling**
   - Replace `next/image` di blok `.astro` dengan `<Image />` dari `astro:assets`
   - Untuk island: `getImage()` di parent `.astro`, pass props
6. **Phase 5: Verifikasi & polish**
   - `astro check`, `astro build`, `astro preview`
   - `wrangler dev` smoke test
   - Bundle size check
7. **Phase 6: Docs & cleanup**
   - Update `AGENTS.md` (ganti Next.js notes dengan Astro notes)
   - Update `apps/website/README.md`
   - Hapus Next.js artifacts (config, dependencies)

## Open questions

- `next-themes` di `footer/six` dan `footer/five` — saat ini TIDAK ada `<ThemeProvider>` (bug di versi Next.js). Saat migrasi: tambah `<ThemeProvider>` island di `BaseLayout.astro` agar theme switcher berfungsi, ATAU drop theme switcher. **Default:** tambah provider island untuk restore fungsionalitas.
- `next/link` (~50 file) — replace dengan native `<a href>` di semua tempat. Marketing site tidak butuh client-side routing.
- `eslint-plugin-astro` setup — perlu config khusus untuk Astro components? Default `plugin:astro/recommended` cukup.
- Bundle size — perlu di-ukur setelah build pertama. Target: di bawah 1 MB agar free tier Workers cukup.

## Deferred

- Bundle optimization (tree-shaking, dynamic imports manual)
- Image CDN replacement
- Migration `.astro` files untuk blok yang ditulis dalam JSX → `.astro` syntax (semua blok tetap React untuk konsistensi fase 1; konversi di-follow-up)
- Workers KV/D1/R2 untuk form handling (saat ini tidak ada form backend)
- i18n / multi-locale (saat ini single locale `en`)
- Testing (zero test infra saat ini — tambah jika user mau)
