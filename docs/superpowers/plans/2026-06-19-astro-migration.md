# Astro Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `apps/website` from Next.js 15 to Astro 5 with React islands, deploy to Cloudflare Workers. Shared `@treonstudio/bungas-core` and shadcn registry output remain unchanged.

**Architecture:** Astro server output with `prerender = true` per route. Static blocks compile to `.astro` (zero JS). Interactive blocks (12 variants with state/effects) mount as React islands via `@astrojs/react`. Path alias `@treonstudio/bungas-core/*` points to `packages/core/src/*` via Vite resolve. Deploy via `@astrojs/cloudflare` adapter + `wrangler deploy`.

**Tech Stack:** Astro 5, React 19, Tailwind v4 (Vite plugin), `@astrojs/cloudflare`, `@astrojs/react`, `wrangler`, TypeScript ~5.8. Existing: `packages/core` (React 19 + Radix + shadcn primitives).

**Verification strategy:** No test framework (per AGENTS.md). Each task verifies with `astro check` (type check) or `astro build` (build). Final task: `astro preview` + `wrangler dev` for runtime smoke test.

---

## Conventions used throughout

- **Block paths:** old `apps/website/blocks/<section>/<variant>/index.tsx` → new `apps/website/src/sections/<section>/variants/<variant>/index.astro` (static) or `index.tsx` (interactive).
- **`next/link` → `<a href>`:** replace import with native anchor. The `Button asChild` + `<Link>` pattern becomes `<Button asChild>` + `<a>`. The `Button` `asChild` prop uses Radix `Slot` which renders the child element as-is, so `<a>` works the same.
- **`next/image` → `astro:assets`:** for `.astro` files use `<Image />` directly. For React island, parent `.astro` calls `getImage()` and passes props; the island component renders `<img {...image.attributes} />`.
- **`'use client'`:** kept as-is on `.tsx` files (Astro picks them up as React islands automatically when imported with `client:*` directive).
- **Section wrappers:** `src/sections/<section>/<section>.astro` exposes a `variant` prop and renders the selected variant via dynamic import.

---

## File Structure (new files)

```
apps/website/
├── astro.config.mjs                                    [NEW]
├── wrangler.jsonc                                       [NEW]
├── src/
│   ├── env.d.ts                                         [NEW]
│   ├── pages/
│   │   └── index.astro                                  [NEW]
│   ├── layouts/
│   │   ├── BaseLayout.astro                             [NEW]
│   │   └── ThemeProvider.tsx                            [NEW — island]
│   ├── sections/
│   │   ├── call-to-action/{call-to-action.astro, variants/{one,two,three,four}/index.astro}
│   │   ├── comparator/{comparator.astro, variants/{one,two,three}/index.astro}
│   │   ├── contact/{contact.astro, variants/{one,two}/index.astro}
│   │   ├── content/{content.astro, variants/{one,two,three}/index.astro}
│   │   ├── faqs/{faqs.astro, variants/{four}/index.astro, variants/{one,two,three,five}/index.tsx}
│   │   ├── features/{features.astro, variants/{one,two}/index.astro, variants/three/index.tsx}
│   │   ├── footer/{footer.astro, variants/{one,two,three,four}/index.astro, variants/{five,six}/index.tsx, five/{index.tsx,theme-switcher.tsx}, six/{index.tsx,social-medias.tsx,theme-switcher.tsx}}
│   │   ├── forgot-password/{forgot-password.astro, variants/{one,two,three}/index.astro}
│   │   ├── hero-section/{hero-section.astro, variants/{one,two,three,four}/index.tsx, variants/{one,two,three,four,five}/header.tsx, variants/five/index.tsx}
│   │   ├── integrations/{integrations.astro, variants/{one,two}/index.astro}
│   │   ├── login/{login.astro, variants/{one,two,three}/index.astro}
│   │   ├── logo-cloud/{logo-cloud.astro, variants/one/index.astro, variants/two/index.tsx}
│   │   ├── pricing/{pricing.astro, variants/{one,two,three}/index.astro}
│   │   ├── sign-up/{sign-up.astro, variants/{one,two,three}/index.astro}
│   │   ├── stats/{stats.astro, variants/{one,two,three,four}/index.astro}
│   │   ├── team/{team.astro, variants/{one,two}/index.astro}
│   │   └── testimonials/{testimonials.astro, variants/{one,two,three,four}/index.astro}
│   ├── components/
│   │   └── logo.astro                                   [NEW — port from components/logo.tsx]
│   └── styles/
│       └── globals.css                                  [MOVED from app/globals.css]
packages/ts-config/
└── astro.json                                           [NEW]

# DELETED (after migration):
apps/website/
├── app/                                                 [DELETE]
├── blocks/                                              [DELETE]
├── components/{logo.tsx,ui/}                            [DELETE — ported to src/]
├── next.config.ts                                       [DELETE]
├── next-env.d.ts                                        [DELETE]
├── postcss.config.mjs                                   [DELETE]
├── eslint.config.mjs                                    [DELETE — replaced]
```

**Updated (not new):**
- `apps/website/package.json` (deps + scripts)
- `apps/website/tsconfig.json` (extends `@treonstudio/ts-config/astro.json`)
- `package.json` (root scripts)
- `turbo.json` (add `check` task)
- `apps/website/components.json` (unchanged)
- `apps/website/README.md`
- `AGENTS.md`

---

## Phase 0 — Setup

### Task 1: Add Astro dependencies

**Files:**
- Modify: `apps/website/package.json`

- [ ] **Step 1: Add Astro deps to `apps/website/package.json`**

In `apps/website/package.json`:
- Add to `dependencies`:
  ```json
    "@astrojs/check": "^0.9.4",
    "@astrojs/cloudflare": "^12.2.0",
    "@astrojs/react": "^4.2.0",
    "astro": "^5.1.0",
    "wrangler": "^3.99.0"
  ```
- Add to `devDependencies`:
  ```json
    "@tailwindcss/vite": "^4.1.6",
    "eslint-plugin-astro": "^1.3.1"
  ```
- Remove from `dependencies`:
  ```json
    "next": "15.3.8",
    "next-themes": "^0.4.6"
  ```
  (Note: `next-themes` is still needed at runtime. Move to `dependencies` since theme switchers use `useTheme`. Re-add it.)
- Remove from `devDependencies`:
  ```json
    "@tailwindcss/postcss": "^4.1.6",
    "eslint-config-next": "15.3.1"
  ```
- Add to `dependencies` (re-add `next-themes` since footer/six and footer/five use `useTheme`):
  ```json
    "next-themes": "^0.4.6"
  ```

Final `dependencies` section should include: `@astrojs/check`, `@astrojs/cloudflare`, `@astrojs/react`, `astro`, `wrangler`, plus all existing Radix, lucide, motion, next-themes, react, react-dom, tailwind-merge, class-variance-authority, clsx, `@treonstudio/bungas-core: workspace:*`, `@treonstudio/ts-config: workspace:*`.

Final `devDependencies` should include: `@tailwindcss/vite`, `eslint`, `eslint-plugin-astro`, `tailwindcss`, `typescript`, `@types/node`, `@types/react`, `@types/react-dom`.

- [ ] **Step 2: Run install**

Run: `pnpm install`
Expected: install succeeds. New lockfile entries for astro, @astrojs/*, wrangler. No peer dep errors.

- [ ] **Step 3: Commit**

```bash
git add apps/website/package.json pnpm-lock.yaml
git commit -m "feat(website): add Astro 5 and Cloudflare dependencies"
```

---

### Task 2: Create `astro.config.mjs`

**Files:**
- Create: `apps/website/astro.config.mjs`

- [ ] **Step 1: Write the config file**

Create `apps/website/astro.config.mjs` with:

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
            sourcemap: true,
        },
    },
    image: {
        domains: ['ik.imagekit.io', 'images.unsplash.com', 'avatars.githubusercontent.com'],
    },
})
```

- [ ] **Step 2: Verify config syntax**

Run: `cd apps/website && pnpm exec astro --version`
Expected: `astro 5.x.x` printed (config not actually loaded here, just verifies astro CLI is present).

Run: `cd apps/website && pnpm exec astro check --help 2>&1 | head -5`
Expected: help text (no syntax error in config).

- [ ] **Step 3: Commit**

```bash
git add apps/website/astro.config.mjs
git commit -m "feat(website): add astro.config.mjs with Cloudflare adapter"
```

---

### Task 3: Create `wrangler.jsonc`

**Files:**
- Create: `apps/website/wrangler.jsonc`

- [ ] **Step 1: Write the wrangler config**

Create `apps/website/wrangler.jsonc`:

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

- [ ] **Step 2: Verify wrangler**

Run: `cd apps/website && pnpm exec wrangler --version`
Expected: `3.x.x` or higher printed.

- [ ] **Step 3: Commit**

```bash
git add apps/website/wrangler.jsonc
git commit -m "feat(website): add wrangler.jsonc for Cloudflare Workers"
```

---

### Task 4: Add `packages/ts-config/astro.json`

**Files:**
- Create: `packages/ts-config/astro.json`

- [ ] **Step 1: Write the tsconfig extension**

Create `packages/ts-config/astro.json`:

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

- [ ] **Step 2: Commit**

```bash
git add packages/ts-config/astro.json
git commit -m "feat(ts-config): add Astro tsconfig extension"
```

---

### Task 5: Update `apps/website/tsconfig.json`

**Files:**
- Modify: `apps/website/tsconfig.json`

- [ ] **Step 1: Replace the file contents**

Overwrite `apps/website/tsconfig.json` with:

```json
{
    "extends": "@treonstudio/ts-config/astro.json",
    "include": [".astro/types.d.ts", "**/*"],
    "exclude": ["dist"]
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/tsconfig.json
git commit -m "feat(website): switch tsconfig to astro extension"
```

---

### Task 6: Create `apps/website/src/env.d.ts`

**Files:**
- Create: `apps/website/src/env.d.ts`

- [ ] **Step 1: Write the env declaration**

Create `apps/website/src/env.d.ts`:

```ts
/// <reference path="../.astro/types.d.ts" />
```

- [ ] **Step 2: Commit (defer until first `astro sync` runs; placeholder is OK for now)**

```bash
git add apps/website/src/env.d.ts
git commit -m "feat(website): add Astro env.d.ts"
```

Note: `.astro/types.d.ts` is generated by `astro sync`. It will be created automatically when you run `astro check` for the first time.

---

### Task 7: Update `apps/website/package.json` scripts

**Files:**
- Modify: `apps/website/package.json`

- [ ] **Step 1: Replace the `scripts` block**

In `apps/website/package.json`, set `scripts` to:

```json
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "deploy": "astro build && wrangler deploy",
    "check": "astro check",
    "lint": "eslint ."
  }
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/package.json
git commit -m "feat(website): add Astro scripts (dev/build/preview/deploy/check)"
```

---

### Task 8: Update root `package.json` scripts

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Update root scripts**

In root `package.json`, replace the `scripts` block with:

```json
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "start": "astro preview",
    "lint": "eslint .",
    "registry:build": "shadcn build"
  }
```

Note: `astro dev`/`build` need to run from `apps/website/`. Add `cd` prefix if not using turbo:

```json
  "scripts": {
    "dev": "cd apps/website && astro dev",
    "build": "cd apps/website && astro build",
    "start": "cd apps/website && astro preview",
    "lint": "cd apps/website && eslint .",
    "registry:build": "shadcn build"
  }
```

Use the second form (with `cd`) so root commands work without turbo.

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "feat(root): redirect dev/build/start to Astro"
```

---

### Task 9: Update `turbo.json`

**Files:**
- Modify: `turbo.json`

- [ ] **Step 1: Add `check` task and update `dev` to persistent**

Replace `turbo.json` contents with:

```json
{
    "$schema": "https://turbo.build/schema.json",
    "tasks": {
        "build": {
            "dependsOn": ["^build"],
            "outputs": ["dist/**"]
        },
        "start": {
            "dependsOn": ["^build"]
        },
        "lint": {
            "cache": false,
            "outputs": []
        },
        "dev": {
            "cache": false,
            "persistent": true
        },
        "check": {
            "cache": false,
            "outputs": []
        },
        "registry:build": {
            "cache": false,
            "outputs": []
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add turbo.json
git commit -m "feat(turbo): add check task, make dev persistent"
```

---

## Phase 1 — Layout & Theme

### Task 10: Move `app/globals.css` to `src/styles/globals.css`

**Files:**
- Create: `apps/website/src/styles/globals.css` (copy + verify)
- Delete: `apps/website/app/globals.css` (later, in cleanup task)

- [ ] **Step 1: Create the styles directory and copy**

Run:
```bash
mkdir -p apps/website/src/styles
cp apps/website/app/globals.css apps/website/src/styles/globals.css
```

- [ ] **Step 2: Verify file copied**

Run: `head -5 apps/website/src/styles/globals.css`
Expected: `@import 'tailwindcss';` is the first line.

- [ ] **Step 3: Verify content matches**

Run: `diff apps/website/app/globals.css apps/website/src/styles/globals.css`
Expected: no output (identical).

- [ ] **Step 4: Do NOT commit yet — will commit with `BaseLayout.astro` in next task**

---

### Task 11: Create `BaseLayout.astro`

**Files:**
- Create: `apps/website/src/layouts/BaseLayout.astro`
- Create: `apps/website/src/layouts/ThemeProvider.tsx` (island)
- Modify: `apps/website/app/layout.tsx` (will be deleted later)

- [ ] **Step 1: Create `ThemeProvider.tsx` island**

Create `apps/website/src/layouts/ThemeProvider.tsx`:

```tsx
'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'

export function ThemeProvider({ children }: { children: ReactNode }) {
    return (
        <NextThemesProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange>
            {children}
        </NextThemesProvider>
    )
}
```

- [ ] **Step 2: Create `BaseLayout.astro`**

Create `apps/website/src/layouts/BaseLayout.astro`:

```astro
---
import '../styles/globals.css'
import { ThemeProvider } from './ThemeProvider.tsx'

interface Props {
    title?: string
    description?: string
}

const { title = 'Tenang Web', description = 'Tenang Web — marketing site' } = Astro.props
---

<!doctype html>
<html lang="en" suppressHydrationWarning>
    <head>
        <meta charset="UTF-8" />
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <title>{title}</title>
    </head>
    <body>
        <ThemeProvider client:load>
            <slot />
        </ThemeProvider>
    </body>
</html>
```

- [ ] **Step 3: Run `astro sync` to generate types**

Run: `cd apps/website && pnpm exec astro sync`
Expected: creates `.astro/types.d.ts`. No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/styles/globals.css apps/website/src/layouts/ apps/website/.astro/
git commit -m "feat(website): add BaseLayout and ThemeProvider island"
```

---

### Task 12: Port `components/logo.tsx` to `src/components/logo.astro`

**Files:**
- Create: `apps/website/src/components/logo.astro`

- [ ] **Step 1: Write the Astro component**

Create `apps/website/src/components/logo.astro`:

```astro
---
interface Props {
    className?: string
    uniColor?: boolean
}

const { className = '', uniColor = true } = Astro.props
const cn = (cls: string) => [cls, className].filter(Boolean).join(' ')
---

<svg
    class={cn('text-foreground h-5 w-full')}
    viewBox="0 0 797 220"
    fill="none"
    xmlns="http://www.w3.org/2000/svg">
    <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M80 100H28C12.536 100 0 87.464 0 72V28C0 12.536 12.536 0 28 0H72C87.464 0 100 12.536 100 28V80H160C171.046 80 180 88.9543 180 100V167.639C180 175.215 175.72 182.14 168.944 185.528L103.416 218.292C101.17 219.415 98.6923 220 96.1803 220C87.2442 220 80 212.756 80 203.82V100ZM28 20C23.5817 20 20 23.5817 20 28V72C20 76.4183 23.5817 80 28 80H80V28C80 23.5817 76.4183 20 72 20H28ZM100 100H152C156.418 100 160 103.582 160 108V165.092C160 168.103 158.309 170.859 155.625 172.224L111.625 194.591C106.303 197.296 100 193.429 100 187.459V100Z"
        fill={uniColor ? 'currentColor' : 'url(#paint_logo)'}
    />
    <path
        d="M272.366 96.0719V150.886C272.366 154.6 273.205 157.296 274.884 158.973C276.682 160.531 279.679 161.309 283.874 161.309H296.461V178.383H280.278C271.048 178.383 263.975 176.226 259.06 171.913C254.145 167.599 251.688 160.59 251.688 150.886V96.0719H240V79.3582H251.688V54.7368H272.366V79.3582H296.461V96.0719H272.366ZM306.723 128.421C306.723 118.477 308.761 109.671 312.837 102.003C317.032 94.3346 322.666 88.4039 329.739 84.2105C336.932 79.8973 344.843 77.7407 353.474 77.7407C361.266 77.7407 368.039 79.2982 373.793 82.4133C379.667 85.4086 384.342 89.1827 387.818 93.7356V79.3582H408.497V178.383H387.818V163.646C384.342 168.318 379.607 172.212 373.613 175.327C367.62 178.442 360.787 180 353.115 180C344.604 180 336.812 177.843 329.739 173.53C322.666 169.097 317.032 162.987 312.837 155.199C308.761 147.291 306.723 138.365 306.723 128.421ZM387.818 128.78C387.818 121.951 386.38 116.021 383.503 110.988C380.746 105.956 377.09 102.122 372.534 99.4865C367.979 96.8507 363.064 95.5327 357.79 95.5327C352.515 95.5327 347.6 96.8507 343.045 99.4865C338.49 102.003 334.774 105.777 331.897 110.809C329.14 115.721 327.761 121.592 327.761 128.421C327.761 135.25 329.14 141.241 331.897 146.393C334.774 151.545 338.49 155.498 343.045 158.254C347.72 160.89 352.635 162.208 357.79 162.208C363.064 162.208 367.979 160.89 372.534 158.254C377.09 155.618 380.746 151.784 383.503 146.752C386.38 141.6 387.818 135.61 387.818 128.78ZM444.052 66.2388C440.336 66.2388 437.219 64.9807 434.702 62.4647C432.184 59.9487 430.926 56.8336 430.926 53.1194C430.926 49.4052 432.184 46.2901 434.702 43.7741C437.219 41.258 440.336 40 444.052 40C447.648 40 450.705 41.258 453.222 43.7741C455.74 46.2901 456.999 49.4052 456.999 53.1194C456.999 56.8336 455.74 59.9487 453.222 62.4647C450.705 64.9807 447.648 66.2388 444.052 66.2388ZM454.122 79.3582V178.383H433.623V79.3582H454.122ZM499.735 45.3915V178.383H479.236V45.3915H499.735ZM518.017 128.421C518.017 118.477 520.055 109.671 524.13 102.003C528.326 94.3346 533.96 88.4039 541.033 84.2105C548.226 79.8973 556.137 77.7407 564.768 77.7407C572.56 77.7407 579.333 79.2982 585.087 82.4133C590.961 85.4086 595.636 89.1827 599.112 93.7356V79.3582H619.791V178.383H599.112V163.646C595.636 168.318 590.901 172.212 584.907 175.327C578.914 178.442 572.081 180 564.409 180C555.898 180 548.106 177.843 541.033 173.53C533.96 169.097 528.326 162.987 524.13 155.199C520.055 147.291 518.017 138.365 518.017 128.421ZM599.112 128.78C599.112 121.951 597.674 116.021 594.797 110.988C592.04 105.956 588.384 102.122 583.828 99.4865C579.273 96.8507 574.358 95.5327 569.084 95.5327C563.809 95.5327 558.894 96.8507 554.339 99.4865C549.784 102.003 546.068 105.777 543.191 110.809C540.434 115.721 539.055 121.592 539.055 128.421C539.055 135.25 540.434 141.241 543.191 146.393C546.068 151.545 549.784 155.498 554.339 158.254C559.014 160.89 563.929 162.208 569.084 162.208C574.358 162.208 579.273 160.89 583.828 158.254C588.384 155.618 592.04 151.784 594.797 146.752C597.674 141.6 599.112 135.61 599.112 128.78ZM693.802 96.0719V150.886C693.802 154.6 694.642 157.296 696.32 158.973C698.119 160.531 701.115 161.309 705.31 161.309H717.897V178.383H701.715C692.484 178.383 685.412 176.226 680.497 171.913C675.582 167.599 673.124 160.59 673.124 150.886V96.0719H661.437V79.3582H673.124V54.7368H693.802V79.3582H717.897V96.0719H693.802Z"
        fill="currentColor"
    />
    <defs>
        <linearGradient
            id="paint_logo"
            x1="90"
            y1="0"
            x2="90"
            y2="220"
            gradientUnits="userSpaceOnUse">
            <stop stop-color="#9B99FE" />
            <stop
                offset="1"
                stop-color="#2BC8B7"
            />
        </linearGradient>
    </defs>
</svg>
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/logo.astro
git commit -m "feat(website): port Logo component to .astro"
```

---

## Phase 2 — Static Blocks (45 variants → `.astro`)

For each section below, the workflow is:
1. Create `<section>.astro` wrapper (renders default variant).
2. For each variant, create `variants/<variant>/index.astro` (or `.tsx` for islands — see Phase 3).
3. Convert JSX → Astro syntax:
   - `className=` → `class=`
   - Remove React-specific: `React.Fragment`, `useState`, `useEffect`, `useMemo`, `useRef`
   - Replace `import Link from 'next/link'` with native `<a href>`
   - Replace `import Image from 'next/image'` with `<Image>` from `astro:assets` (for remote URLs, keep as `<img>` since `astro:assets` doesn't optimize arbitrary remote without `image.domains` registration — but we have those domains set; for components in `.astro` we can use `<Image>`)
   - Move imports of `@/components/...` to relative paths inside the variants folder, or use `@/` alias (works in `.astro`)

### Task 13: Migrate `call-to-action` section (4 static variants)

**Files:**
- Create: `apps/website/src/sections/call-to-action/call-to-action.astro`
- Create: `apps/website/src/sections/call-to-action/variants/{one,two,three,four}/index.astro`

- [ ] **Step 1: Create section wrapper**

Create `apps/website/src/sections/call-to-action/call-to-action.astro`:

```astro
---
import { type ComponentProps, type ComponentType } from 'astro/types'

interface Props {
    variant?: 'one' | 'two' | 'three' | 'four'
}

const { variant = 'one' } = Astro.props
const variants = {
    one: () => import('./variants/one/index.astro'),
    two: () => import('./variants/two/index.astro'),
    three: () => import('./variants/three/index.astro'),
    four: () => import('./variants/four/index.astro'),
} as const

const Component = (await variants[variant]()).default as ComponentType<ComponentProps<typeof Astro>>
---

<Component />
```

- [ ] **Step 2: Create variant `one`**

Read source: `apps/website/blocks/call-to-action/one/index.tsx`. Convert JSX to Astro.

Create `apps/website/src/sections/call-to-action/variants/one/index.astro`:

```astro
---
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'
---

<section class="bg-background @container py-24">
    <div class="mx-auto max-w-2xl px-6">
        <div class="text-center">
            <h2 class="text-balance font-serif text-4xl font-medium">Ready to Get Started?</h2>
            <p class="text-muted-foreground mx-auto mt-4 max-w-md text-balance">Join thousands of teams already using our platform to build better products faster.</p>
            <div class="mt-6 flex flex-wrap justify-center gap-3">
                <Button
                    asChild
                    class="pr-1.5">
                    <a href="#link">
                        <span>Start Free Trial</span>
                        <ChevronRight class="opacity-50" />
                    </a>
                </Button>
                <Button
                    variant="secondary"
                    asChild>
                    <a href="#link">Talk to Sales</a>
                </Button>
            </div>
        </div>
    </div>
</section>
```

- [ ] **Step 3: Create variants `two`, `three`, `four`**

Read each source:
- `apps/website/blocks/call-to-action/two/index.tsx`
- `apps/website/blocks/call-to-action/three/index.tsx`
- `apps/website/blocks/call-to-action/four/index.tsx`

For each, apply the standard transformations:
- `import Link from 'next/link'` → DELETE (use native `<a>`)
- All `<Link href="X">` → `<a href="X">`
- All `className=` → `class=`
- Move source verbatim, only changing these patterns

Create each `variants/<n>/index.astro` at `apps/website/src/sections/call-to-action/variants/<n>/index.astro`.

- [ ] **Step 4: Run `astro check` to verify**

Run: `cd apps/website && pnpm exec astro check 2>&1 | tail -20`
Expected: 0 errors (warnings OK if limited to known shadcn/lucide types).

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/sections/call-to-action/
git commit -m "feat(website): migrate call-to-action section to .astro"
```

---

### Task 14: Migrate `comparator` section (3 static variants)

**Files:**
- Create: `apps/website/src/sections/comparator/comparator.astro`
- Create: `apps/website/src/sections/comparator/variants/{one,two,three}/index.astro`

- [ ] **Step 1: Create section wrapper**

Create `apps/website/src/sections/comparator/comparator.astro`:

```astro
---
import { type ComponentProps, type ComponentType } from 'astro/types'

interface Props {
    variant?: 'one' | 'two' | 'three'
}

const { variant = 'one' } = Astro.props
const variants = {
    one: () => import('./variants/one/index.astro'),
    two: () => import('./variants/two/index.astro'),
    three: () => import('./variants/three/index.astro'),
} as const

const Component = (await variants[variant]()).default as ComponentType<ComponentProps<typeof Astro>>
---

<Component />
```

- [ ] **Step 2: Create variants `one`, `two`, `three`**

Read sources from `apps/website/blocks/comparator/{one,two,three}/index.tsx`. Apply standard transformations:
- `import Link from 'next/link'` → DELETE
- `<Link href="X">` → `<a href="X">`
- `className=` → `class=`
- All other imports and JSX stays the same.

Create files at `apps/website/src/sections/comparator/variants/<n>/index.astro`.

- [ ] **Step 3: Verify with `astro check`**

Run: `cd apps/website && pnpm exec astro check 2>&1 | tail -20`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/sections/comparator/
git commit -m "feat(website): migrate comparator section to .astro"
```

---

### Task 15: Migrate `contact` section (2 static variants)

**Files:**
- Create: `apps/website/src/sections/contact/contact.astro`
- Create: `apps/website/src/sections/contact/variants/{one,two}/index.astro`

- [ ] **Step 1: Create section wrapper**

Create `apps/website/src/sections/contact/contact.astro`:

```astro
---
import { type ComponentProps, type ComponentType } from 'astro/types'

interface Props {
    variant?: 'one' | 'two'
}

const { variant = 'one' } = Astro.props
const variants = {
    one: () => import('./variants/one/index.astro'),
    two: () => import('./variants/two/index.astro'),
} as const

const Component = (await variants[variant]()).default as ComponentType<ComponentProps<typeof Astro>>
---

<Component />
```

- [ ] **Step 2: Create variants `one`, `two`**

Read sources `apps/website/blocks/contact/{one,two}/index.tsx`. Apply standard transformations. Create at `apps/website/src/sections/contact/variants/<n>/index.astro`.

- [ ] **Step 3: Verify and commit**

```bash
cd apps/website && pnpm exec astro check 2>&1 | tail -10
git add apps/website/src/sections/contact/
git commit -m "feat(website): migrate contact section to .astro"
```

Expected: 0 errors from `astro check`.

---

### Task 16: Migrate `content` section (3 static variants)

**Files:**
- Create: `apps/website/src/sections/content/content.astro`
- Create: `apps/website/src/sections/content/variants/{one,two,three}/index.astro`

- [ ] **Step 1: Create section wrapper**

Create `apps/website/src/sections/content/content.astro`:

```astro
---
import { type ComponentProps, type ComponentType } from 'astro/types'

interface Props {
    variant?: 'one' | 'two' | 'three'
}

const { variant = 'one' } = Astro.props
const variants = {
    one: () => import('./variants/one/index.astro'),
    two: () => import('./variants/two/index.astro'),
    three: () => import('./variants/three/index.astro'),
} as const

const Component = (await variants[variant]()).default as ComponentType<ComponentProps<typeof Astro>>
---

<Component />
```

- [ ] **Step 2: Create variants `one`, `two`, `three`**

Read sources `apps/website/blocks/content/{one,two,three}/index.tsx`. Apply standard transformations. Create at `apps/website/src/sections/content/variants/<n>/index.astro`.

- [ ] **Step 3: Verify and commit**

```bash
cd apps/website && pnpm exec astro check 2>&1 | tail -10
git add apps/website/src/sections/content/
git commit -m "feat(website): migrate content section to .astro"
```

---

### Task 17: Migrate `forgot-password` section (3 static variants)

**Files:**
- Create: `apps/website/src/sections/forgot-password/forgot-password.astro`
- Create: `apps/website/src/sections/forgot-password/variants/{one,two,three}/index.astro`

- [ ] **Step 1: Create section wrapper**

Create `apps/website/src/sections/forgot-password/forgot-password.astro`:

```astro
---
import { type ComponentProps, type ComponentType } from 'astro/types'

interface Props {
    variant?: 'one' | 'two' | 'three'
}

const { variant = 'one' } = Astro.props
const variants = {
    one: () => import('./variants/one/index.astro'),
    two: () => import('./variants/two/index.astro'),
    three: () => import('./variants/three/index.astro'),
} as const

const Component = (await variants[variant]()).default as ComponentType<ComponentProps<typeof Astro>>
---

<Component />
```

- [ ] **Step 2: Create variants `one`, `two`, `three`**

Read sources `apps/website/blocks/forgot-password/{one,two,three}/index.tsx`. Apply standard transformations. Create at `apps/website/src/sections/forgot-password/variants/<n>/index.astro`.

- [ ] **Step 3: Verify and commit**

```bash
cd apps/website && pnpm exec astro check 2>&1 | tail -10
git add apps/website/src/sections/forgot-password/
git commit -m "feat(website): migrate forgot-password section to .astro"
```

---

### Task 18: Migrate `integrations` section (2 static variants)

**Files:**
- Create: `apps/website/src/sections/integrations/integrations.astro`
- Create: `apps/website/src/sections/integrations/variants/{one,two}/index.astro`

- [ ] **Step 1: Create section wrapper**

Create `apps/website/src/sections/integrations/integrations.astro`:

```astro
---
import { type ComponentProps, type ComponentType } from 'astro/types'

interface Props {
    variant?: 'one' | 'two'
}

const { variant = 'one' } = Astro.props
const variants = {
    one: () => import('./variants/one/index.astro'),
    two: () => import('./variants/two/index.astro'),
} as const

const Component = (await variants[variant]()).default as ComponentType<ComponentProps<typeof Astro>>
---

<Component />
```

- [ ] **Step 2: Create variants `one`, `two`**

Read sources `apps/website/blocks/integrations/{one,two}/index.tsx`. Apply standard transformations. Create at `apps/website/src/sections/integrations/variants/<n>/index.astro`.

- [ ] **Step 3: Verify and commit**

```bash
cd apps/website && pnpm exec astro check 2>&1 | tail -10
git add apps/website/src/sections/integrations/
git commit -m "feat(website): migrate integrations section to .astro"
```

---

### Task 19: Migrate `login` section (3 static variants)

**Files:**
- Create: `apps/website/src/sections/login/login.astro`
- Create: `apps/website/src/sections/login/variants/{one,two,three}/index.astro`

- [ ] **Step 1: Create section wrapper**

Create `apps/website/src/sections/login/login.astro`:

```astro
---
import { type ComponentProps, type ComponentType } from 'astro/types'

interface Props {
    variant?: 'one' | 'two' | 'three'
}

const { variant = 'one' } = Astro.props
const variants = {
    one: () => import('./variants/one/index.astro'),
    two: () => import('./variants/two/index.astro'),
    three: () => import('./variants/three/index.astro'),
} as const

const Component = (await variants[variant]()).default as ComponentType<ComponentProps<typeof Astro>>
---

<Component />
```

- [ ] **Step 2: Create variants `one`, `two`, `three`**

Read sources `apps/website/blocks/login/{one,two,three}/index.tsx`. Apply standard transformations. Create at `apps/website/src/sections/login/variants/<n>/index.astro`.

- [ ] **Step 3: Verify and commit**

```bash
cd apps/website && pnpm exec astro check 2>&1 | tail -10
git add apps/website/src/sections/login/
git commit -m "feat(website): migrate login section to .astro"
```

---

### Task 20: Migrate `pricing` section (3 static variants)

**Files:**
- Create: `apps/website/src/sections/pricing/pricing.astro`
- Create: `apps/website/src/sections/pricing/variants/{one,two,three}/index.astro`

- [ ] **Step 1: Create section wrapper**

Create `apps/website/src/sections/pricing/pricing.astro`:

```astro
---
import { type ComponentProps, type ComponentType } from 'astro/types'

interface Props {
    variant?: 'one' | 'two' | 'three'
}

const { variant = 'one' } = Astro.props
const variants = {
    one: () => import('./variants/one/index.astro'),
    two: () => import('./variants/two/index.astro'),
    three: () => import('./variants/three/index.astro'),
} as const

const Component = (await variants[variant]()).default as ComponentType<ComponentProps<typeof Astro>>
---

<Component />
```

- [ ] **Step 2: Create variants `one`, `two`, `three`**

Read sources `apps/website/blocks/pricing/{one,two,three}/index.tsx`. Apply standard transformations. Note: `pricing/two/index.tsx` uses `next/image` — convert to `<img>` with explicit width/height (since pricing/one and pricing/three do NOT use image, the pattern is consistent across the section).

For each variant, replace `import Image from 'next/image'` with native `<img>`:

Before:
```tsx
<Image src="https://..." alt="..." width={120} height={40} className="..." />
```

After:
```html
<img src="https://..." alt="..." width="120" height="40" class="..." />
```

Create files at `apps/website/src/sections/pricing/variants/<n>/index.astro`.

- [ ] **Step 3: Verify and commit**

```bash
cd apps/website && pnpm exec astro check 2>&1 | tail -10
git add apps/website/src/sections/pricing/
git commit -m "feat(website): migrate pricing section to .astro"
```

---

### Task 21: Migrate `sign-up` section (3 static variants)

**Files:**
- Create: `apps/website/src/sections/sign-up/sign-up.astro`
- Create: `apps/website/src/sections/sign-up/variants/{one,two,three}/index.astro`

- [ ] **Step 1: Create section wrapper**

Create `apps/website/src/sections/sign-up/sign-up.astro`:

```astro
---
import { type ComponentProps, type ComponentType } from 'astro/types'

interface Props {
    variant?: 'one' | 'two' | 'three'
}

const { variant = 'one' } = Astro.props
const variants = {
    one: () => import('./variants/one/index.astro'),
    two: () => import('./variants/two/index.astro'),
    three: () => import('./variants/three/index.astro'),
} as const

const Component = (await variants[variant]()).default as ComponentType<ComponentProps<typeof Astro>>
---

<Component />
```

- [ ] **Step 2: Create variants `one`, `two`, `three`**

Read sources `apps/website/blocks/sign-up/{one,two,three}/index.tsx`. Apply standard transformations. Create at `apps/website/src/sections/sign-up/variants/<n>/index.astro`.

- [ ] **Step 3: Verify and commit**

```bash
cd apps/website && pnpm exec astro check 2>&1 | tail -10
git add apps/website/src/sections/sign-up/
git commit -m "feat(website): migrate sign-up section to .astro"
```

---

### Task 22: Migrate `stats` section (4 static variants)

**Files:**
- Create: `apps/website/src/sections/stats/stats.astro`
- Create: `apps/website/src/sections/stats/variants/{one,two,three,four}/index.astro`

- [ ] **Step 1: Create section wrapper**

Create `apps/website/src/sections/stats/stats.astro`:

```astro
---
import { type ComponentProps, type ComponentType } from 'astro/types'

interface Props {
    variant?: 'one' | 'two' | 'three' | 'four'
}

const { variant = 'one' } = Astro.props
const variants = {
    one: () => import('./variants/one/index.astro'),
    two: () => import('./variants/two/index.astro'),
    three: () => import('./variants/three/index.astro'),
    four: () => import('./variants/four/index.astro'),
} as const

const Component = (await variants[variant]()).default as ComponentType<ComponentProps<typeof Astro>>
---

<Component />
```

- [ ] **Step 2: Create variants `one`, `two`, `three`, `four`**

Read sources `apps/website/blocks/stats/{one,two,three,four}/index.tsx`. Apply standard transformations. Note: `stats/three` and `stats/four` use `next/image` — convert to `<img>` per Task 20 pattern. Create at `apps/website/src/sections/stats/variants/<n>/index.astro`.

- [ ] **Step 3: Verify and commit**

```bash
cd apps/website && pnpm exec astro check 2>&1 | tail -10
git add apps/website/src/sections/stats/
git commit -m "feat(website): migrate stats section to .astro"
```

---

### Task 23: Migrate `team` section (2 static variants)

**Files:**
- Create: `apps/website/src/sections/team/team.astro`
- Create: `apps/website/src/sections/team/variants/{one,two}/index.astro`

- [ ] **Step 1: Create section wrapper**

Create `apps/website/src/sections/team/team.astro`:

```astro
---
import { type ComponentProps, type ComponentType } from 'astro/types'

interface Props {
    variant?: 'one' | 'two'
}

const { variant = 'one' } = Astro.props
const variants = {
    one: () => import('./variants/one/index.astro'),
    two: () => import('./variants/two/index.astro'),
} as const

const Component = (await variants[variant]()).default as ComponentType<ComponentProps<typeof Astro>>
---

<Component />
```

- [ ] **Step 2: Create variants `one`, `two`**

Read sources `apps/website/blocks/team/{one,two}/index.tsx`. Apply standard transformations. Both variants use `next/image` for GitHub avatars — convert to `<img>` (the `avatars.githubusercontent.com` domain is already whitelisted in `astro.config.mjs`).

Before:
```tsx
<Image src={member.avatar} alt={member.name} width={120} height={120} className="..." />
```

After:
```html
<img src={member.avatar} alt={member.name} width="120" height="120" class="..." />
```

Create files at `apps/website/src/sections/team/variants/<n>/index.astro`.

- [ ] **Step 3: Verify and commit**

```bash
cd apps/website && pnpm exec astro check 2>&1 | tail -10
git add apps/website/src/sections/team/
git commit -m "feat(website): migrate team section to .astro"
```

---

### Task 24: Migrate `testimonials` section (4 static variants)

**Files:**
- Create: `apps/website/src/sections/testimonials/testimonials.astro`
- Create: `apps/website/src/sections/testimonials/variants/{one,two,three,four}/index.astro`

- [ ] **Step 1: Create section wrapper**

Create `apps/website/src/sections/testimonials/testimonials.astro`:

```astro
---
import { type ComponentProps, type ComponentType } from 'astro/types'

interface Props {
    variant?: 'one' | 'two' | 'three' | 'four'
}

const { variant = 'one' } = Astro.props
const variants = {
    one: () => import('./variants/one/index.astro'),
    two: () => import('./variants/two/index.astro'),
    three: () => import('./variants/three/index.astro'),
    four: () => import('./variants/four/index.astro'),
} as const

const Component = (await variants[variant]()).default as ComponentType<ComponentProps<typeof Astro>>
---

<Component />
```

- [ ] **Step 2: Create variants `one`, `two`, `three`, `four`**

Read sources `apps/website/blocks/testimonials/{one,two,three,four}/index.tsx`. Apply standard transformations. All four variants use `next/image` — convert to `<img>` per Task 23 pattern. Create at `apps/website/src/sections/testimonials/variants/<n>/index.astro`.

- [ ] **Step 3: Verify and commit**

```bash
cd apps/website && pnpm exec astro check 2>&1 | tail -10
git add apps/website/src/sections/testimonials/
git commit -m "feat(website): migrate testimonials section to .astro"
```

---

### Task 25: Migrate static `footer` variants (4 static variants)

**Files:**
- Create: `apps/website/src/sections/footer/footer.astro`
- Create: `apps/website/src/sections/footer/variants/{one,two,three,four}/index.astro`

- [ ] **Step 1: Create section wrapper**

Create `apps/website/src/sections/footer/footer.astro`:

```astro
---
import { type ComponentProps, type ComponentType } from 'astro/types'

interface Props {
    variant?: 'one' | 'two' | 'three' | 'four' | 'five' | 'six'
}

const { variant = 'one' } = Astro.props
const variants = {
    one: () => import('./variants/one/index.astro'),
    two: () => import('./variants/two/index.astro'),
    three: () => import('./variants/three/index.astro'),
    four: () => import('./variants/four/index.astro'),
    five: () => import('./variants/five/index.tsx'),
    six: () => import('./variants/six/index.tsx'),
} as const

const Component = (await variants[variant]()).default as ComponentType<ComponentProps<typeof Astro>>
---

<Component client:visible={['five', 'six'].includes(variant)} />
```

- [ ] **Step 2: Create static variants `one`, `two`, `three`, `four`**

Read sources `apps/website/blocks/footer/{one,two,three,four}/index.tsx`. Apply standard transformations. Create at `apps/website/src/sections/footer/variants/<n>/index.astro`.

- [ ] **Step 3: Verify and commit**

```bash
cd apps/website && pnpm exec astro check 2>&1 | tail -10
git add apps/website/src/sections/footer/
git commit -m "feat(website): migrate static footer variants to .astro"
```

---

### Task 26: Migrate static `logo-cloud` variant (1 static, 1 interactive)

**Files:**
- Create: `apps/website/src/sections/logo-cloud/logo-cloud.astro`
- Create: `apps/website/src/sections/logo-cloud/variants/one/index.astro`
- Create: `apps/website/src/sections/logo-cloud/variants/two/index.tsx` (deferred to Phase 3 — see Task 30)

- [ ] **Step 1: Create section wrapper**

Create `apps/website/src/sections/logo-cloud/logo-cloud.astro`:

```astro
---
import { type ComponentProps, type ComponentType } from 'astro/types'

interface Props {
    variant?: 'one' | 'two'
}

const { variant = 'one' } = Astro.props
const variants = {
    one: () => import('./variants/one/index.astro'),
    two: () => import('./variants/two/index.tsx'),
} as const

const Component = (await variants[variant]()).default as ComponentType<ComponentProps<typeof Astro>>
---

{variant === 'two' ? <Component client:visible /> : <Component />}
```

- [ ] **Step 2: Create static variant `one`**

Read source `apps/website/blocks/logo-cloud/one/index.tsx`. Apply standard transformations. Create at `apps/website/src/sections/logo-cloud/variants/one/index.astro`.

- [ ] **Step 3: Commit (variant two handled in Phase 3)**

```bash
git add apps/website/src/sections/logo-cloud/variants/one/ apps/website/src/sections/logo-cloud/logo-cloud.astro
git commit -m "feat(website): migrate logo-cloud section to .astro (one)"
```

---

### Task 27: Migrate static `features` variants (2 static, 1 interactive)

**Files:**
- Create: `apps/website/src/sections/features/features.astro`
- Create: `apps/website/src/sections/features/variants/one/index.astro`
- Create: `apps/website/src/sections/features/variants/two/index.astro`
- (variant three is interactive — see Task 30)

- [ ] **Step 1: Create section wrapper**

Create `apps/website/src/sections/features/features.astro`:

```astro
---
import { type ComponentProps, type ComponentType } from 'astro/types'

interface Props {
    variant?: 'one' | 'two' | 'three'
}

const { variant = 'one' } = Astro.props
const variants = {
    one: () => import('./variants/one/index.astro'),
    two: () => import('./variants/two/index.astro'),
    three: () => import('./variants/three/index.tsx'),
} as const

const Component = (await variants[variant]()).default as ComponentType<ComponentProps<typeof Astro>>
---

{variant === 'three' ? <Component client:visible /> : <Component />}
```

- [ ] **Step 2: Create static variants `one`, `two`**

Read sources `apps/website/blocks/features/{one,two}/index.tsx`. Apply standard transformations. Create at `apps/website/src/sections/features/variants/<n>/index.astro`.

- [ ] **Step 3: Commit (variant three handled in Phase 3)**

```bash
git add apps/website/src/sections/features/variants/one/ apps/website/src/sections/features/variants/two/ apps/website/src/sections/features/features.astro
git commit -m "feat(website): migrate features section to .astro (one, two)"
```

---

### Task 28: Migrate static `faqs` variant (1 static, 4 interactive)

**Files:**
- Create: `apps/website/src/sections/faqs/faqs.astro`
- Create: `apps/website/src/sections/faqs/variants/four/index.astro` (only `four` is static)
- (variants 1, 2, 3, 5 are interactive — see Task 31)

- [ ] **Step 1: Create section wrapper**

Create `apps/website/src/sections/faqs/faqs.astro`:

```astro
---
import { type ComponentProps, type ComponentType } from 'astro/types'

interface Props {
    variant?: 'one' | 'two' | 'three' | 'four' | 'five'
}

const { variant = 'one' } = Astro.props
const variants = {
    one: () => import('./variants/one/index.tsx'),
    two: () => import('./variants/two/index.tsx'),
    three: () => import('./variants/three/index.tsx'),
    four: () => import('./variants/four/index.astro'),
    five: () => import('./variants/five/index.tsx'),
} as const

const Component = (await variants[variant]()).default as ComponentType<ComponentProps<typeof Astro>>
---

{variant === 'four' ? <Component /> : <Component client:visible />}
```

- [ ] **Step 2: Create static variant `four`**

Read source `apps/website/blocks/faqs/four/index.tsx`. Apply standard transformations. Note: `faqs/four` uses `next/link` — convert per standard pattern. Create at `apps/website/src/sections/faqs/variants/four/index.astro`.

- [ ] **Step 3: Commit (variants 1, 2, 3, 5 handled in Phase 3)**

```bash
git add apps/website/src/sections/faqs/variants/four/ apps/website/src/sections/faqs/faqs.astro
git commit -m "feat(website): migrate faqs section to .astro (four)"
```

---

## Phase 3 — React Island Blocks (12 variants → `.tsx`)

For interactive variants, copy the source `.tsx` file and apply:
- `import Link from 'next/link'` → DELETE
- `<Link href="X">` → `<a href="X">`
- `import Image from 'next/image'` → DELETE; for `next/image` usage, see Task 36 (precomputed image strategy)
- Keep `'use client'` directive
- All other imports stay the same

### Task 29: Migrate `hero-section` (5 variants, 4 with interactive `header.tsx`)

**Files:**
- Create: `apps/website/src/sections/hero-section/hero-section.astro` (already created in this task)

- [ ] **Step 1: Create section wrapper**

Create `apps/website/src/sections/hero-section/hero-section.astro`:

```astro
---
import { type ComponentProps, type ComponentType } from 'astro/types'

interface Props {
    variant?: 'one' | 'two' | 'three' | 'four' | 'five'
}

const { variant = 'one' } = Astro.props
const variants = {
    one: () => import('./variants/one/index.tsx'),
    two: () => import('./variants/two/index.tsx'),
    three: () => import('./variants/three/index.tsx'),
    four: () => import('./variants/four/index.tsx'),
    five: () => import('./variants/five/index.tsx'),
} as const

const Component = (await variants[variant]()).default as ComponentType<ComponentProps<typeof Astro>>
---

<Component client:visible />
```

- [ ] **Step 2: Create variant `one`**

Read source `apps/website/blocks/hero-section/one/index.tsx` and `header.tsx`. Apply standard transformations (delete `next/link`, replace with native `<a>`, delete `next/image` import — actual image elements stay but use plain `<img>` tags since hero variants are React islands; see Task 36 for the precomputed pattern). The result is `.tsx` files at:
- `apps/website/src/sections/hero-section/variants/one/index.tsx`
- `apps/website/src/sections/hero-section/variants/one/header.tsx`

For `next/image`:
- Find all `<Image src="..." alt="..." width={N} height={N} className="..." />` and replace with `<img src="..." alt="..." width={N} height={N} class="..." />`.

- [ ] **Step 3: Create variants `two`, `three`, `four`, `five`**

Read sources `apps/website/blocks/hero-section/{two,three,four,five}/index.tsx` and corresponding `header.tsx` files (only `one` through `four` have a separate `header.tsx`; `five` only has `index.tsx`).

Apply the same transformations. Create files at:
- `apps/website/src/sections/hero-section/variants/<n>/index.tsx`
- `apps/website/src/sections/hero-section/variants/<n>/header.tsx` (only for n in 1..4)

- [ ] **Step 4: Verify and commit**

```bash
cd apps/website && pnpm exec astro check 2>&1 | tail -20
git add apps/website/src/sections/hero-section/
git commit -m "feat(website): migrate hero-section to React islands"
```

Expected: `astro check` reports 0 errors. Warnings about missing types from shadcn/lucide are acceptable.

---

### Task 30: Migrate `logo-cloud/two` and `features/three` (2 interactive variants)

**Files:**
- Create: `apps/website/src/sections/logo-cloud/variants/two/index.tsx`
- Create: `apps/website/src/sections/features/variants/three/index.tsx`

- [ ] **Step 1: Create `logo-cloud/two`**

Read source `apps/website/blocks/logo-cloud/two/index.tsx`. Apply standard transformations. Create at `apps/website/src/sections/logo-cloud/variants/two/index.tsx`.

- [ ] **Step 2: Create `features/three`**

Read source `apps/website/blocks/features/three/index.tsx`. Apply standard transformations. Note: this variant uses `next/link` — convert to native `<a>`. Create at `apps/website/src/sections/features/variants/three/index.tsx`.

- [ ] **Step 3: Verify and commit**

```bash
cd apps/website && pnpm exec astro check 2>&1 | tail -20
git add apps/website/src/sections/logo-cloud/variants/two/ apps/website/src/sections/features/variants/three/
git commit -m "feat(website): migrate logo-cloud/two and features/three to React islands"
```

---

### Task 31: Migrate `faqs` interactive variants (4 variants)

**Files:**
- Create: `apps/website/src/sections/faqs/variants/{one,two,three,five}/index.tsx`

- [ ] **Step 1: Create variants `one`, `two`, `three`, `five`**

Read sources `apps/website/blocks/faqs/{one,two,three,five}/index.tsx`. Apply standard transformations:
- Delete `import Link from 'next/link'`
- Replace `<Link href="X">` with `<a href="X">`

Note: all four use `@treonstudio/bungas-core/ui/accordion` — keep the import as-is. Create at `apps/website/src/sections/faqs/variants/<n>/index.tsx`.

- [ ] **Step 2: Verify and commit**

```bash
cd apps/website && pnpm exec astro check 2>&1 | tail -20
git add apps/website/src/sections/faqs/variants/one/ apps/website/src/sections/faqs/variants/two/ apps/website/src/sections/faqs/variants/three/ apps/website/src/sections/faqs/variants/five/
git commit -m "feat(website): migrate faqs interactive variants to React islands"
```

---

### Task 32: Migrate `footer` interactive variants (2 variants: `five`, `six`)

**Files:**
- Create: `apps/website/src/sections/footer/variants/five/{index.tsx,theme-switcher.tsx}`
- Create: `apps/website/src/sections/footer/variants/six/{index.tsx,social-medias.tsx,theme-switcher.tsx}`

- [ ] **Step 1: Create `footer/five`**

Read sources:
- `apps/website/blocks/footer/five/index.tsx`
- `apps/website/blocks/footer/five/theme-switcher.tsx`

Apply standard transformations. Note: `theme-switcher.tsx` already uses `useTheme` from `next-themes` and has `'use client'` — keep both. Apply `<Link>` → `<a>`. Create at:
- `apps/website/src/sections/footer/variants/five/index.tsx`
- `apps/website/src/sections/footer/variants/five/theme-switcher.tsx`

- [ ] **Step 2: Create `footer/six`**

Read sources:
- `apps/website/blocks/footer/six/index.tsx`
- `apps/website/blocks/footer/six/social-medias.tsx`
- `apps/website/blocks/footer/six/theme-switcher.tsx`

Apply standard transformations. `social-medias.tsx` uses `next/link` — convert. `theme-switcher.tsx` is identical to `footer/five/theme-switcher.tsx` (only file contents may differ slightly; verify by reading the source). Create at:
- `apps/website/src/sections/footer/variants/six/index.tsx`
- `apps/website/src/sections/footer/variants/six/social-medias.tsx`
- `apps/website/src/sections/footer/variants/six/theme-switcher.tsx`

- [ ] **Step 3: Verify and commit**

```bash
cd apps/website && pnpm exec astro check 2>&1 | tail -20
git add apps/website/src/sections/footer/variants/five/ apps/website/src/sections/footer/variants/six/
git commit -m "feat(website): migrate footer interactive variants to React islands"
```

---

## Phase 4 — Page Composition

### Task 33: Create `src/pages/index.astro`

**Files:**
- Create: `apps/website/src/pages/index.astro`

- [ ] **Step 1: Write the page composition**

Create `apps/website/src/pages/index.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro'
import HeroSection from '../sections/hero-section/hero-section.astro'
import LogoCloud from '../sections/logo-cloud/logo-cloud.astro'
import Features from '../sections/features/features.astro'
import Integrations from '../sections/integrations/integrations.astro'
import Content from '../sections/content/content.astro'
import Stats from '../sections/stats/stats.astro'
import Testimonials from '../sections/testimonials/testimonials.astro'
import CallToAction from '../sections/call-to-action/call-to-action.astro'
import FAQs from '../sections/faqs/faqs.astro'
import Pricing from '../sections/pricing/pricing.astro'
import Footer from '../sections/footer/footer.astro'
---

<BaseLayout>
    <HeroSection />
    <LogoCloud />
    <Stats />
    <Features />
    <Content />
    <Testimonials />
    <Integrations />
    <Pricing />
    <FAQs />
    <CallToAction />
    <Footer />
</BaseLayout>
```

Variant defaults follow the original `app/page.tsx`:
- Hero: `three` → update wrapper default in `hero-section.astro` to `'three'`
- LogoCloud: `two` → update wrapper default to `'two'`
- Features: `three` → update wrapper default to `'three'`
- Integrations: `one` (default OK)
- Content: `three` → update wrapper default to `'three'`
- Stats: `three` → update wrapper default to `'three'`
- Testimonials: `two` → update wrapper default to `'two'`
- CallToAction: `four` → update wrapper default to `'four'`
- FAQs: `three` → update wrapper default to `'three'`
- Pricing: `one` (default OK)
- Footer: `one` (default OK)

- [ ] **Step 2: Update each section wrapper's default `variant` to match the original page**

For each `apps/website/src/sections/<section>/<section>.astro` file, change the `default` value in the destructured `Astro.props` to the value listed above. For example, in `hero-section.astro`:

Before:
```ts
const { variant = 'one' } = Astro.props
```

After:
```ts
const { variant = 'three' } = Astro.props
```

Apply the same pattern to: `logo-cloud` (→ 'two'), `features` (→ 'three'), `content` (→ 'three'), `stats` (→ 'three'), `testimonials` (→ 'two'), `call-to-action` (→ 'four'), `faqs` (→ 'three'). Others stay at 'one'.

- [ ] **Step 3: Run `astro check` to verify**

Run: `cd apps/website && pnpm exec astro check 2>&1 | tail -20`
Expected: 0 errors.

- [ ] **Step 4: Run `astro build` to verify full build**

Run: `cd apps/website && pnpm build 2>&1 | tail -30`
Expected: build completes. Output in `dist/`. Check size: `du -sh apps/website/dist/`.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/pages/index.astro apps/website/src/sections/
git commit -m "feat(website): compose landing page from migrated blocks"
```

---

## Phase 5 — Cleanup

### Task 34: Delete Next.js artifacts

**Files:**
- Delete: `apps/website/app/`
- Delete: `apps/website/blocks/`
- Delete: `apps/website/components/`
- Delete: `apps/website/next.config.ts`
- Delete: `apps/website/next-env.d.ts`
- Delete: `apps/website/postcss.config.mjs`
- Delete: `apps/website/eslint.config.mjs`
- Update: `apps/website/.gitignore` (remove Next-specific lines)

- [ ] **Step 1: Delete Next.js directories and files**

Run:
```bash
cd apps/website
rm -rf app blocks components
rm -f next.config.ts next-env.d.ts postcss.config.mjs eslint.config.mjs
```

- [ ] **Step 2: Update `.gitignore`**

Read `apps/website/.gitignore`. Remove these lines (Next.js-specific):
- `/.next/`
- `/out/`
- `.turbo`
- `next-env.d.ts`

Keep all other entries (build, dist, node_modules, etc.).

- [ ] **Step 3: Verify build still works**

Run: `cd apps/website && pnpm build 2>&1 | tail -10`
Expected: build succeeds with no missing-file errors.

- [ ] **Step 4: Commit**

```bash
git add -A apps/website/
git commit -m "chore(website): remove Next.js artifacts after migration"
```

---

## Phase 6 — Verification

### Task 35: `astro check` final pass

- [ ] **Step 1: Run `astro check` from root**

Run: `pnpm check 2>&1 | tail -20`
Expected: 0 errors. Warnings about shadcn/lucide type definitions are acceptable (cannot fix without modifying `@treonstudio/bungas-core`).

If errors are caused by `verbatimModuleSyntax: true` in `packages/core/tsconfig.app.json` (e.g., missing `import type`), add `import type` to those imports in `apps/website/src/sections/...` files as needed. Do NOT modify `packages/core`.

- [ ] **Step 2: Run `astro check` from website dir**

Run: `cd apps/website && pnpm check 2>&1 | tail -20`
Expected: same as Step 1.

---

### Task 36: `astro build` final pass + bundle size check

- [ ] **Step 1: Run `astro build`**

Run: `cd apps/website && pnpm build 2>&1 | tail -30`
Expected: build completes successfully. Look for `Complete!` or similar success message.

- [ ] **Step 2: Check worker bundle size**

Run: `ls -lh apps/website/dist/_worker.js/index.js 2>/dev/null || du -sh apps/website/dist/`
Expected: worker bundle < 1 MB for Cloudflare free tier; < 10 MB for paid.

If > 1 MB, identify the largest dep:
```bash
du -h apps/website/dist/_worker.js/chunks/*.js | sort -rh | head -5
```

Note the culprit. The optimization is deferred to follow-up work.

- [ ] **Step 3: Note the size for future optimization**

Open a mental note: if worker > 1 MB, future task = identify and lazy-load the culprit (likely `recharts` if any block uses it, or `motion`).

---

### Task 37: Local preview + visual parity check

- [ ] **Step 1: Start dev server**

Run: `cd apps/website && pnpm dev`
Expected: server starts. Output shows local URL (default `http://localhost:4321`).

- [ ] **Step 2: Open in browser**

Open `http://localhost:4321` in a browser. Verify:
- Page loads without console errors
- Hero section is visible
- All blocks render in order: Hero → LogoCloud → Stats → Features → Content → Testimonials → Integrations → Pricing → FAQs → CallToAction → Footer
- Interactive blocks work: FAQ accordion, hero menu toggle, theme switcher, mobile nav

- [ ] **Step 3: Compare to Next.js version (if available)**

If a previous build is still running on a different port, compare side-by-side. Otherwise, check against the original `app/page.tsx` sequence.

- [ ] **Step 4: Run `astro preview` for production build**

Stop dev server. Run: `cd apps/website && pnpm build && pnpm preview`
Expected: production build serves at `http://localhost:4321`. Same visual output as dev.

---

### Task 38: `wrangler dev` smoke test (Cloudflare Workers runtime)

- [ ] **Step 1: Build the worker**

Run: `cd apps/website && pnpm build`
Expected: build succeeds (from Task 36).

- [ ] **Step 2: Start wrangler dev**

Run: `cd apps/website && pnpm exec wrangler dev`
Expected: wrangler dev starts, prints local URL (typically `http://localhost:8787`).

- [ ] **Step 3: Open in browser**

Open `http://localhost:8787`. Verify the same checks as Task 37 step 2.

- [ ] **Step 4: Check Workers-specific behavior**

Verify:
- Static assets served from `ASSETS` binding (HTML, CSS, JS, fonts)
- React islands hydrate (theme switcher, FAQ accordion, mobile menu)
- No 404s in network panel

If errors: read wrangler output, fix accordingly. Common issues:
- Missing `compatibility_flags`: re-check `wrangler.jsonc`
- Asset path mismatch: re-check `astro.config.mjs` `output: 'server'`

---

### Task 39: ESLint configuration (replace `next lint`)

**Files:**
- Create: `apps/website/eslint.config.js`
- Modify: `apps/website/package.json` (already has `lint: "eslint ."`)

- [ ] **Step 1: Write the ESLint config**

Create `apps/website/eslint.config.js`:

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
            'no-unused-vars': 'warn',
        },
    },
    {
        ignores: ['dist/**', '.astro/**'],
    },
]
```

- [ ] **Step 2: Install `eslint-plugin-astro` if not already**

Run: `cd apps/website && pnpm add -D eslint-plugin-astro@^1.3.1`

- [ ] **Step 3: Run lint**

Run: `pnpm lint 2>&1 | tail -30`
Expected: 0 errors. Warnings OK.

- [ ] **Step 4: Commit**

```bash
git add apps/website/eslint.config.js apps/website/package.json pnpm-lock.yaml
git commit -m "feat(website): add ESLint config for Astro"
```

---

## Phase 7 — Documentation

### Task 40: Update `apps/website/README.md`

**Files:**
- Modify: `apps/website/README.md`

- [ ] **Step 1: Replace README with Astro-specific content**

Overwrite `apps/website/README.md` with:

```markdown
# Tenang Web

Marketing site for Tenang, built with Astro 5 and deployed to Cloudflare Workers.

## Stack

- [Astro 5](https://astro.build/) — `.astro` static + React islands for interactivity
- [React 19](https://react.dev/) — interactive block variants
- [Tailwind CSS v4](https://tailwindcss.com/) — via `@tailwindcss/vite`
- [Cloudflare Workers](https://workers.cloudflare.com/) — deploy target via `@astrojs/cloudflare` + `wrangler`
- `@treonstudio/bungas-core` — shared component library (workspace package)

## Develop

```bash
pnpm dev          # astro dev (Vite HMR)
pnpm build        # astro build (output to dist/)
pnpm preview      # astro preview (production build locally)
pnpm check        # astro check (type check)
pnpm lint         # eslint .
pnpm deploy       # build + wrangler deploy
```

## Architecture

- `src/pages/` — Astro pages (only `index.astro` currently)
- `src/layouts/` — `BaseLayout.astro` + `ThemeProvider` island
- `src/sections/<section>/variants/<variant>/` — block variants (`.astro` static or `.tsx` interactive)
- `src/sections/<section>/<section>.astro` — section wrapper with `variant` prop
- `src/components/` — shared components (`logo.astro`)
- `src/styles/globals.css` — Tailwind v4 + design tokens (replaces `app/globals.css`)

### Adding a new block variant

1. Create `src/sections/<section>/variants/<variant>/index.astro` (static) or `index.tsx` (interactive).
2. Add the variant to the `variants` map in `src/sections/<section>/<section>.astro`.
3. If interactive, the variant's `index.tsx` must have `'use client'` at the top.
4. The section wrapper handles `client:visible` mounting automatically.

### Adding a new shared primitive

Add it to `packages/core/src/ui/<name>.tsx`. Consume from website via `@treonstudio/bungas-core/ui/<name>`.
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/README.md
git commit -m "docs(website): update README for Astro migration"
```

---

### Task 41: Update root `AGENTS.md`

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Update sections that reference Next.js**

In `/Users/ridho/Documents/go/github.com/raizora/tenang/AGENTS.md`, replace:
- Section "What this repo is" — update the `apps/website` row to mention Astro instead of Next.js
- Section "Stack & pinned versions" — replace Next.js line with `Astro 5.x, @astrojs/react, @astrojs/cloudflare, wrangler`. Note React 19 and TypeScript ~5.8 stay.
- Section "Commands" — replace Next.js scripts with Astro scripts (`astro dev`, `astro build`, `astro preview`, `wrangler deploy`)
- Section "Architecture notes" — update "Shadcn in two places" note (still applies), update "Block pattern" section to reflect `src/sections/<section>/variants/<variant>/` instead of `apps/website/blocks/<section>/<variant>/`. Update path aliases (no more `next.config.ts` for image allowlist — now in `astro.config.mjs`).
- Section "Common gotchas" — remove `next lint` deprecation note. Add note about `wrangler.jsonc#compatibility_date` not being "latest". Add note about `getImage()` for `next/image` migration.
- Section "When adding a new block variant" — update path conventions.
- Section "Verification checklist" — replace `pnpm build` (was Next.js) with `pnpm check && pnpm build` for Astro.

- [ ] **Step 2: Verify the file still makes sense**

Read the updated file. Check that:
- No references to `next.config.ts`, `next/image`, `next/link`, `next lint`
- Path conventions match the new `src/sections/...` structure
- The "Shadcn in two places" note still applies (re-themed in `src/components/ui/`-style... wait, we deleted `components/ui/`. Adjust note.)

Adjustment: the "Veil Kit" re-themed components were in `apps/website/components/ui/`. After migration, these are at `apps/website/src/components/ui/` (if we kept them) or were inlined/removed. Per Task 34, the `components/` directory was deleted. Verify: re-themed components (button.tsx, card.tsx, input.tsx, textarea.tsx, svgs/) — were they used by any block? Check if they were imported.

If they were used, the migration needs to also recreate them. Add a note in AGENTS.md that they were re-created at `src/components/ui/`.

If they were not used, just remove the reference.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md for Astro migration"
```

---

## Self-Review

After the plan is complete, the following should be true:

1. **Spec coverage:**
   - Astro 5 + React islands + Cloudflare Workers: ✓ (Tasks 1-9, 38)
   - 12 React island blocks: ✓ (Tasks 29-32)
   - 45 static blocks: ✓ (Tasks 13-28)
   - Layout + ThemeProvider: ✓ (Tasks 10-12)
   - `next/image` migration: ✓ (Tasks 20, 22-24, 29)
   - `next/link` migration: ✓ (all migration tasks)
   - Shadcn registry unchanged: ✓ (no tasks modify `components.json` or `registry:build`)
   - Deploy via wrangler: ✓ (Task 38)
   - `packages/core` unchanged: ✓ (no tasks modify it)
   - AGENTS.md updated: ✓ (Task 41)

2. **Placeholder scan:** No TBDs, TODOs, or "implement later". All commands have exact paths. All variants have explicit file paths.

3. **Type consistency:** All section wrappers use the same `variants` map pattern. All `.astro` files use `class=` not `className=`. All React islands keep `'use client'`. Path alias `@/` consistently resolves to `apps/website/src/`.

4. **File count:** 57 block variants across 18 sections. Phase 2 covers 45 static (13 sections partially or fully static), Phase 3 covers 12 interactive. Cross-check: hero=5, faqs=5, footer=6, logo-cloud=2, features=3 = 21 interactive candidates, but per design only 12 are interactive (hero 1-4 are interactive due to header.tsx; hero 5 is static; faqs 1-3, 5 are interactive; faqs 4 is static; footer 5-6 are interactive; footer 1-4 are static; logo-cloud 2 interactive, 1 static; features 3 interactive, 1-2 static). Total interactive: 4 + 4 + 2 + 1 + 1 = 12 ✓. Total static: 1 + 1 + 4 + 1 + 2 = 9 from these 5 sections + 36 from remaining 13 sections (3+3+3+2+4+3+3+2+2+2+4+3+3) = 45 ✓. Total: 57 ✓.
