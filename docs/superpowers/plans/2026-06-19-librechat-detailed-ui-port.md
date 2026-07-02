# Port LibreChat UI Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the exact DOM structure, Tailwind classes, and client-side logic of LibreChat's Agents, Projects, Prompts, and Skills subsystems into `tenang-web` blocks.

**Architecture:** Copy verbatim component structures from `~/Documents/go/github.com/raizora/LibreChat/client/src/components/*` into `apps/website/blocks/*`. Replace `@librechat/client` context and `react-hook-form` dependencies with standard React hooks or `bungas-core` equivalents while preserving 100% of the Tailwind classes and JSX layout structures.

**Tech Stack:** React 19, Tailwind CSS v4, Astro.

## Global Constraints
- Must retain 100% of the original Tailwind classes, especially `dark:` variants and responsive modifiers.
- Strip `react-router-dom` imports and replace `<Link>` with native `<a>`.
- Substitute `librechat-data-provider` API queries/mutations with state-based dummy hooks that accurately trigger loading (`isLoading`) and error states to preserve the original visual functionality.
- Consolidate deeply nested sub-components (like `Prompts/buttons/*`) into their parent files if they are under 50 lines to keep the new codebase manageable, otherwise recreate the subfolder structure.

---

### Task 1: Port Agent Marketplace (Agents)

**Files:**
- Create: `apps/website/blocks/agents/CategoryTabs.tsx`
- Create: `apps/website/blocks/agents/SearchBar.tsx`
- Create: `apps/website/blocks/agents/AgentCard.tsx`
- Create: `apps/website/blocks/agents/Marketplace.tsx`

**Interfaces:**
- Consumes: Static mock data arrays representing LibreChat agents.
- Produces: A main `<Marketplace />` React component exported to Astro.

- [ ] **Step 1: Port CategoryTabs and SearchBar**
Read `CategoryTabs.tsx` and `SearchBar.tsx` from LibreChat. Copy their JSX structure and Tailwind classes exactly. Replace `useLocalize` with static text strings.

- [ ] **Step 2: Port AgentCard**
Read `AgentCard.tsx` from LibreChat. Copy the exact hover styles, image fallback logic, and layout constraints. Remove `react-router-dom` navigation and replace with standard `href={`/agents/${agent.id}`}`.

- [ ] **Step 3: Assemble Marketplace**
Read `Marketplace.tsx` from LibreChat. Recreate the layout grid (handling the sidebar/header spacing) and embed `CategoryTabs`, `SearchBar`, and a mapped grid of `AgentCard`s.

---

### Task 2: Port Projects Workspace

**Files:**
- Create: `apps/website/blocks/projects/ProjectChatList.tsx`
- Create: `apps/website/blocks/projects/ProjectCreateDialog.tsx`
- Create: `apps/website/blocks/projects/ProjectsView.tsx`

**Interfaces:**
- Consumes: Static mock data for Projects and nested Chats.
- Produces: `<ProjectsView />` component exported to Astro.

- [ ] **Step 1: Port ProjectCreateDialog**
Read `ProjectCreateDialog.tsx` from LibreChat. Copy the Radix dialog styling. Strip `react-hook-form` and replace with standard controlled `useState` inputs, keeping all `className` attributes untouched.

- [ ] **Step 2: Port ProjectChatList**
Read `ProjectChatList.tsx` from LibreChat. Copy the sidebar/list styling for chats inside a project workspace.

- [ ] **Step 3: Assemble ProjectsView**
Read `ProjectsView.tsx`. Assemble the layout that splits the screen between the Project sidebar/chat list and the main view.

---

### Task 3: Port Prompts UI

**Files:**
- Create: `apps/website/blocks/prompts/InlinePromptsView.tsx`
- Create: `apps/website/blocks/prompts/PromptEditor.tsx`
- Create: `apps/website/blocks/prompts/PromptSidebar.tsx`

**Interfaces:**
- Consumes: Mock data representing system prompts.
- Produces: `<InlinePromptsView />` main component.

- [ ] **Step 1: Port PromptSidebar**
Read the files in LibreChat's `components/Prompts/sidebar/`. Consolidate the list rendering and filter inputs into `PromptSidebar.tsx`. Preserve all Tailwind classes for the active/inactive states of sidebar items.

- [ ] **Step 2: Port PromptEditor**
Read the files in LibreChat's `components/Prompts/editor/` and `fields/`. Consolidate the variable inputs, textareas, and command buttons into `PromptEditor.tsx`. Ensure the textarea auto-resize logic or specific Tailwind height constraints are preserved.

- [ ] **Step 3: Assemble InlinePromptsView**
Assemble the sidebar and editor into the main `InlinePromptsView.tsx`. 

---

### Task 4: Port Skills UI

**Files:**
- Create: `apps/website/blocks/skills/SkillsView.tsx`
- Create: `apps/website/blocks/skills/SkillForm.tsx`

**Interfaces:**
- Consumes: Mock data for AI Skills/Tools.
- Produces: `<SkillsView />` main component.

- [ ] **Step 1: Port SkillForm**
Read LibreChat's `components/Skills/forms/`. Copy the credential inputs, toggle switches, and metadata fields exactly. Use standard React state instead of `react-hook-form` but keep the validation error message styles (e.g., `text-red-500 text-sm mt-1`).

- [ ] **Step 2: Assemble SkillsView**
Assemble the main list and form toggle view into `SkillsView.tsx`. Ensure the responsive layout (stacking on mobile, side-by-side on desktop if applicable) is perfectly retained.
