# Phase 1: LibreChat Core Primitives & Utilities Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port missing foundational UI primitives (Radix-based) and utility functions (Markdown, LaTeX, tree building) from LibreChat into the Tenang monorepo.

**Architecture:** 
- UI Primitives will be placed into `packages/core/src/ui/` (shared Vite component library).
- Utilities will be placed into `packages/core/src/utils/` to be shared across the workspace.
- The Tenang website (`apps/website`) will consume these via the `@treonstudio/bungas-core` workspace alias.

**Tech Stack:** React 19, Radix UI, Tailwind CSS v4, marked, katex, clsx, tailwind-merge.

---

### Task 1: Migrate Core Utilities (Markdown, LaTeX, Math)

**Files:**
- Create: `packages/core/src/utils/markdown.ts`
- Create: `packages/core/src/utils/latex.ts`
- Create: `packages/core/src/utils/tree.ts`
- Modify: `packages/core/package.json`

- [ ] **Step 1: Install required dependencies in core**

Run: `cd packages/core && pnpm add marked highlight.js katex rehype-highlight`
Run: `cd packages/core && pnpm add -D @types/marked @types/katex @types/highlight.js`
Expected: Packages added to `packages/core/package.json`.

- [ ] **Step 2: Create tree builder utility**

```typescript
// packages/core/src/utils/tree.ts
export type MessageNode = {
  id: string;
  parentMessageId?: string;
  children?: MessageNode[];
  [key: string]: any;
};

export function buildMessageTree(messages: MessageNode[]): MessageNode[] {
  const map = new Map<string, MessageNode>();
  const roots: MessageNode[] = [];

  messages.forEach(msg => {
    map.set(msg.id, { ...msg, children: [] });
  });

  messages.forEach(msg => {
    const node = map.get(msg.id)!;
    if (msg.parentMessageId && map.has(msg.parentMessageId)) {
      map.get(msg.parentMessageId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}
```

- [ ] **Step 3: Create simple markdown and LaTeX stubs**

```typescript
// packages/core/src/utils/markdown.ts
import { marked } from 'marked';

export function parseMarkdown(content: string): Promise<string> {
  return marked.parse(content);
}
```

```typescript
// packages/core/src/utils/latex.ts
import katex from 'katex';

export function renderLatex(content: string, displayMode = false): string {
  try {
    return katex.renderToString(content, { displayMode, throwOnError: false });
  } catch (error) {
    console.error('KaTeX rendering error', error);
    return content;
  }
}
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm --filter @treonstudio/bungas-core lint` (or run `tsc --noEmit` if configured).
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/package.json packages/core/src/utils/
git commit -m "feat(core): add markdown, latex, and tree building utilities"
```

---

### Task 2: Port Data Display Primitives (Skeleton, Badge, Progress)

**Files:**
- Create: `packages/core/src/ui/skeleton.tsx`
- Create: `packages/core/src/ui/badge.tsx`
- Create: `packages/core/src/ui/progress.tsx`
- Modify: `packages/core/package.json`

- [ ] **Step 1: Install Radix UI dependencies**

Run: `cd packages/core && pnpm add @radix-ui/react-progress`
Expected: Added to dependencies.

- [ ] **Step 2: Create Skeleton component**

```tsx
// packages/core/src/ui/skeleton.tsx
import { cn } from "../lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
```

- [ ] **Step 3: Create Badge component**

```tsx
// packages/core/src/ui/badge.tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
```

- [ ] **Step 4: Create Progress component**

```tsx
// packages/core/src/ui/progress.tsx
"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "../lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
```

- [ ] **Step 5: Verify build**

Run: `cd packages/core && pnpm lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/ui/skeleton.tsx packages/core/src/ui/badge.tsx packages/core/src/ui/progress.tsx packages/core/package.json
git commit -m "feat(core): port skeleton, badge, and progress ui primitives"
```

---

### Task 3: Port Advanced Navigation and Dropdowns (DropdownMenu)

**Files:**
- Create: `packages/core/src/ui/dropdown-menu.tsx`
- Modify: `packages/core/package.json`

- [ ] **Step 1: Install Radix Dropdown**

Run: `cd packages/core && pnpm add @radix-ui/react-dropdown-menu lucide-react`
Expected: Dependencies added.

- [ ] **Step 2: Create DropdownMenu component**

```tsx
// packages/core/src/ui/dropdown-menu.tsx
"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "../lib/utils"

const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
const DropdownMenuGroup = DropdownMenuPrimitive.Group
const DropdownMenuPortal = DropdownMenuPrimitive.Portal
const DropdownMenuSub = DropdownMenuPrimitive.Sub
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent",
      inset && "pl-8",
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
))
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
```

- [ ] **Step 3: Verify build**

Run: `cd packages/core && pnpm lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/ui/dropdown-menu.tsx packages/core/package.json
git commit -m "feat(core): port dropdown-menu primitive"
```

---

### Task 4: Port Layout Primitives (Collapsible & Resizable)

**Files:**
- Create: `packages/core/src/ui/collapsible.tsx`
- Create: `packages/core/src/ui/resizable.tsx`
- Modify: `packages/core/package.json`

- [ ] **Step 1: Install Radix dependencies**

Run: `cd packages/core && pnpm add @radix-ui/react-collapsible react-resizable-panels`
Expected: Added.

- [ ] **Step 2: Create Collapsible Component**

```tsx
// packages/core/src/ui/collapsible.tsx
"use client"

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

const Collapsible = CollapsiblePrimitive.Root
const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger
const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
```

- [ ] **Step 3: Create Resizable Component**

```tsx
// packages/core/src/ui/resizable.tsx
"use client"

import { GripVertical } from "lucide-react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "../lib/utils"

const ResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
  <ResizablePrimitive.PanelGroup
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className
    )}
    {...props}
  />
)

const ResizablePanel = ResizablePrimitive.Panel

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean
}) => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </ResizablePrimitive.PanelResizeHandle>
)

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
```

- [ ] **Step 4: Verify build**

Run: `cd packages/core && pnpm lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/ui/collapsible.tsx packages/core/src/ui/resizable.tsx packages/core/package.json
git commit -m "feat(core): port collapsible and resizable layout primitives"
```
