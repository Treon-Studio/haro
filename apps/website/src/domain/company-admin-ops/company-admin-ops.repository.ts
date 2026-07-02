import { Context, Effect } from "effect"
import type { TSupportTicket } from "./company-admin-ops.types"
import { AdminOpsFetchError, AdminOpsUpdateError, UnauthorizedError } from "./company-admin-ops.errors"

export class ICompanyAdminOpsRepository extends Context.Tag("ICompanyAdminOpsRepository")<
  ICompanyAdminOpsRepository,
  {
    readonly getActivityLogs: (companyId: string) => Effect.Effect<readonly any[], AdminOpsFetchError | UnauthorizedError>
    readonly createSupportTicket: (companyId: string, subject: string, description: string, priority: "low" | "medium" | "high") => Effect.Effect<TSupportTicket, AdminOpsUpdateError | UnauthorizedError>
    readonly getSupportTickets: (companyId: string) => Effect.Effect<readonly TSupportTicket[], AdminOpsFetchError | UnauthorizedError>
  }
> () {}
