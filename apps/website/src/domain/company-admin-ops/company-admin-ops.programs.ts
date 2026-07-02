import { Effect, pipe } from "effect"
import { ICompanyAdminOpsRepository } from "./company-admin-ops.repository"
import { toSupportTicketDto } from "./company-admin-ops.types"
import type { TSupportTicketDto } from "./company-admin-ops.types"
import { AdminOpsFetchError, AdminOpsUpdateError, UnauthorizedError } from "./company-admin-ops.errors"

export type AdminOpsProgramError = AdminOpsFetchError | AdminOpsUpdateError | UnauthorizedError

export const getActivityLogsProgram = (
  companyId: string,
): Effect.Effect<readonly any[], AdminOpsProgramError, ICompanyAdminOpsRepository> =>
  pipe(
    ICompanyAdminOpsRepository,
    Effect.flatMap((repo) => repo.getActivityLogs(companyId)),
  )

export const createSupportTicketProgram = (
  companyId: string,
  subject: string,
  description: string,
  priority: "low" | "medium" | "high",
): Effect.Effect<TSupportTicketDto, AdminOpsProgramError, ICompanyAdminOpsRepository> =>
  pipe(
    ICompanyAdminOpsRepository,
    Effect.flatMap((repo) => repo.createSupportTicket(companyId, subject, description, priority)),
    Effect.map(toSupportTicketDto),
  )

export const getSupportTicketsProgram = (
  companyId: string,
): Effect.Effect<readonly TSupportTicketDto[], AdminOpsProgramError, ICompanyAdminOpsRepository> =>
  pipe(
    ICompanyAdminOpsRepository,
    Effect.flatMap((repo) => repo.getSupportTickets(companyId)),
    Effect.map((tickets) => tickets.map(toSupportTicketDto)),
  )
