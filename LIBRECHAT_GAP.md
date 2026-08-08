# LibreChat → Tenang Gap Analysis

## Architecture Overview

| Aspect | LibreChat | Tenang |
|---|---|---|
| Packages | `@librechat/client` + `@librechat/data-schemas` + `librechat-data-provider` + `@librechat/api` | `@treonstudio/bungas-core` (core) + `@treonstudio/website` (Astro) |
| UI Layer | Radix UI primitives + Tailwind CSS | Basic shadcn-style primitives (button, input, dialog, avatar, etc.) |
| State | Recoil atoms + Jotai atoms + React Query | None |
| Hooks | 15+ custom hooks (SSE, auth, chat, files, agents, MCP) | None |
| Utils | Markdown, LaTeX, citations, tree-build, HEIC, tokens | `cn()` class merge only |
| i18n | Full locales system | None |
| Backend | Full Node.js API with multi-LLM, MCP, streaming, RBAC | Astro SSR → Cloudflare Workers |

---

## 1. UI Primitives

LibreChat has ~30 Radix-based components. Tenang has 17 basic ones. Missing:

### Input variants
- InputOTP
- InputNumber
- InputCombobox
- ControlCombobox

### Dropdown variants
- SelectDropDown
- DropdownMenu
- DropdownPopup
- DropdownNoState

### Data components
- DataTable
- Pagination
- Progress
- Skeleton
- Tag
- Badge

### Layout
- Accordion
- Collapsible
- Resizable
- AnimatedTabs
- Breadcrumb
- Separator

### Navigation
- AlertDialog
- OriginalDialog

### Specialty
- ThemeSelector
- PixelCard
- DelayedRender

---

## 2. Chat Components

Tenang has a `ui/chat/` folder with 10 components, but they are **incomplete** — no:

- Markdown rendering pipeline
- Code block syntax highlighting
- LaTeX/KaTeX rendering
- Citation footnotes
- Streaming UI
- Reasoning step display

---

## 3. Utils / Helpers

Tenang has only `cn()`. Missing:

- Markdown parser (marked/highlight.js)
- LaTeX → KaTeX rendering
- Citation extractor
- Token cost estimator
- Hierarchical message tree builder
- Draft auto-save to localStorage
- HEIC → JPEG converter

---

## N/A (LibreChat-specific — not needed for Tenang)

These exist in LibreChat but are irrelevant to a marketing site:

- Agents system (marketplace, skill builder, MCP server manager)
- Auth system (JWT, OAuth, 2FA, OIDC, PKCE)
- File processing (OCR, audio transcription, video encoding, LibreOffice conversion, RAG embeddings, retention sweep)
- SSE streaming (real-time generation via Redis/Server-Sent Events)
- MCP integration (Model Context Protocol connections, OAuth, tool registry)
- Data-provider / React Query (API layer — irrelevant for static/marketing)
- Mongoose schemas (User, Conversation, Message, Agent, Transaction, etc.)
- RBAC / permissions (RoleBits, PermissionBits, ACL entries)
- Multi-LLM providers (OpenAI, Anthropic, Google, Azure, Bedrock, Vertex, Ollama)
- Cache layer (Redis, Keyv, rate limiters)
- Storage (S3, CloudFront, Azure Blob, Firebase)
- Observability (Langfuse tracing, RUM/HyperDX, OpenTelemetry)
- Custom hooks for SSE, chat, files, agents, MCP
- Recoil/Jotai state atoms for conversation, settings, submission, artifacts