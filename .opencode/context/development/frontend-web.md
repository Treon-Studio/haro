<purpose>
This file defines the strict architectural and UI rules for the frontend web application (`apps/web`), which uses Astro, React 19 Islands, and TailwindCSS 4.
</purpose>

<astro_architecture_rules>
- **Static First**: Always prefer `.astro` components for static content and layout.
- **Islands Architecture**: Only use React (`.tsx`) components when user interactivity (`useState`, `useEffect`, DOM events) is explicitly required.
- **Client Directives**: When importing a React component into an Astro file, YOU MUST use the appropriate client directive (e.g., `client:load`, `client:idle`, `client:visible`).
- **Data Fetching**: Prefer fetching data server-side within the Astro component fence (`---`) rather than doing client-side fetches on mount.
- **Asset Optimization**: Always use Astro's native `<Image />` or `<Picture />` components for local images instead of standard `<img>` tags.
- **SEO**: Ensure every page injects correct SEO meta tags (title, description) via the main layout.
</astro_architecture_rules>

<tailwind_rules>
- **No `@apply`**: Do NOT use the `@apply` directive in CSS files. Use utility classes directly in the markup.
- **Mobile-First**: Always follow a mobile-first design approach using responsive modifiers (`sm:`, `md:`, `lg:`).
- **Organization**: Order classes logically (layout -> spacing -> sizing -> typography -> colors).
- **Defaults First**: MUST use Tailwind CSS defaults unless custom values already exist or are explicitly requested.
- **Class Logic**: MUST use `cn` utility (`clsx` + `tailwind-merge`) for conditional class logic.
</tailwind_rules>

<component_rules>
- MUST use accessible component primitives for anything with keyboard or focus behavior (Radix, Base UI, React Aria).
- MUST use the project's existing component primitives first — check `packages/ui/` before creating new ones.
- NEVER mix primitive systems within the same interaction surface.
- MUST add an `aria-label` to icon-only buttons.
- NEVER rebuild keyboard or focus behavior by hand unless explicitly requested.
</component_rules>

<interaction_rules>
- MUST use an `AlertDialog` for destructive or irreversible actions.
- SHOULD use structural skeletons for loading states.
- NEVER use `h-screen`, use `h-dvh`.
- MUST respect `safe-area-inset` for fixed elements.
- MUST show errors next to where the action happens.
- NEVER block paste in `input` or `textarea` elements.
</interaction_rules>

<animation_rules>
- NEVER add animation unless it is explicitly requested.
- MUST use `motion/react` when JavaScript animation is required.
- SHOULD use `tw-animate-css` for entrance and micro-animations.
- MUST animate only compositor props (`transform`, `opacity`).
- NEVER animate layout properties (`width`, `height`, `top`, `left`, `margin`, `padding`).
- SHOULD use `ease-out` on entrance.
- NEVER exceed `200ms` for interaction feedback.
- SHOULD respect `prefers-reduced-motion`.
- NEVER introduce custom easing curves unless explicitly requested.
</animation_rules>

<typography_rules>
- MUST use `text-balance` for headings and `text-pretty` for body/paragraphs.
- MUST use `tabular-nums` for data (billing amounts, room counts, etc.).
- SHOULD use `truncate` or `line-clamp` for dense UI.
- NEVER modify `letter-spacing` (`tracking-*`) unless explicitly requested.
</typography_rules>

<layout_rules>
- MUST use a fixed `z-index` scale (no arbitrary `z-*`).
- SHOULD use `size-*` for square elements instead of `w-*` + `h-*`.
</layout_rules>

<performance_rules>
- NEVER animate large `blur()` or `backdrop-filter` surfaces.
- NEVER apply `will-change` outside an active animation.
- NEVER use `useEffect` for anything that can be expressed as render logic.
</performance_rules>

<design_rules>
- NEVER use gradients unless explicitly requested.
- NEVER use glow effects as primary affordances.
- SHOULD use Tailwind CSS default shadow scale unless explicitly requested.
- MUST give empty states one clear next action.
- SHOULD limit accent color usage to one per view.
- SHOULD use existing theme or Tailwind CSS color tokens before introducing new ones.
</design_rules>
