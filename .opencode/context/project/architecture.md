<architecture_outline>
- **API**: Hono + Cloudflare Workers + D1 SQLite (Drizzle ORM).
- **Web**: Astro 5 (SSR) + React 19 islands + TailwindCSS 4. Deployed to Cloudflare.
- **Mobile**: Expo 54 + React Native 0.81 + Expo Router.
- **State**: Zustand 5 (client) + React Query 5 (server).
- **API Client**: `Adapter (fetch/axios) -> HttpClient -> ApiServices -> React Query Hooks`
</architecture_outline>
