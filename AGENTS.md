# AGENTS.md

Notes for OpenCode (and other agents) working in this repository. Keep it short.

## What this repo is

A merged repo with two unrelated projects living side by side:

- **Root + `apps/`, `packages/`** — pnpm + turbo monorepo powering **Tenang Web** (Astro 5 marketing site, ported from Next.js to Astro + Cloudflare Workers).
- **`apps/haro-voice/`** — Haro, a Python voice assistant stack (FastAPI backend + openWakeWord + MiniMax STT/TTS + OpenRouter LLM + Vite/React kiosk webapp). See `apps/haro-voice/AGENTS.md` for haro-specific notes.

The two projects do not share build tooling or imports. Treat them as separate codebases that happen to be in one git repo.

### Workspaces

| Path | Package | Purpose |
| --- | --- | --- |
| `apps/website` | `@treonstudio/website` | Astro 5 marketing site (the homepage, blocks, theme). The only deployable app. Deployed to Cloudflare Workers. |
| `packages/core` | `@treonstudio/bungas-core` | Vite + React 19 component library. Source-of-truth for shared UI primitives, the `cn()` helper, and hooks. Not published. |
| `packages/ts-config` | `@treonstudio/ts-config` | Shared `tsconfig` base. Consumers extend `@treonstudio/ts-config/base.json` (website) or `astro.json` (website). |
| `apps/haro-voice/` | (no package) | Haro Python voice assistant — see `apps/haro-voice/AGENTS.md`. |

The root `package.json` `name` is still `tailark` (upstream artifact); everything new is `@treonstudio/*`. Don't rename it casually — many build paths and tooling scripts rely on it.

## Project overview

**Tenang** is an Astro-based marketing site and AI chat application — a superset of features inspired by LibreChat, ported from Next.js to Astro + Cloudflare Workers. The site serves both as a landing page (blocks for hero, features, pricing, FAQs, testimonials, etc.) and a full-featured chat application with auth, agents marketplace, projects, prompts, skills management, and more.

Key architectural decisions:
- **Supabase** for auth (email/password, OAuth, 2FA) and database (contact messages, projects, prompts, FAQs, testimonials, agents, skills)
- **Effect-TS** for type-safe, composable error handling in the domain layer
- **Domain-driven design** — each feature (auth, projects, agents, prompts, skills) has its own domain folder with schemas, types, programs (business logic), repositories, and errors
- **LibreChat-inspired chat** — the chat UI block (`blocks/chat/`) is a port of LibreChat's client with multi-model conversation, memories, bookmarks, file attachments, agents, and prompts
- **Supabase migrations** in `apps/website/supabase/migrations/` track the database schema
- **Vitest** for unit tests — contrary to earlier statements, Vitest IS installed and test files exist (e.g., `src/domain/auth/__tests__/`). Run `pnpm test` from `apps/website/`.
- **Graphify** knowledge graph at `graphify-out/` — run `/graphify` in the repo root to rebuild

## Stack & pinned versions

- pnpm `9.10.0` (pinned via `packageManager` in root `package.json`). Use `pnpm`, not npm/yarn.
- Node 20+ assumed by `@types/node`.
- Astro `5.x`, React `19`, TypeScript `~5.8`.
- Tailwind CSS **v4** via `@tailwindcss/vite` — there is no `tailwind.config.js`. Theme tokens live in `apps/website/src/styles/globals.css` inside `@theme inline { ... }`.
- Cloudflare Workers via `@astrojs/cloudflare` + `wrangler`.
- ESLint 9 flat config (website uses `eslint .` for the Astro app).
- Prettier 3.5.1 with `prettier-plugin-tailwindcss`. The repo's `.prettierrc` is intentionally permissive (`printWidth: 500`, `singleAttributePerLine: true`) — don't tighten it without coordinating.

## Commands

All commands run from the repo root unless noted.

- `pnpm dev` — `astro dev` for the website. The core package is not started separately; it's consumed via tsconfig path aliases.
- `pnpm build` — `astro build` for the website. Run from `apps/website` if you only want the app build.
- `pnpm start` — `wrangler dev` (local Cloudflare Workers runtime).
- `pnpm preview` — `astro preview` (preview the built site).
- `pnpm check` — `astro check` (type check + diagnostics).
- `pnpm lint` — `eslint .` for the website. For the core package, `cd packages/core && pnpm lint` runs `eslint .` directly.
- `pnpm registry:build` — runs `shadcn build` to emit the shadcn registry output (used to publish blocks as installable components). This is React-only, unchanged.
- `turbo` task graph is in `turbo.json`. `build` depends on `^build`; `lint`/`dev`/`check`/`registry:build` are non-cached.

Vitest **is** installed and test files exist (e.g., `src/domain/auth/__tests__/`). Run `pnpm test` from `apps/website/`.

## Architecture notes an agent would miss

- **Astro shell + React islands.** `apps/website/src/pages/index.astro` is the only page. It imports block components (`.tsx` files in `blocks/`) and renders them. Interactive blocks (state/effects/refs) are loaded as React islands via `client:load`. Static blocks render server-side as static HTML.
- **Shadcn in two places, on purpose.** `apps/website/src/components/ui/` holds the re-themed "Veil Kit" components (rounded-full button, custom variants). `packages/core/src/ui/` holds the upstream shadcn-style components. `components.json` exists in both roots. The website imports primitives from `packages/core` via the tsconfig path alias `@treonstudio/bungas-core/*`. Example: `import { cn } from '@treonstudio/bungas-core/lib/utils'`.
- **Block pattern.** Marketing sections live at `apps/website/blocks/<section>/<variant>/{index.tsx,header.tsx,...}`. Each variant is a folder, not a single file. `src/pages/index.astro` composes the page by explicitly importing each block. There is no `blocks/index.ts` `blockMap` (that was a Next.js dynamic-import trick; Astro's bundler handles the same job statically).
- **Client/server split.** Most blocks are server-rendered React components (no `'use client'`). Anything using state, effects, refs, browser APIs, or event listeners needs `'use client'` at the top — and the parent `.astro` file must import that block with `client:load` (or `client:idle` / `client:visible`). The `ThemeProvider` island in `BaseLayout.astro` uses `client:only="react"`.
- **Path aliases.** Website uses `@/*` → `apps/website/src/*` and `@treonstudio/bungas-core/*` → `packages/core/src/*`. The same aliases are also defined in `astro.config.mjs` for Vite. Core uses `@/*` → `packages/core/src/*`. The `cn()` helper always comes from `packages/core/src/lib/utils.ts` — never reimplement it locally.
- **Image domains.** `apps/website/astro.config.mjs` whitelists `ik.imagekit.io`, `images.unsplash.com`, `avatars.githubusercontent.com`. The blocks use plain `<img>` tags (no `next/image` anymore) — if you need a new host, add it to `image.domains`.
- **Astro config quirks.** `output: 'server'` with the Cloudflare adapter means SSR by default. To make a route prerender at build time, add `export const prerender = true` in the frontmatter of that `.astro` file. `prerender = true` per route is the plan for the homepage.
- **Tailwind v4 quirks.** No `tailwind.config.js` — add design tokens in `src/styles/globals.css` under `@theme inline`. Use `@import 'tailwindcss';` at the top. The PostCSS config from the Next.js era was deleted; Tailwind v4 is loaded via `@tailwindcss/vite` in `astro.config.mjs`.
- **`@ts-nocheck` on React primitives.** `src/components/ui/button.tsx`, `card.tsx`, `input.tsx`, `textarea.tsx`, `logo.tsx`, and the SVG components in `src/components/ui/svgs/` all start with `// @ts-nocheck`. This is intentional — Astro's JSX namespace and React 19's stricter HTMLAttributes type don't fully agree, and these are well-tested shadcn primitives. Don't strip the directive without fixing the underlying type conflict.
- **Wrangler KV binding.** `apps/website/wrangler.jsonc` declares a `SESSION` KV namespace for Astro's sessions feature. The current namespace ID is for local dev — for production, create a real KV namespace and update the `id` before deploying.

## Common gotchas

- `astro check` will complain about `next/link` and `next/image` if you bring them back. The migration replaced them with native `<a>` and `<img>` tags — search for `from 'next/` in `blocks/` if you suspect a regression.
- `packages/core/tsconfig.app.json` sets `verbatimModuleSyntax: true` and `erasableSyntaxOnly: true`. Type-only imports must use `import type { ... }`, and TS enums/namespaces are disallowed.
- `next.config.ts` was deleted. `astro.config.mjs` replaces it. If you see references to `next.config.ts` in old docs or comments, update them.
- `app/` directory was deleted. Blocks now live at `blocks/` (unchanged) and pages live at `src/pages/`. The `src/components/ui/` directory now holds the shadcn primitives (moved from `components/ui/`).
- `components.json` in `apps/website` points `ui` to `@/components/ui`, but in `packages/core` it points to `@/ui`. Don't unify them.
- Prettier has both `jsxBracketSameLine: true` (legacy) and `bracketSameLine: false` set; the second wins. Don't "clean up" without confirming.
- No CI, no pre-commit hooks. Lint/typecheck discipline is on the agent.

## When adding a new block variant

1. Create `apps/website/blocks/<section>/<variant>/index.tsx` (plus any sub-files like `header.tsx`).
2. Mark `'use client'` only where you need state/effects. If `'use client'`, the parent `.astro` page must load it with `client:load` (or another `client:*` directive).
3. The `src/pages/index.astro` page is the only page that composes blocks today. Add the new import and place it in the JSX where it belongs.
4. Pull primitives from `@treonstudio/bungas-core/ui/*` and `cn` from `@treonstudio/bungas-core/lib/utils`. Use the website-local `src/components/ui/*` for re-themed components.
5. Use Lucide for icons.
6. Use plain `<a>` and `<img>` tags — no `next/link` or `next/image`.

## When adding a new shared primitive

Add it to `packages/core/src/ui/<name>.tsx`, follow the existing shadcn pattern there, then consume it from the website via `@treonstudio/bungas-core/ui/<name>`. The website's `src/components/ui/` is for re-themed overrides, not for new primitives.

## Verification checklist

Before claiming a change is done, run from root:

1. `pnpm check` — `astro check` for the website.
2. `cd packages/core && pnpm lint` — runs `eslint .`.
3. `pnpm build` — full Astro build.
4. (Optional) `pnpm start` — local Cloudflare Workers runtime smoke test.

Skip a step only if you can say exactly why it doesn't apply.
