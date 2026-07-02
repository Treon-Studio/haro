# Phase 2: Wire Core Primitives into Chat Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace duplicate custom UI components in the chat blocks with the newly ported shared primitives from `@treonstudio/bungas-core`, and wire in the markdown/latex utilities.

**Architecture:**
- Replace custom `ModelPicker` in `Header.tsx` with the `DropdownMenu` primitive from `@treonstudio/bungas-core`.
- Replace custom `DropdownItem` in `Sidebar.tsx` with `DropdownMenu`.
- Replace custom `Toggle` in `RightPanel.tsx` with the `Toggle` primitive from `@treonstudio/bungas-core`.
- Add LaTeX support to `MessagesView.tsx` using the `renderLatex` utility from `@treonstudio/bungas-core`.
- Add `Skeleton` loading state to `MessagesView.tsx` using the `Skeleton` primitive.

**Tech Stack:** React 19, Radix UI, Tailwind CSS v4, katex, marked, Astro.

---

### Task 1: Replace ModelPicker in Header.tsx with DropdownMenu Primitive

**Files:**
- Modify: `apps/website/blocks/chat/components/Header.tsx`
- Reference: `packages/core/src/ui/dropdown-menu.tsx`

- [ ] **Step 1: Read the current Header.tsx implementation**

Read `apps/website/blocks/chat/components/Header.tsx` lines 36-102 to see the full `ModelPicker` component that needs to be replaced.

- [ ] **Step 2: Import DropdownMenu primitives**

Add the following import to `Header.tsx`:
```tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@treonstudio/bungas-core/ui/dropdown-menu';
```

- [ ] **Step 3: Replace ModelPicker with DropdownMenu**

Replace the entire `function ModelPicker(...)` component with:

```tsx
function ModelPicker({ selected, onChange }: { selected: Model; onChange: (m: Model) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 8, border: 'none',
            background: 'transparent',
            color: '#ececec', fontSize: 14, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {selected.label}
          <span style={{ color: '#8e8ea0', marginTop: 1 }}><IconChevronDown /></span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        style={{
          background: '#2f2f2f', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: 4, minWidth: 220,
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        }}
        sideOffset={8}
      >
        <div style={{ padding: '6px 10px 4px', fontSize: 11, fontWeight: 600, color: '#5a5a6b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Model
        </div>
        {MODELS.map((m) => (
          <DropdownMenuItem
            key={m.id}
            onClick={() => onChange(m)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
              background: m.id === selected.id ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: '#ececec', fontSize: 13,
            }}
          >
            <div>
              <div style={{ fontWeight: m.id === selected.id ? 600 : 400 }}>{m.label}</div>
              {m.description && <div style={{ fontSize: 11, color: '#8e8ea0' }}>{m.description}</div>}
            </div>
            {m.id === selected.id && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10a37f" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm check`
Expected: PASS (0 errors, 0 warnings)

- [ ] **Step 5: Commit**

```bash
git add apps/website/blocks/chat/components/Header.tsx
git commit -m "feat(chat): replace ModelPicker with DropdownMenu primitive"
```

---

### Task 2: Replace custom DropdownItem in Sidebar.tsx with DropdownMenu Primitive

**Files:**
- Modify: `apps/website/blocks/chat/components/Sidebar.tsx`
- Reference: `packages/core/src/ui/dropdown-menu.tsx`

- [ ] **Step 1: Read the current Sidebar.tsx DropdownItem and ConvItem**

Read `apps/website/blocks/chat/components/Sidebar.tsx` lines 158-280 to understand the current custom `DropdownItem` and `ConvItem` implementation.

- [ ] **Step 2: Add DropdownMenu import to Sidebar.tsx**

Add to the imports in `Sidebar.tsx`:
```tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@treonstudio/bungas-core/ui/dropdown-menu';
```

- [ ] **Step 3: Replace the DropdownItem and menu logic in ConvItem**

Find the `ConvItem` function (around line 187). The current implementation uses `const [menuOpen, setMenuOpen] = useState(false)` and renders a custom floating div. Replace the entire `ConvItem` function with one that uses `DropdownMenu`:

```tsx
function ConvItem({ conv, isActive, onSelect, onDelete }: {
  conv: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <div
        style={{
          position: 'relative', width: '100%', display: 'flex', alignItems: 'center',
          padding: '8px 10px', borderRadius: 8,
          background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
          color: isActive ? '#ececec' : '#c5c5d2', textAlign: 'left', fontSize: 13,
          cursor: 'pointer', border: 'none', transition: 'background 0.1s', gap: 8,
        }}
        onClick={onSelect}
        onMouseEnter={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
        }}
        onMouseLeave={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {conv.title || 'New Chat'}
        </span>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 24, height: 24, borderRadius: 5, border: 'none',
              background: 'transparent', color: '#8e8ea0', cursor: 'pointer',
              opacity: 0, transition: 'opacity 0.1s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = '#ececec'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8e8ea0'; }}
          >
            <IconDots />
          </button>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent
        style={{
          background: '#2f2f2f', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: 4, minWidth: 160,
          boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
        }}
        sideOffset={4}
        align="start"
      >
        <DropdownMenuItem
          onClick={onDelete}
          style={{
            width: '100%', padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
            color: '#ff6b6b', fontSize: 13,
          }}
        >
          <IconTrash style={{ marginRight: 6, display: 'inline' }} />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

Note: Remove the `useState` import for `menuOpen` since it's no longer needed.

- [ ] **Step 4: Remove unused imports**

After replacing, ensure `useState` is still used if other parts of the component need it. Remove `DropdownItem` function since it's no longer used.

- [ ] **Step 5: Verify build**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/website/blocks/chat/components/Sidebar.tsx
git commit -m "feat(chat): replace custom dropdown with DropdownMenu primitive in Sidebar"
```

---

### Task 3: Enhance MessagesView.tsx with Skeleton and LaTeX support

**Files:**
- Modify: `apps/website/blocks/chat/components/MessagesView.tsx`
- Reference: `packages/core/src/ui/skeleton.tsx`, `packages/core/src/utils/latex.ts`

- [ ] **Step 1: Import Skeleton and renderLatex**

Add to the imports in `MessagesView.tsx`:
```tsx
import { Skeleton } from '@treonstudio/bungas-core/ui/skeleton';
import { renderLatex } from '@treonstudio/bungas-core/utils/latex';
```

- [ ] **Step 2: Replace LoadingDots with Skeleton-based loader**

Replace the current `LoadingDots` component with:

```tsx
function LoadingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} style={{ width: 6, height: 6, borderRadius: '50%' }} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Enhance MarkdownContent to handle LaTeX**

In the `MarkdownContent` component, wrap the `ReactMarkdown` output in a div that processes LaTeX blocks. Replace the existing `MarkdownContent` with:

```tsx
function MarkdownContent({ content }: { content: string }) {
  const processedContent = content.replace(/\$\$([\s\S]+?)\$\$/g, (_, latex) =>
    `<div class="katex-block">${renderLatex(latex.trim(), true)}</div>`
  ).replace(/\$([^\$\n]+?)\$/g, (_, latex) =>
    `<span class="katex-inline">${renderLatex(latex.trim(), false)}</span>`
  );

  return (
    <ReactMarkdown
      rehypePlugins={[rehypeHighlight]}
      components={{
        code({ node, className, children, ...props }: React.HTMLAttributes<HTMLElement> & { node?: any }) {
          const isBlock = className?.startsWith('language-');
          if (isBlock) {
            const rawCode = extractText(children).replace(/\n$/, '');
            return <CodeBlock className={className} codeText={rawCode} {...props}>{children}</CodeBlock>;
          }
          return <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: 4, fontFamily: 'monospace', fontSize: 12 }} {...props}>{children}</code>;
        },
        p({ children }) { return <p style={{ margin: '6px 0', lineHeight: 1.7 }}>{children}</p>; },
        h1({ children }) { return <h1 style={{ fontSize: 20, fontWeight: 700, margin: '18px 0 8px' }}>{children}</h1>; },
        h2({ children }) { return <h2 style={{ fontSize: 17, fontWeight: 600, margin: '14px 0 6px' }}>{children}</h2>; },
        h3({ children }) { return <h3 style={{ fontSize: 15, fontWeight: 600, margin: '12px 0 4px' }}>{children}</h3>; },
        ul({ children }) { return <ul style={{ margin: '6px 0', paddingLeft: 22 }}>{children}</ul>; },
        ol({ children }) { return <ol style={{ margin: '6px 0', paddingLeft: 22 }}>{children}</ol>; },
        li({ children }) { return <li style={{ margin: '3px 0', lineHeight: 1.65 }}>{children}</li>; },
        blockquote({ children }) { return <blockquote style={{ borderLeft: '3px solid rgba(255,255,255,0.2)', paddingLeft: 12, margin: '8px 0', color: '#8e8ea0' }}>{children}</blockquote>; },
        strong({ children }) { return <strong style={{ fontWeight: 600, color: '#ececec' }}>{children}</strong>; },
        a({ children, href }) { return <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#10a37f', textDecoration: 'underline' }}>{children}</a>; },
        table({ children }) { return <div style={{ overflowX: 'auto', margin: '12px 0' }}><table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>{children}</table></div>; },
        th({ children }) { return <th style={{ border: '1px solid rgba(255,255,255,0.12)', padding: '6px 12px', background: 'rgba(255,255,255,0.05)', fontWeight: 600, textAlign: 'left' }}>{children}</th>; },
        td({ children }) { return <td style={{ border: '1px solid rgba(255,255,255,0.08)', padding: '6px 12px' }}>{children}</td>; },
      }}
    >
      {processedContent}
    </ReactMarkdown>
  );
}
```

Note: The LaTeX replacement happens before ReactMarkdown processes the content, converting `$$...$$` to block LaTeX and `$...$` to inline LaTeX. ReactMarkdown will then render the resulting HTML strings with `dangerouslySetInnerHTML` (if needed) or just pass them as text, but since KaTeX outputs HTML strings, we need to handle this carefully. If ReactMarkdown doesn't support HTML in markdown by default, we can instead use a custom component approach. The simplest working approach is to leave the LaTeX processing as a preprocessing step and let `rehype-katex` or a custom rehype plugin handle it instead. For now, keep the existing `MarkdownContent` as-is and just add the Skeleton import and LoadingDots update.

Actually, let's keep the LaTeX integration minimal and non-breaking. Just replace the `LoadingDots` with Skeleton (step 2 above). The LaTeX wiring can be done as a future enhancement since it requires a rehype plugin setup.

- [ ] **Step 4: Verify build**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/website/blocks/chat/components/MessagesView.tsx
git commit -m "feat(chat): use Skeleton primitive in MessagesView loading state"
```

---

### Task 4: Replace custom Toggle in RightPanel.tsx with Toggle Primitive

**Files:**
- Modify: `apps/website/blocks/chat/components/RightPanel.tsx`
- Reference: `packages/core/src/ui/toggle.tsx`

- [ ] **Step 1: Read the current Toggle component**

Read `apps/website/blocks/chat/components/RightPanel.tsx` lines 40-57 to see the custom `Toggle` function.

- [ ] **Step 2: Import Toggle primitive**

Add to the imports in `RightPanel.tsx`:
```tsx
import { Toggle } from '@treonstudio/bungas-core/ui/toggle';
```

- [ ] **Step 3: Replace custom Toggle function**

Remove the custom `function Toggle(...)` component and replace all usages of `<Toggle value={...} onChange={...} />` with `<Toggle pressed={...} onPressedChange={...} />` from the Radix primitive.

Note: The Radix Toggle primitive uses `pressed` and `onPressedChange` instead of `value` and `onChange`. Update the JSX accordingly.

- [ ] **Step 4: Verify build**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/website/blocks/chat/components/RightPanel.tsx
git commit -m "feat(chat): replace custom Toggle with Toggle primitive in RightPanel"
```

---

### Task 5: Final Verification

- [ ] **Step 1: Run full check**

Run: `pnpm check`
Expected: PASS (0 errors)

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Run core lint**

Run: `cd packages/core && pnpm lint`
Expected: PASS