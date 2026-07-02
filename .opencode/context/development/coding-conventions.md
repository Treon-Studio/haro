<critical_conventions>
- **Package naming**: `@treonstudio/*` (no relative cross-package paths).
- **Icons**: `react-icons/io5` (Web) / `@expo/vector-icons` (Mobile).
- **API Responses**: Always `{ success: true, data }` or `{ success: false, error, code? }`.
- **Soft Deletes**: Only rooms use `deletedAt` (always filter `WHERE deletedAt IS NULL`).
- **IDs**: Always use `generateId()` (cuid2), never UUID.
- **DB Counters**: Update via SQL (`sql\`col + 1\``), never read-then-write (e.g. `occupiedRooms`).
- **Dates**: Always store dates as UTC ISO strings in the DB. Format to local timezone only on the client.
- **Environment Vars**: Use `EXPO_PUBLIC_` for Mobile, `PUBLIC_` for Web. NEVER commit secrets.
- **Middleware Order**: `auth() → workspaceScope() → featureGate() → rbac()`.
</critical_conventions>
