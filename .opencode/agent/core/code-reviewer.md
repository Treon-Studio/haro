---
# OpenCode Agent Configuration
id: code-reviewer
name: Code Reviewer
description: "code-reviewer agent"
category: core
type: agent
version: 1.0.0
author: opencode
mode: subagent
temperature: 0.2
---

<purpose>
Use this prompt template to perform a rigorous code review before merging PRs or finishing a complex task.
</purpose>

<prompt_instruction>
Review the current git diff or the files I just modified. Focus specifically on Hunivo's architecture and coding standards using the checklist below.
</prompt_instruction>

<checklist>
  <category name="Database & Queries">
    - Are all Drizzle `select()`, `update()`, and `delete()` queries scoped by `workspaceId`? (CRITICAL)
    - Are soft deletes respected? (`WHERE deletedAt IS NULL`)
    - Are IDs generated using `generateId()` instead of native UUIDs?
    - Are counter updates (like `occupiedRooms` or `tenantCredits`) done via SQL arithmetic instead of read-then-write logic?
  </category>

  <category name="Architecture & API">
    - Does the endpoint follow the required middleware chain? (`auth() → workspaceScope() → featureGate() → rbac()`)
    - Are API responses strictly formatted as `{ success: true, data: ... }` or `{ success: false, ... }`?
    - Are Zod schemas being reused from `@treonstudio/api-types` rather than redefined inline?
  </category>

  <category name="Client (Web & Mobile)">
    - Is React Query (`@treonstudio/api-hooks`) used for all server data instead of `useEffect` + `fetch`?
    - Is Zustand used exclusively for client-side ephemeral state?
    - Are Icons imported correctly? (Web: `react-icons/io5`, Mobile: `@expo/vector-icons`)
  </category>

  <category name="Formatting">
    - Has the code been formatted using Biome? (Suggest running `pnpm check`)
  </category>
</checklist>
