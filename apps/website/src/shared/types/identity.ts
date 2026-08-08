import type { TUserId } from "./common.types"

/**
 * Resolved identity for a user within a tenant scope.
 *
 * Populated server-side from the JWT session payload
 * joined against the `company_memberships` table.
 * NOT embedded in the JWT.
 */
export type TTenantIdentity = {
  readonly userId: TUserId
  readonly tenantSlug: string
  readonly companyId?: string
  readonly role: string
}
