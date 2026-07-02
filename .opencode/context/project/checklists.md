<checklists>
  <code_review_checklist>
  - [ ] **Scoping**: Did you filter Drizzle queries by `workspaceId`?
  - [ ] **RBAC**: Does the endpoint have the correct `rbac([...])` roles?
  - [ ] **Transactions**: Are multi-table inserts (like Lease CREATE) atomic?
  - [ ] **Performance**: Did you avoid N+1 queries in Drizzle (e.g., using relational queries)?
  - [ ] **Error Handling**: Are all custom errors thrown using the standard error response format?
  - [ ] **Formatting**: Does it pass `pnpm check`?
  </code_review_checklist>

  <documentation_sync_rules>
  When modifying code, you MUST update docs **in the same session** (surgical edits only, do not rewrite files).
  | Changed | Update Target |
  |---|---|
  | DB Schema / Enums | `docs/PRD.md` §3 |
  | Business Logic / Rules | `docs/PRD.md` §4 |
  | API Endpoints | `docs/PRD.md` §7 |
  | Middleware / Architecture | `docs/ARCHITECTURE.md` |
  </documentation_sync_rules>
</checklists>
