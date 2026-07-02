# Reasoning, Citations, and ChatForm Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port reasoning block rendering (`<think>` blocks) and citation footnotes support from LibreChat into Tenang's core chat components, wire them into the website's message view, and refactor the chat entry form with modern Tailwind CSS classes and core primitives.

**Architecture:**
- Extract reasoning content bounded by `<think>...</think>` tags from messages, rendering it in a collapsible container with generating indicators.
- Parse citations (e.g. `[1]`, `[^1]`) within the message content and render interactive, hoverable source links/badges.
- Update `MessagesView.tsx` to integrate these new render pipelines.
- Modernize `ChatForm.tsx` by replacing inline styles and custom Tooltips with Tailwind classes and core UI primitives.

**Tech Stack:** React 19, Tailwind CSS v4, Lucide React, Radix UI.

---

### Task 1: Create MessageReasoning Component in Core

**Files:**
- Create: `packages/core/src/ui/chat/message-reasoning.tsx`

- [ ] **Step 1: Write the MessageReasoning implementation**

Write `packages/core/src/ui/chat/message-reasoning.tsx` as a collapsible, styled box with a spinner when active.

```tsx
'use client'

import React, { memo, useState } from 'react';
import { ChevronDown, ChevronRight, HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MessageReasoningProps {
  reasoning: string;
  isReasoning?: boolean;
  className?: string;
}

export const MessageReasoning = memo(function MessageReasoning({
  reasoning,
  isReasoning = false,
  className,
}: MessageReasoningProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!reasoning.trim()) return null;

  return (
    <div className={cn('my-3 rounded-lg border border-white/10 bg-white/5 overflow-hidden', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isReasoning ? (
            <div className="h-3 w-3 animate-spin rounded-full border border-zinc-400 border-t-transparent" />
          ) : (
            <HelpCircle className="h-3.5 w-3.5" />
          )}
          <span>{isReasoning ? 'Thinking...' : 'Thought process'}</span>
        </div>
        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      
      {isOpen && (
        <div className="border-t border-white/10 px-3 py-2 bg-black/20">
          <div className="whitespace-pre-wrap text-xs text-zinc-300 leading-relaxed font-mono max-h-60 overflow-y-auto">
            {reasoning}
          </div>
        </div>
      )}
    </div>
  );
});

MessageReasoning.displayName = 'MessageReasoning';
```

- [ ] **Step 2: Verify compiling and types**

Run: `cd packages/core && pnpm build`
Expected: Success.

---

### Task 2: Update message-content.tsx to Parse and Extract Reasoning and Citations

**Files:**
- Modify: `packages/core/src/ui/chat/message-content.tsx`

- [ ] **Step 1: Read current message-content.tsx**

Verify code paths of `packages/core/src/ui/chat/message-content.tsx`.

- [ ] **Step 2: Add reasoning extraction and citation parsing**

Rewrite `packages/core/src/ui/chat/message-content.tsx` to:
1. Parse and extract `<think>...</think>` content to pass to `MessageReasoning`.
2. Extract citation footnotes like `[1]`, `[^1]`, and map them to interactive footnotes below the message.

```tsx
'use client'

import { memo, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import { renderLatex } from '../../utils/latex';
import { parseMarkdown } from '../../utils/markdown';
import { MessageReasoning } from './message-reasoning';
import { Link2 } from 'lucide-react';

// Pre-process math and links before rendering markdown
function processContent(content: string): string {
  // Strip <think> tags from text content since they are rendered separately
  const cleanContent = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  return cleanContent
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, latex) =>
      `<div class="katex-block my-3">${renderLatex(latex.trim(), true)}</div>`
    )
    .replace(/\$([^\$\n]+?)\$/g, (_, latex) =>
      `<span class="katex-inline">${renderLatex(latex.trim(), false)}</span>`
    );
}

// Extract thinking content from <think>...</think> blocks
function extractReasoning(content: string): { reasoning: string; isReasoning: boolean } {
  const thinkMatch = content.match(/<think>([\s\S]*?)(<\/think>|$)/);
  if (!thinkMatch) return { reasoning: '', isReasoning: false };
  
  const reasoning = thinkMatch[1].trim();
  const isReasoning = !thinkMatch[0].endsWith('</think>');
  return { reasoning, isReasoning };
}

// Simple citation interface
export interface Citation {
  index: number;
  url: string;
  title: string;
}

export interface MessageContentProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
  truncate?: boolean;
  citations?: Citation[];
}

export const MessageContent = memo(function MessageContent({
  content,
  className,
  isStreaming = false,
  truncate = false,
  citations = [],
}: MessageContentProps) {
  const { reasoning, isReasoning } = useMemo(() => extractReasoning(content), [content]);
  const processedContent = useMemo(() => processContent(content), [content]);

  const MAX_LENGTH = 600;
  const shouldTruncate = truncate && content.length > MAX_LENGTH;
  const displayContent = shouldTruncate
    ? content.slice(0, MAX_LENGTH) + '…'
    : processedContent;

  const htmlContent = useMemo(() => {
    try {
      let parsed = parseMarkdown(displayContent);
      
      // Inject interactive citation link tags in-place of matches like [1] or [^1]
      citations.forEach((cit) => {
        const citationRegex = new RegExp(`\\[\\^?${cit.index}\\]`, 'g');
        parsed = parsed.replace(
          citationRegex,
          `<a href="${cit.url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold w-4 h-4 hover:bg-emerald-500/30 transition-colors mx-0.5" title="${cit.title}">${cit.index}</a>`
        );
      });
      return parsed;
    } catch (e) {
      console.error('Markdown parse error:', e);
      return displayContent;
    }
  }, [displayContent, citations]);

  return (
    <div className={cn('relative', className)}>
      {/* Reasoning block */}
      {reasoning && (
        <MessageReasoning reasoning={reasoning} isReasoning={isReasoning || isStreaming} />
      )}

      {/* Main message text */}
      {htmlContent && (
        <div
          className="prose prose-invert max-w-none text-sm leading-relaxed text-zinc-100"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      )}

      {/* Footnotes Panel */}
      {citations.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">Sources</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {citations.map((cit) => (
              <a
                key={cit.index}
                href={cit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-left"
              >
                <Link2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="overflow-hidden">
                  <p className="text-xs font-medium text-zinc-200 truncate">{cit.title}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{cit.url}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {isStreaming && content.length > 0 && !isReasoning && (
        <span
          className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-green-500 align-middle"
          aria-hidden="true"
        />
      )}
    </div>
  );
});
```

- [ ] **Step 3: Verify core package build**

Run: `cd packages/core && pnpm build`
Expected: Success.

---

### Task 3: Wire Citations into MessagesView in Website

**Files:**
- Modify: `apps/website/blocks/chat/components/MessagesView.tsx`
- Modify: `apps/website/blocks/chat/hooks/useChat.ts`

- [ ] **Step 1: Update Message model types in useChat.ts**

Extend the `Message` type in `apps/website/blocks/chat/hooks/useChat.ts` to support optional citations:

```typescript
export interface Citation {
  index: number;
  url: string;
  title: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
  attachments?: AttachedFile[];
  isStreaming?: boolean;
  error?: boolean;
  citations?: Citation[]; // Add citations support
}
```

- [ ] **Step 2: Read MessagesView.tsx to verify Message import and rendering**

Read `apps/website/blocks/chat/components/MessagesView.tsx` from line 90 to 200.

- [ ] **Step 3: Update MessagesView to pass citations to MessageContent**

Add the `citations` property to `MessageContent` usage in both `UserMessage` and `AssistantMessage` in `MessagesView.tsx`:

```tsx
<MessageContent content={message.content} citations={message.citations} />
```

---

### Task 4: Refactor ChatForm Component with Tailwind CSS v4 and Core Primitives

**Files:**
- Modify: `apps/website/blocks/chat/components/ChatForm.tsx`

- [ ] **Step 1: Read ChatForm.tsx completely**

Read `apps/website/blocks/chat/components/ChatForm.tsx` in full.

- [ ] **Step 2: Modernize ChatForm style with Tailwind CSS classes**

Replace manual styles with Tailwind v4 grid, border, shadow, and background classes. Use standard tailwind inputs and focus rings.

```tsx
'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@treonstudio/bungas-core/ui/tooltip';
import type { AttachedFile } from '../hooks/useChat';
import MentionPopover from './MentionPopover';
import CommandsPopover from './CommandsPopover';
import { Paperclip, Globe, Image, Send, Square, Mic, X } from 'lucide-react';

interface ChatFormProps {
  onSend: (text: string, files?: AttachedFile[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  placeholder?: string;
}

export default function ChatForm({
  onSend,
  onStop,
  isStreaming,
  placeholder = 'Message TenangAI',
}: ChatFormProps) {
  const [value, setValue] = useState('');
  const [webSearch, setWebSearch] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback((fileList: FileList | File[]) => {
    Array.from(fileList).forEach((file) => {
      const id = crypto.randomUUID();
      const base: AttachedFile = { id, name: file.name, size: file.size, type: file.type };
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setAttachments((prev) => [...prev, { ...base, dataUrl: e.target?.result as string }]);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachments((prev) => [...prev, base]);
      }
    });
  }, []);

  const handleSend = useCallback(() => {
    const text = value.trim();
    if ((!text && attachments.length === 0) || isStreaming) return;
    onSend(text, attachments);
    setValue('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [value, attachments, isStreaming, onSend]);

  return (
    <div className="relative mx-auto max-w-3xl px-4 pb-4">
      <div className="relative rounded-2xl border border-white/10 bg-zinc-900/50 p-2 shadow-2xl backdrop-blur-md focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all">
        
        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 border-b border-white/5 mb-2">
            {attachments.map((file) => (
              <div key={file.id} className="group relative flex items-center gap-2 rounded-lg bg-zinc-800 p-2 text-xs border border-white/5">
                {file.dataUrl ? (
                  <img src={file.dataUrl} alt={file.name} className="h-8 w-8 rounded object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-zinc-700 text-zinc-300 font-bold">DOC</div>
                )}
                <div className="max-w-[120px] truncate">
                  <p className="font-medium truncate text-zinc-200">{file.name}</p>
                </div>
                <button
                  onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== file.id))}
                  className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={placeholder}
          rows={1}
          className="w-full resize-none bg-transparent px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none max-h-56 min-h-[36px] leading-relaxed"
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between pt-2 px-1">
          <div className="flex items-center gap-1.5">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files && processFiles(e.target.files)}
              multiple
              className="hidden"
            />
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors"
                >
                  <Paperclip className="h-4.5 w-4.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Attach files</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setWebSearch(!webSearch)}
                  className={`flex h-8 items-center gap-1.5 px-2.5 rounded-lg text-xs font-medium transition-all ${
                    webSearch 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>Web Search</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Search the web</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-1.5">
            {isStreaming ? (
              <button
                onClick={onStop}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-colors"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!value.trim() && attachments.length === 0}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                  value.trim() || attachments.length > 0
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                    : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                }`}
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 5: Final Verification

- [ ] **Step 1: Check and Build**

Run: `pnpm check && pnpm build`
Expected: Success.

- [ ] **Step 2: Core lint**

Run: `cd packages/core && pnpm lint`
Expected: Success.
