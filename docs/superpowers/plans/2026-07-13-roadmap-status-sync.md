# Roadmap Status Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `docs/superpowers/plans/2026-07-13-full-ai-assistant-roadmap.md`'s status markers back in sync with reality — 6 tasks (0.0, 0.1, 0.2, 0.3, 1.1, 3.1) are actually complete per `.superpowers/sdd/progress.md` and `git log`, but the roadmap's own status line, per-task annotations, checkboxes, and execution-order table only reflect 2 of them (0.0, 0.1), risking duplicate dispatch of already-finished work.

**Architecture:** Pure documentation edit, no code changes. Four independent, sequential edits to the same file: (1) the top-level status summary line, (2) per-task "already complete" annotations for the 4 undocumented-but-done tasks, (3) checking off their step checkboxes, (4) updating the `[DONE]` markers in the Execution Order & Parallelism table. Each edit is verified by re-reading the changed region before committing.

**Tech Stack:** Markdown only.

## Global Constraints

- Only modify `docs/superpowers/plans/2026-07-13-full-ai-assistant-roadmap.md` — no other file changes, no code changes.
- Match the existing "Status: already complete" annotation style used verbatim in Task 0.0 and Task 0.1 (see current lines 60 and 134) — same wording pattern, same backtick commit-range format.
- Do not alter any task's design content (Files/Interfaces/Decision/Step bodies) beyond adding status annotations and toggling checkbox state — this plan fixes tracking metadata only, not task substance.
- Ground truth for "what's actually done" is `.superpowers/sdd/progress.md` plus `git log --oneline`, cross-checked against the live code (already verified in this conversation — see the six commit ranges cited below).
- Commit after each task, matching this repo's convention of one focused commit per logical change.

---

### Task 1: Update the top-level status summary line

**Files:**
- Modify: `docs/superpowers/plans/2026-07-13-full-ai-assistant-roadmap.md:30`

**Interfaces:**
- Consumes: nothing (first edit in the file)
- Produces: corrected status line that Task 2/3/4's edits will be consistent with

- [ ] **Step 1: Make the edit**

Find this exact line:

```markdown
**Status as of 2026-07-13:** `[DONE]` 0.0, 0.1. Everything else pending.
```

Replace with:

```markdown
**Status as of 2026-07-13:** `[DONE]` 0.0, 0.1, 0.2, 0.3, 1.1, 3.1. Next unblocked: 0.4 (Track A), 1.2 (Track B), 2.4 (Track D, independent). Everything else pending.
```

- [ ] **Step 2: Verify**

```bash
grep -n "Status as of 2026-07-13" docs/superpowers/plans/2026-07-13-full-ai-assistant-roadmap.md
```

Expected: one match showing the new line with all six task IDs.

- [ ] **Step 3: Commit**

```bash
cd /root/go-workspace/haro
git add docs/superpowers/plans/2026-07-13-roadmap-status-sync.md docs/superpowers/plans/2026-07-13-full-ai-assistant-roadmap.md
git commit -m "docs: correct roadmap status summary to reflect 6 completed tasks"
```

---

### Task 2: Add "already complete" annotations to Task 0.2, 0.3, 1.1, 3.1

**Files:**
- Modify: `docs/superpowers/plans/2026-07-13-full-ai-assistant-roadmap.md:154, 172, 222, 394`

**Interfaces:**
- Consumes: Task 1's corrected status line (this task's annotations must cite the same six task IDs)
- Produces: per-task annotations that Task 3's checkbox pass will be consistent with (a task marked "already complete" must have all its checkboxes checked)

- [ ] **Step 1: Annotate Task 0.2**

Find this exact line (Task 0.2's "Depends on" line):

```markdown
**Depends on:** none (independent of 0.0/0.1). Parallelizable with Task 0.3 — coordinate on field names (`tenantSlug`, `companyId`) since 0.3's type must match what this task's resolver actually returns.
```

Replace with:

```markdown
**Depends on:** none (independent of 0.0/0.1). Parallelizable with Task 0.3 — coordinate on field names (`tenantSlug`, `companyId`) since 0.3's type must match what this task's resolver actually returns. **Status: already complete** (commit `0c55e27`) — kept here for context only, do not re-dispatch.
```

- [ ] **Step 2: Annotate Task 0.3**

Find this exact line (Task 0.3's "Depends on" line):

```markdown
**Depends on:** none (independent of 0.0/0.1). Parallelizable with Task 0.2 — see 0.2's note on coordinating field names.
```

Replace with:

```markdown
**Depends on:** none (independent of 0.0/0.1). Parallelizable with Task 0.2 — see 0.2's note on coordinating field names. **Status: already complete** (commit `0747f71`) — kept here for context only, do not re-dispatch.
```

- [ ] **Step 3: Annotate Task 1.1**

Find this exact line (Task 1.1's "Depends on" line):

```markdown
**Depends on:** none from Phase 0 — this task's routing change (chat.ts → gateway via `x-haro-config-id`) doesn't touch tenant-scoped auth, so it has no hard dependency on Task 0.0-0.4 and could in principle be worked in parallel with Phase 0. Sequenced first in Phase 1 by convention, not by a technical requirement.
```

Replace with:

```markdown
**Depends on:** none from Phase 0 — this task's routing change (chat.ts → gateway via `x-haro-config-id`) doesn't touch tenant-scoped auth, so it has no hard dependency on Task 0.0-0.4 and could in principle be worked in parallel with Phase 0. Sequenced first in Phase 1 by convention, not by a technical requirement. **Status: already complete** (commits `5d73a2b..f3bdbda`) — kept here for context only, do not re-dispatch.
```

- [ ] **Step 4: Annotate Task 3.1**

Find this exact line (Task 3.1's "Depends on" line):

```markdown
**Depends on:** none — pure `haro-gateway` plugin work, independent of website/Phase 0-2 changes. Can be worked any time, in parallel with Phase 1/2.
```

Replace with:

```markdown
**Depends on:** none — pure `haro-gateway` plugin work, independent of website/Phase 0-2 changes. Can be worked any time, in parallel with Phase 1/2. **Status: already complete** (commits `d424d13..a889606`) — kept here for context only, do not re-dispatch.
```

- [ ] **Step 5: Verify**

```bash
grep -n "Status: already complete" docs/superpowers/plans/2026-07-13-full-ai-assistant-roadmap.md
```

Expected: 6 matches total (the pre-existing Task 0.0 and 0.1 annotations, plus the 4 just added for 0.2, 0.3, 1.1, 3.1).

- [ ] **Step 6: Commit**

```bash
cd /root/go-workspace/haro
git add docs/superpowers/plans/2026-07-13-full-ai-assistant-roadmap.md
git commit -m "docs: annotate Task 0.2/0.3/1.1/3.1 as already complete in roadmap"
```

---

### Task 3: Check off completed step checkboxes

**Files:**
- Modify: `docs/superpowers/plans/2026-07-13-full-ai-assistant-roadmap.md` — Task 0.2's steps (5), Task 0.3's steps (2), Task 1.1's steps (7), Task 3.1's steps (4)

**Interfaces:**
- Consumes: Task 2's annotations (only tasks marked "already complete" get their checkboxes checked)
- Produces: none consumed downstream — this is the last content edit before Task 4's table pass

- [ ] **Step 1: Check off Task 0.2's 5 steps**

In the Task 0.2 section, change all 5 occurrences of `- [ ] **Step N:` to `- [x] **Step N:` for its steps (Step 1 through Step 5 — resolution strategy, add resolver, replace tenant reads, test, commit).

- [ ] **Step 2: Check off Task 0.3's 2 steps**

In the Task 0.3 section, change both `- [ ] **Step 1:** Define the type...` and `- [ ] **Step 2:** Commit.` to `- [x]`.

- [ ] **Step 3: Check off Task 1.1's 7 steps**

In the Task 1.1 section, change all 7 occurrences of `- [ ] **Step N:` to `- [x] **Step N:` (Step 1 through Step 7 — read gateway config shape, create gateway_configs row, implement reroute, remove BYOK code paths, preserve attachments/tools behavior, test, commit).

- [ ] **Step 4: Check off Task 3.1's 4 steps**

In the Task 3.1 section, change all 4 occurrences of `- [ ] **Step N:` to `- [x] **Step N:` (Step 1 through Step 4 — decide detection mechanism, implement/attach, test, commit).

- [ ] **Step 5: Verify**

```bash
awk '/^### Task 0\.2:/,/^### Task 0\.3:/' docs/superpowers/plans/2026-07-13-full-ai-assistant-roadmap.md | grep -c "\- \[x\]"
awk '/^### Task 0\.3:/,/^### Task 0\.4:/' docs/superpowers/plans/2026-07-13-full-ai-assistant-roadmap.md | grep -c "\- \[x\]"
awk '/^### Task 1\.1:/,/^### Task 1\.2:/' docs/superpowers/plans/2026-07-13-full-ai-assistant-roadmap.md | grep -c "\- \[x\]"
awk '/^### Task 3\.1:/,/^### Task 3\.2:/' docs/superpowers/plans/2026-07-13-full-ai-assistant-roadmap.md | grep -c "\- \[x\]"
```

Expected: `5`, `2`, `7`, `4` respectively.

- [ ] **Step 6: Commit**

```bash
cd /root/go-workspace/haro
git add docs/superpowers/plans/2026-07-13-full-ai-assistant-roadmap.md
git commit -m "docs: check off completed steps for Task 0.2/0.3/1.1/3.1 in roadmap"
```

---

### Task 4: Update the Execution Order & Parallelism table

**Files:**
- Modify: `docs/superpowers/plans/2026-07-13-full-ai-assistant-roadmap.md:36-40` (the "Independent tracks" table)

**Interfaces:**
- Consumes: Tasks 1-3's completed annotations (this table must not claim a track's first item is pending when Task 2 already marked it complete)
- Produces: none — this is the final task in this plan

- [ ] **Step 1: Make the edit**

Find this exact table block:

```markdown
| Track | Sequence | Converges at |
|---|---|---|
| **A — Identity foundation** | 0.0 [DONE] → 0.4 · 0.1 [DONE] (independent) · 0.2 ∥ 0.3 → 0.4 | feeds Track D and Task 4.1 |
| **B — Gateway routing + loop** | 1.1 → 1.2 → 1.3 | feeds Track D, Track E, Task 4.1 |
| **C — Safety plugin** | 3.1 (fully independent, start any time) | feeds Track E |
| **D — Memory wiring** | (needs Track A's 0.3+0.4, Track B's 1.2) → 2.1 → 2.2 → 2.3 · 2.4 independent, run any time | feeds Task 4.1 |
| **E — Safety wiring** | (needs Track B's 1.2, Track C's 3.1) → 3.2 | feeds Task 4.1 |
```

Replace with:

```markdown
| Track | Sequence | Converges at |
|---|---|---|
| **A — Identity foundation** | 0.0 [DONE] → 0.4 · 0.1 [DONE] (independent) · 0.2 [DONE] ∥ 0.3 [DONE] → 0.4 (unblocked, not started) | feeds Track D and Task 4.1 |
| **B — Gateway routing + loop** | 1.1 [DONE] → 1.2 (unblocked, not started) → 1.3 | feeds Track D, Track E, Task 4.1 |
| **C — Safety plugin** | 3.1 [DONE] (fully independent, start any time) | feeds Track E |
| **D — Memory wiring** | (needs Track A's 0.3 [DONE] +0.4, Track B's 1.2) → 2.1 → 2.2 → 2.3 · 2.4 independent, run any time (not started) | feeds Task 4.1 |
| **E — Safety wiring** | (needs Track B's 1.2, Track C's 3.1 [DONE]) → 3.2 (blocked only on 1.2 now) | feeds Task 4.1 |
```

- [ ] **Step 2: Verify**

```bash
grep -n "0.2 \[DONE\]\|1.1 \[DONE\]\|3.1 \[DONE\]" docs/superpowers/plans/2026-07-13-full-ai-assistant-roadmap.md
```

Expected: 3 matches (one line each for Track A, Track B, Track C rows).

- [ ] **Step 3: Commit**

```bash
cd /root/go-workspace/haro
git add docs/superpowers/plans/2026-07-13-full-ai-assistant-roadmap.md
git commit -m "docs: mark 0.2/1.1/3.1 done in roadmap execution-order table"
```

---

## Verification Summary

| Task | Verification |
|---|---|
| 1 | Status line lists all 6 done task IDs |
| 2 | 6 total "Status: already complete" annotations in the file |
| 3 | 5+2+7+4 = 18 checkboxes checked across Task 0.2/0.3/1.1/3.1 |
| 4 | Execution-order table shows `[DONE]` on 0.2, 1.1, 3.1 rows |

After all 4 tasks: re-read the full roadmap file once and confirm a fresh agent picking it up would correctly dispatch **0.4, 1.2, 2.4** next, and nothing else.
