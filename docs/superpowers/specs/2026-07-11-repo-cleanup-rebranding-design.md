# Repo Cleanup & Rebranding Design

## Overview

Clean up legacy artifacts and rebrand the monorepo from "tailark/Tenang" to "Haro" ecosystem.

## Changes

### 1. Delete Legacy Artifacts

| File | Reason |
|------|--------|
| `patch_chatblock.js` | Stale dev artifact; hardcoded `/Users/ridho/...` paths |
| `patch_pages.js` | Stale dev artifact |
| `patch_sidebar.js` | Stale dev artifact |
| `patch_sidebar2.js` | Stale dev artifact |
| `patch_sidebar3.js` | Stale dev artifact |
| `patch_sidebar4.js` | Stale dev artifact |
| `test-render.js` | Scratch file |
| `.github/FUNDING.yml` | Points to `tailark` org, not `treonstudio` |
| `LIBRECHAT_GAP.md` | Historical gap analysis doc, no longer relevant |

### 2. Move `engine/` → `apps/haro-voice/`

- Move all contents recursively preserving directory structure
- `engine/` directory is the "Ara" Python voice assistant (openWakeWord + MiniMax STT/TTS + OpenRouter LLM + FastAPI + React kiosk)
- Not part of the pnpm/turbo monorepo, so no workspace config changes needed
- Update path references in the moved files if they reference `engine/` (self-references within the project)
- The `haro-voice/` project has its own `AGENTS.md` that documents its architecture

### 3. Rename `apps/gateway/` → `apps/haro-gateway/`

- Rename directory
- Update `pnpm-workspace.yaml` to reflect new path
- Update `turbo.json` pipeline references if any
- The internal package name `@treonstudio/gateway` stays the same (it's an npm scope name, not tied to directory)

### 4. Rename `LICENCE.md` → `LICENSE.md`

- Rename file (British → standard spelling)
- Update copyright line: `© 2025 Irung` → `© 2026 Treon Studio`
- Keep license content (MIT) unchanged

### 5. Root `package.json`

- `"name": "tailark"` → `"@treonstudio/haro"`
- No other field changes needed

### 6. Root `README.md` — Rewrite

Describe the full Haro ecosystem:

- What Haro is (umbrella AI ecosystem by Treon Studio)
- Monorepo structure:
  - `apps/website` — Tenang mental wellness web app (Astro 5 + React 19, CF Workers)
  - `apps/haro-voice` — Ara voice assistant (Python, openWakeWord, MiniMax)
  - `apps/memory-fabric` — Python MCP server for mem0, gbrain, vault, tenant management
  - `apps/haro-gateway` — AI proxy gateway (based on Portkey AI Gateway)
  - `apps/mcp` — "OKF" MCP Server for knowledge graph navigation
  - `packages/core` — Shared UI primitives (shadcn, React 19)
  - `packages/ts-config` — Shared TypeScript configs
- Quick start / key commands
- Links to per-app READMEs for details

## Non-Changes (Keep As-Is)

- `superpowers/` — External AI agent framework, keep as-is
- `.superpowers/` — Superpowers workflow artifacts, keep as-is
- `engine/` internal files are moved but not modified
- `apps/gateway/` internal files are moved but not modified except for path references

## Constraints

- No functional code changes — only file moves, renames, and rewrites
- Must update `pnpm-workspace.yaml` and `turbo.json` for directory renames
- Must verify no broken symlinks or imports after moves
