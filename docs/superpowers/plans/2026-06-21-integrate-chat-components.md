# Phase 3: Integrate Core Chat Components & Utilities Into Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace broken/incomplete core chat components with working versions that use the newly ported utilities, and integrate them into the website's chat blocks. Refactor `MessagesView` to use the `renderLatex` utility for math support.

**Architecture:**
- Refactor `packages/core/src/ui/chat/message-content.tsx` to use the website's simple `Message` type (no `@inferencesh/sdk` dependency) and use the `marked` + `renderLatex` utilities for rendering.
- Refactor `packages/core/src/ui/chat/message-bubble.tsx` to be self-contained with Tailwind classes.
- Wire `MessageContent` and `MessageBubble` into `MessagesView` in the website.
- Enhance `MessagesView` to support inline and block LaTeX rendering using `renderLatex`.

**Tech Stack:** React 19, Tailwind CSS v4, marked, katex, rehype-highlight, Astro.

---

### Task 1: Refactor message-content.tsx to remove @inferencesh/sdk dependency

**Files:**
- Modify: `packages/core/src/ui/chat/message-content.tsx`

**Context:** The current `message-content.tsx` imports `ChatMessageDTO` and `ChatMessageContentType*` from `@inferencesh/sdk`, which is not installed. It also has broken internal imports to `@/components/infsh/agent/*`. We will replace the interface with a simple `Message` type and use the `marked` utility from `@/utils/markdown.ts`.

- [ ] **Step 1: Read the current message-content.tsx**

Read `packages/core/src/ui/chat/message-content.tsx` in full.

- [ ] **Step 2: Rewrite the imports**

Replace the import block with:

```tsx
import React, { memo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/ui/skeleton';
import { FileIcon, ExternalLink } from 'lucide-react';
import type { Message } from '@/utils/message-types';
import { renderLatex } from '@/utils/latex';
```

Note: We will create the `Message` type in Task 1 Step 4.

- [ ] **Step 3: Rewrite the component props**

Replace `MessageContentProps` with:

```tsx
export interface MessageContentProps {
  content: string;
  className?: string;
  truncate?: boolean;
  isStreaming?: boolean;
}
```

- [ ] **Step 4: Create shared message types utility**

Create `packages/core/src/utils/message-types.ts`:

```tsx
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface MessageContentPart {
  type: 'text' | 'image' | 'file';
  text?: string;
  image?: string;
  file?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt?: Date;
  attachments?: { id: string; name: string; dataUrl?: string }[];
  isStreaming?: boolean;
  error?: boolean;
}
```

- [ ] **Step 5: Rewrite the rendering logic**

Replace the entire component body with a version that:
1. Uses `marked` to parse markdown (from `@/utils/markdown`).
2. Uses `renderLatex` to pre-process inline `$...$` and block `$$...$$` LaTeX before passing to `marked`.
3. Renders with custom components for code blocks (using `rehype-highlight`), headings, paragraphs, etc.
4. Has a streaming cursor animation.

Here is the complete replacement for `message-content.tsx`:

```tsx
// packages/core/src/ui/chat/message-content.tsx
'use client'

import React, { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { renderLatex } from '@/utils/latex';

// =============================================================================
// Markdown processing helpers
// =============================================================================

function processContent(content: string): string {
  return content
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, latex) =>
      `<div class="katex-block my-3">${renderLatex(latex.trim(), true)}</div>`
    )
    .replace(/\$([^\$\n]+?)\$/g, (_, latex) =>
      `<span class="katex-inline">${renderLatex(latex.trim(), false)}</span>`
    );
}

// =============================================================================
// Code Block Component
// =============================================================================

interface CodeBlockProps {
  className?: string;
  children?: React.ReactNode;
  codeText: string;
}

const CodeBlock = memo(function CodeBlock({ className, children, codeText }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);
  const language = className?.replace('language-', '') ?? 'code';

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative my-3 overflow-hidden rounded-lg border border-white/10">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-2">
        <span className="text-xs font-mono text-muted-foreground">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
        >
          {copied ? '✓ Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4">
        <code className={cn(className, 'block text-sm leading-relaxed')}>
          {children}
        </code>
      </pre>
    </div>
  );
});

// =============================================================================
// MessageContent Component
// =============================================================================

export interface MessageContentProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
  truncate?: boolean;
}

export const MessageContent = memo(function MessageContent({
  content,
  className,
  isStreaming = false,
  truncate = false,
}: MessageContentProps) {
  const processedContent = useMemo(() => processContent(content), [content]);

  const MAX_LENGTH = 600;
  const shouldTruncate = truncate && content.length > MAX_LENGTH;
  const displayContent = shouldTruncate
    ? content.slice(0, MAX_LENGTH) + '…'
    : processedContent;

  return (
    <div className={cn('relative', className)}>
      <div
        className="prose prose-invert max-w-none text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: displayContent }}
      />
      {isStreaming && content.length > 0 && (
        <span
          className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-green-500 align-middle"
          aria-hidden="true"
        />
      )}
    </div>
  );
});
```

- [ ] **Step 6: Verify build**

Run: `cd packages/core && pnpm lint`
Expected: PASS (only pre-existing warnings)

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/utils/message-types.ts packages/core/src/ui/chat/message-content.tsx
git commit -m "feat(core): refactor message-content to use simple Message type and renderLatex utility"
```

---

### Task 2: Refactor message-bubble.tsx to remove broken imports

**Files:**
- Modify: `packages/core/src/ui/chat/message-bubble.tsx`

**Context:** The current `message-bubble.tsx` imports from `@/components/infsh/agent/*` which don't exist. We need to rewrite it as a standalone component.

- [ ] **Step 1: Read the current message-bubble.tsx**

Read `packages/core/src/ui/chat/message-bubble.tsx` in full.

- [ ] **Step 2: Rewrite as a standalone component**

Replace the entire file with:

```tsx
// packages/core/src/ui/chat/message-bubble.tsx
'use client'

import React, { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  children: ReactNode;
  role?: 'user' | 'assistant' | 'system';
  className?: string;
}

export function MessageBubble({ children, role = 'assistant', className }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3 py-3',
        isUser ? 'flex-row-reverse' : 'flex-row',
        className
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-emerald-700 text-white"
          aria-hidden="true"
        >
          <svg width="14" height="14" viewBox="0 0 41 41" fill="none">
            <path
              d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835 9.964 9.964 0 0 0-6.239-3.4 10.079 10.079 0 0 0-10.692 4.958 9.964 9.964 0 0 0-6.65 3.484 10.079 10.079 0 0 0-2.566 11.038 9.964 9.964 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 6.243 3.4 10.078 10.078 0 0 0 10.693-4.559 9.965 9.965 0 0 0 6.65-3.485 10.079 10.079 0 0 0 2.561-11.037zM18z"
              fill="white"
            />
          </svg>
        </div>
      )}

      {/* Bubble */}
      <div
        className={cn(
          'max-w-[72%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'rounded-br-md bg-emerald-600 text-white'
            : 'rounded-bl-md bg-zinc-800 text-zinc-100 border border-white/10'
        )}
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd packages/core && pnpm lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/ui/chat/message-bubble.tsx
git commit -m "feat(core): refactor message-bubble as standalone component"
```

---

### Task 3: Update MessagesView.tsx to use core MessageContent and MessageBubble

**Files:**
- Modify: `apps/website/blocks/chat/components/MessagesView.tsx`

**Context:** After refactoring the core components, we now wire them into the website's `MessagesView`. This simplifies the rendering code significantly.

- [ ] **Step 1: Update imports**

Add to the imports in `MessagesView.tsx`:

```tsx
import { MessageContent } from '@treonstudio/bungas-core/ui/chat/message-content';
import { MessageBubble } from '@treonstudio/bungas-core/ui/chat/message-bubble';
import { renderLatex } from '@treonstudio/bungas-core/utils/latex';
```

- [ ] **Step 2: Replace UserMessage and AssistantMessage rendering**

Find the `UserMessage` component and replace its content rendering:

```tsx
{/* Replace raw text with MessageContent */}
<div style={{ maxWidth: '72%', color: '#ececec', borderRadius: '18px 18px 4px 18px', padding: '10px 16px', fontSize: 15, lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
  <MessageContent content={message.content} />
</div>
```

And in `AssistantMessage`, replace:

```tsx
{/* Replace custom MarkdownContent with MessageContent */}
<div style={{ color: '#ececec', fontSize: 15 }}>
  <MessageContent content={message.content} isStreaming={message.isStreaming && !message.content} />
  {message.isStreaming && message.content && (
    <span style={{
      display: 'inline-block', width: 2, height: 14,
      background: '#10a37f', marginLeft: 1, verticalAlign: 'middle',
      animation: 'blink 0.8s step-end infinite',
    }} />
  )}
</div>
```

Also remove the `extractText` function (lines 79-84) and `MarkdownContent` component (lines 86-117) from `MessagesView.tsx` since they are now handled by `MessageContent` in core.

- [ ] **Step 3: Verify build**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/website/blocks/chat/components/MessagesView.tsx
git commit -m "feat(chat): wire core MessageContent and MessageBubble into MessagesView"
```

---

### Task 4: Final Verification

- [ ] **Step 1: Run full check**

Run: `pnpm check`
Expected: PASS (0 errors)

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Run core lint**

Run: `cd packages/core && pnpm lint`
Expected: PASS