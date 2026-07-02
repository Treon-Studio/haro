# Tenang

An Astro 5 marketing site and AI chat application — a superset of LibreChat features, ported from Next.js to Astro + Cloudflare Workers. Built with React 19 islands, Tailwind CSS v4, and Supabase.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | [Astro 5](https://astro.build) (SSR on Cloudflare Workers) |
| UI (client) | React 19 islands, Radix UI, Lucide icons |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`, no config file) |
| Backend | Cloudflare Workers via `@astrojs/cloudflare` |
| Database / Auth | Supabase (Postgres, email/password + OAuth + 2FA) |
| State / Errors | Effect-TS, LangChain |
| Package manager | pnpm 9.10 (turborepo) |

## Structure

```
tenang/
├── apps/website/        # Astro app (the deployable site)
│   ├── blocks/          # Marketing sections (hero, pricing, chat, etc.)
│   ├── src/
│   │   ├── domain/      # Domain-driven design: auth, projects, agents, prompts, skills
│   │   ├── pages/       # API routes + index.astro page
│   │   ├── components/  # Re-themed shadcn primitives ("Veil Kit")
│   │   └── lib/         # Supabase client, API helpers
│   └── supabase/        # DB migrations
├── packages/
│   ├── core/            # Shared UI primitives (shadcn), hooks, utils
│   └── ts-config/       # Shared tsconfig base files
└── graphify-out/        # Knowledge graph (run /graphify to rebuild)
```

## Commands

```bash
pnpm dev        # Start dev server
pnpm build      # Build for production
pnpm start      # wrangler dev (Cloudflare Workers runtime)
pnpm check      # astro check (type checking + diagnostics)
pnpm lint       # ESLint (website)
pnpm test       # Vitest (apps/website)
```

## Development

- Blocks are React components in `blocks/<section>/<variant>/`.
- Interactive blocks use `'use client'` and load as islands.
- API routes live in `src/pages/api/` — deployed as Cloudflare Workers endpoints.
- Add a supabase migration in `apps/website/supabase/migrations/`.

## Knowledge Graph

Running `/graphify` in the repo root builds a navigable knowledge graph of the codebase in `graphify-out/`. Open `graphify-out/graph.html` in a browser to explore, or read `graphify-out/GRAPH_REPORT.md` for the full audit.
