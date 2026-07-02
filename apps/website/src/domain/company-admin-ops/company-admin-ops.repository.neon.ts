import { Effect } from "effect"
import { ICompanyAdminOpsRepository } from "./company-admin-ops.repository"
import type { TSupportTicket } from "./company-admin-ops.types"
import { AdminOpsFetchError, AdminOpsUpdateError, UnauthorizedError } from "./company-admin-ops.errors"
import { query } from "@/lib/neon/client"
import { getCurrentUserId } from "@/lib/neon/session"

const mapTicketData = (data: any): TSupportTicket => ({
  id: data.id,
  companyId: data.company_id,
  subject: data.subject,
  description: data.description,
  priority: data.priority as "low" | "medium" | "high",
  status: data.status as "open" | "in_progress" | "resolved" | "closed",
  createdAt: data.created_at,
  updatedAt: data.updated_at,
})

const verifyCompanyAdminRole = async (userId: string, companyId: string): Promise<void> => {
  const res = await query(
    `SELECT id FROM public.company_memberships WHERE user_id = $1 AND company_id = $2 AND role = 'admin' AND status = 'active' LIMIT 1`,
    [userId, companyId]
  )
  if (!res.rows || res.rows.length === 0) {
    throw new UnauthorizedError({ message: "Anda tidak memiliki akses Admin di perusahaan ini" })
  }
}

export const makeNeonCompanyAdminOpsRepository = (
  context: any,
): ICompanyAdminOpsRepository["Type"] => ({
  getActivityLogs: (companyId) =>
    Effect.tryPromise({
      try: async () => {
        let userId: string
        try {
          userId = await getCurrentUserId(context)
        } catch (error) {
          throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
        }

        await verifyCompanyAdminRole(userId, companyId)

        const res = await query(
          `SELECT * FROM public.audit_log WHERE company_id = $1 ORDER BY timestamp DESC`,
          [companyId]
        )

        return res.rows || []
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof AdminOpsFetchError) return err
        return new AdminOpsFetchError({ message: err?.message || "Unknown error" })
      },
    }),

  createSupportTicket: (companyId, subject, description, priority) =>
    Effect.tryPromise({
      try: async () => {
        let userId: string
        try {
          userId = await getCurrentUserId(context)
        } catch (error) {
          throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
        }

        await verifyCompanyAdminRole(userId, companyId)

        const res = await query(
          `INSERT INTO public.support_tickets (company_id, subject, description, priority)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [companyId, subject, description, priority]
        )

        const data = res.rows[0]
        if (!data) throw new AdminOpsUpdateError({ message: "Failed to create ticket" })

        return mapTicketData(data)
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof AdminOpsUpdateError) return err
        return new AdminOpsUpdateError({ message: err?.message || "Unknown error" })
      },
    }),

  getSupportTickets: (companyId) =>
    Effect.tryPromise({
      try: async () => {
        let userId: string
        try {
          userId = await getCurrentUserId(context)
        } catch (error) {
          throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
        }

        await verifyCompanyAdminRole(userId, companyId)

        const res = await query(
          `SELECT * FROM public.support_tickets WHERE company_id = $1 ORDER BY created_at DESC`,
          [companyId]
        )

        if (!res.rows) return []

        return res.rows.map(mapTicketData)
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof AdminOpsFetchError) return err
        return new AdminOpsFetchError({ message: err?.message || "Unknown error" })
      },
    }),
})
