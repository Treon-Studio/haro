import { Effect } from "effect"
import { IAnalyticsRepository } from "./analytics.repository"
import { AnalyticsFetchError } from "./analytics.errors"
import { query } from "@/lib/neon/client"

export const makeNeonAnalyticsRepository = (
  context: any,
): IAnalyticsRepository["Type"] => ({
  getCompanyMemberCount: (companyId) =>
    Effect.tryPromise({
      try: async () => {
        const res = await query(
          `SELECT COUNT(*) as count FROM public.company_memberships WHERE company_id = $1 AND status = 'active'`,
          [companyId],
        )
        return parseInt(res.rows[0]?.count || "0", 10)
      },
      catch: (err: any) => {
        if (err instanceof AnalyticsFetchError) return err
        return new AnalyticsFetchError({ message: err?.message || "Unknown error" })
      },
    }),

  getDailyActiveUsers: (companyId, limitDays) =>
    Effect.tryPromise({
      try: async () => {
        const res = await query(
          `SELECT DATE(created_at) as date, COUNT(DISTINCT user_id) as active_users
           FROM public.session_metrics
           WHERE company_id = $1
           GROUP BY DATE(created_at)
           ORDER BY date DESC
           LIMIT $2`,
          [companyId, limitDays],
        )

        if (!res.rows) return []

        return res.rows.map((row) => {
          let dateStr = ""
          if (row.date instanceof Date) {
            dateStr = row.date.toISOString().split("T")[0]
          } else if (typeof row.date === "string") {
            dateStr = row.date.split("T")[0]
          } else {
            dateStr = new Date(row.date).toISOString().split("T")[0]
          }
          return {
            date: dateStr,
            active_users: parseInt(row.active_users, 10),
          }
        })
      },
      catch: (err: any) => {
        if (err instanceof AnalyticsFetchError) return err
        return new AnalyticsFetchError({ message: err?.message || "Unknown error" })
      },
    }),

  getTotalSessionsCount: (companyId, limitDays) =>
    Effect.tryPromise({
      try: async () => {
        const res = await query(
          `SELECT COUNT(*) as count FROM public.session_metrics WHERE company_id = $1`,
          [companyId],
        )
        return parseInt(res.rows[0]?.count || "0", 10)
      },
      catch: (err: any) => {
        if (err instanceof AnalyticsFetchError) return err
        return new AnalyticsFetchError({ message: err?.message || "Unknown error" })
      },
    }),
})
