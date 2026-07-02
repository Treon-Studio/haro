import { Effect } from "effect"
import { IBillingRepository } from "./billing.repository"
import type { TBillingInfo } from "./billing.types"
import { BillingFetchError, BillingUpdateError } from "./billing.errors"
import { query, transaction } from "@/lib/neon/client"

const mapBillingData = (data: any): TBillingInfo => {
  const quota = data.session_quota
  const used = data.sessions_used
  const isExceeded = used >= quota
  let warningLevel: "none" | "warning" | "critical" | "exceeded" = "none"

  if (isExceeded) warningLevel = "exceeded"
  else if (used >= quota * 0.95) warningLevel = "critical"
  else if (used >= quota * 0.8) warningLevel = "warning"

  return {
    companyId: data.id,
    sessionQuota: quota,
    sessionsUsed: used,
    isQuotaExceeded: isExceeded,
    warningLevel,
  }
}

export const makeNeonBillingRepository = (
  context: any,
): IBillingRepository["Type"] => ({
  getBillingInfo: (companyId) =>
    Effect.tryPromise({
      try: async () => {
        const res = await query(
          `SELECT id, session_quota, sessions_used FROM public.companies WHERE id = $1`,
          [companyId]
        )

        const row = res.rows[0]
        if (!row) throw new BillingFetchError({ message: "Organisasi tidak ditemukan" })
        
        return mapBillingData(row)
      },
      catch: (err: any) => {
        if (err instanceof BillingFetchError) return err
        return new BillingFetchError({ message: err?.message || "Unknown error" })
      },
    }),

  incrementSessionUsage: (companyId) =>
    Effect.tryPromise({
      try: async () => {
        const updated = await transaction(async (client) => {
          // Fetch current
          const currentRes = await client.query(
            `SELECT sessions_used FROM public.companies WHERE id = $1`,
            [companyId]
          )
          const current = currentRes.rows[0]
          if (!current) throw new BillingUpdateError({ message: "Gagal memuat status kuota" })

          // Update
          const updateRes = await client.query(
            `UPDATE public.companies SET sessions_used = sessions_used + 1 WHERE id = $1 RETURNING id, session_quota, sessions_used`,
            [companyId]
          )
          
          const data = updateRes.rows[0]
          if (!data) throw new BillingUpdateError({ message: "Gagal mengupdate pemakaian kuota" })
          
          return data
        })

        return mapBillingData(updated)
      },
      catch: (err: any) => {
        if (err instanceof BillingUpdateError) return err
        return new BillingUpdateError({ message: err?.message || "Unknown error" })
      },
    }),
})
