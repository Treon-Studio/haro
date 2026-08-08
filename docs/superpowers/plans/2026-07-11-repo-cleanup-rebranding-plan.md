# Repo Cleanup & Rebranding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up legacy artifacts and rebrand the monorepo from "tailark/Tenang" to the Haro ecosystem.

**Architecture:** All changes are file-level — deletes, moves, renames, and a README rewrite. No functional code changes. `pnpm-workspace.yaml` uses `apps/*` glob so directory renames under `apps/` don't need config updates. `turbo.json` doesn't reference specific app directories.

**Tech Stack:** Git, pnpm, turbo

## Global Constraints

- No functional code changes — only file moves, renames, deletes, and README/package.json edits
- Each task must commit independently
- Verify `pnpm build` from root still works after all changes

---

### Task 1: Delete Legacy Files

**Files:**
- Delete: `patch_chatblock.js`
- Delete: `patch_pages.js`
- Delete: `patch_sidebar.js`
- Delete: `patch_sidebar2.js`
- Delete: `patch_sidebar3.js`
- Delete: `patch_sidebar4.js`
- Delete: `test-render.js`
- Delete: `.github/FUNDING.yml`
- Delete: `LIBRECHAT_GAP.md`

- [ ] **Step 1: Delete and stage all 9 files**

```bash
cd /root/go-workspace/haro
git rm patch_chatblock.js patch_pages.js patch_sidebar.js patch_sidebar2.js patch_sidebar3.js patch_sidebar4.js test-render.js .github/FUNDING.yml LIBRECHAT_GAP.md
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: remove legacy dev artifacts (patch scripts, stale docs, FUNDING)"
```

---

### Task 2: Move `engine/` → `apps/haro-voice/`

**Files:**
- Move: `engine/*` → `apps/haro-voice/`

- [ ] **Step 1: Move directory**

```bash
cd /root/go-workspace/haro
mkdir -p apps/haro-voice
# Use cp -a to preserve permissions, then rm -rf the original
cp -a engine/* apps/haro-voice/
cp -a engine/.gitignore apps/haro-voice/ 2>/dev/null || true
cp -a engine/.env* apps/haro-voice/ 2>/dev/null || true
```

- [ ] **Step 2: Verify move**

```bash
ls apps/haro-voice/ | head -10
```
Expected: See `backend/`, `wake_word_service/`, `webapp/`, `config/`, `README.md`, etc.

```bash
diff -r engine apps/haro-voice/ 2>/dev/null | head -5 || echo "No differences (or engine is empty)"
```

- [ ] **Step 3: Remove original engine/**

```bash
rm -rf engine/
```

- [ ] **Step 4: Commit**

```bash
git add apps/haro-voice/ engine/  # engine/ removal tracked
git commit -m "refactor: move engine/ to apps/haro-voice/"
```

---

### Task 3: Rename `apps/gateway/` → `apps/haro-gateway/`

**Files:**
- Rename: `apps/gateway/` → `apps/haro-gateway/`

- [ ] **Step 1: Rename using git mv**

```bash
cd /root/go-workspace/haro
git mv apps/gateway apps/haro-gateway
```

- [ ] **Step 2: Verify**

```bash
ls apps/haro-gateway/ | head -5
ls apps/gateway/ 2>&1
```
Expected: first shows files, second shows `No such file or directory`

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor: rename apps/gateway/ to apps/haro-gateway/"
```

---

### Task 4: Fix `LICENCE.md` → `LICENSE.md`

**Files:**
- Rename: `LICENCE.md` → `LICENSE.md`
- Modify: `LICENSE.md` (update copyright)

- [ ] **Step 1: Rename file**

```bash
cd /root/go-workspace/haro
git mv LICENCE.md LICENSE.md
```

- [ ] **Step 2: Update copyright line**

```bash
sed -i 's/Copyright (c) 2025 Irung/Copyright (c) 2026 Treon Studio/' LICENSE.md
```

- [ ] **Step 3: Verify**

```bash
head -3 LICENSE.md
```
Expected:
```
MIT License

Copyright (c) 2026 Treon Studio
```

- [ ] **Step 4: Commit**

```bash
git add LICENSE.md
git commit -m "chore: rename LICENCE.md to LICENSE.md, update copyright to Treon Studio"
```

---

### Task 5: Update Root `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Change `"name"` from `"tailark"` to `"@treonstudio/haro"`**

```bash
cd /root/go-workspace/haro
sed -i 's/"name": "tailark"/"name": "@treonstudio\/haro"/' package.json
```

- [ ] **Step 2: Verify**

```bash
grep '"name"' package.json
```
Expected: `"name": "@treonstudio/haro"`

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: rename root package from tailark to @treonstudio/haro"
```

---

### Task 6: Rewrite Root `README.md`

**Files:**
- Modify: `README.md`

**Content:** Replace the outdated "Tenang" README with a Haro ecosystem description.

- [ ] **Step 1: Write new README.md**

```markdown
# Haro Monorepo

**Haro** is the AI ecosystem by Treon Studio — a collection of products and services for
conversational AI, mental wellness, voice assistance, and LLM tooling.

## Projects

| Path | Package | Description |
|------|---------|-------------|
| `apps/website` | `@treonstudio/website` | **Tenang** — AI mental wellness web app (Astro 5 + React 19, Cloudflare Workers) |
| `apps/haro-voice` | — | **Ara** — Python voice assistant (openWakeWord, MiniMax STT/TTS, OpenRouter LLM, FastAPI) |
| `apps/memory-fabric` | — | Python MCP server for mem0 (memory), gbrain (knowledge graph), vault (file storage), tenant management |
| `apps/haro-gateway` | `@treonstudio/gateway` | AI proxy gateway — routes to 250+ LLMs with fallbacks, caching, guardrails (based on Portkey AI Gateway) |
| `apps/mcp` | `@treonstudio/mcp` | "OKF" MCP Server for knowledge graph navigation |
| `packages/core` | `@treonstudio/bungas-core` | Shared React 19 UI primitives (shadcn), hooks, utils |
| `packages/ts-config` | `@treonstudio/ts-config` | Shared TypeScript configurations |

## Quick Start

```bash
# Install dependencies (website/gateway)
pnpm install

# Run website locally
pnpm dev

# Build website
pnpm build

# Check types & lint
pnpm check
pnpm lint
```

## Per-Project Docs

- `apps/website/` — [Tenang website](apps/website/README.md)
- `apps/haro-voice/` — [Ara voice assistant](apps/haro-voice/README.md)
- `apps/memory-fabric/` — [Memory Fabric MCP server](apps/memory-fabric/README.md)
- `apps/haro-gateway/` — [AI gateway](apps/haro-gateway/README.md)
- `apps/mcp/` — [OKF MCP server](apps/mcp/README.md)
- `packages/core/` — [UI component library](packages/core/README.md)
- `packages/ts-config/` — [Shared TS configs](packages/ts-config/README.md)

## License

MIT — see [LICENSE.md](LICENSE.md).
```

- [ ] **Step 2: Verify**

```bash
head -5 README.md
```
Expected: `# Haro Monorepo`

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: rewrite root README for Haro ecosystem"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Check git status is clean**

```bash
cd /root/go-workspace/haro
git status
```
Expected: `nothing to commit, working tree clean`

- [ ] **Step 2: Verify pnpm/turbo still works**

```bash
pnpm install 2>&1 | tail -5
```
Expected: no errors, workspaces resolved correctly

- [ ] **Step 3: Verify file structure**

```bash
ls apps/
```
Expected: `haro-gateway/  haro-voice/  mcp/  memory-fabric/  website/`

```bash
ls *.md
```
Expected: `LICENSE.md  README.md` (no `LICENCE.md`)

```bash
ls patch_*.js 2>&1; ls test-render.js 2>&1; ls .github/FUNDING.yml 2>&1; ls LIBRECHAT_GAP.md 2>&1
```
Expected: all show `No such file or directory`

- [ ] **Step 4: Check git log**

```bash
git log --oneline -7
```
Expected: 7 commits matching the 7 tasks
