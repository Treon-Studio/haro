import { Effect } from "effect"
import { ISuperAdminOpsRepository } from "./super-admin-ops.repository"
import type { TFeatureFlag, TPlatformStatus } from "./super-admin-ops.types"
import { OpsFetchError, OpsUpdateError, UnauthorizedError } from "./super-admin-ops.errors"
import { query } from "@/lib/neon/client"
import { getCurrentUserId } from "@/lib/neon/session"

const mapFlagData = (data: any): TFeatureFlag => ({
  companyId: data.company_id,
  flag: data.flag,
  enabled: data.enabled,
  config: data.config || {},
  updatedAt: data.updated_at,
})

const mapStatusData = (data: any): TPlatformStatus => ({
  id: data.id,
  message: data.message,
  isActive: data.is_active,
  severity: data.severity as "info" | "warning" | "critical",
  expectedResolution: data.expected_resolution,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
})

const verifySuperAdminRole = async (userId: string): Promise<void> => {
  const res = await query(
    `SELECT id FROM public.company_memberships WHERE user_id = $1 AND role = 'super_admin' AND status = 'active' LIMIT 1`,
    [userId]
  )
  if (!res.rows || res.rows.length === 0) {
    throw new UnauthorizedError({ message: "Anda tidak memiliki akses Super Admin" })
  }
}

export const makeNeonSuperAdminOpsRepository = (
  context: any,
): ISuperAdminOpsRepository["Type"] => ({
  getFeatureFlags: (companyId) =>
    Effect.tryPromise({
      try: async () => {
        let userId: string
        try {
          userId = await getCurrentUserId(context)
        } catch (error) {
          throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
        }

        await verifySuperAdminRole(userId)

        const res = await query(
          `SELECT * FROM public.tenant_feature_flags WHERE company_id = $1`,
          [companyId]
        )

        if (!res.rows) return []

        return res.rows.map(mapFlagData)
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof OpsFetchError) return err
        return new OpsFetchError({ message: err?.message || "Unknown error" })
      },
    }),

  updateFeatureFlag: (companyId, flag, enabled) =>
    Effect.tryPromise({
      try: async () => {
        let userId: string
        try {
          userId = await getCurrentUserId(context)
        } catch (error) {
          throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
        }

        await verifySuperAdminRole(userId)

        const res = await query(
          `INSERT INTO public.tenant_feature_flags (company_id, flag, enabled)
           VALUES ($1, $2, $3)
           ON CONFLICT (company_id, flag) DO UPDATE SET enabled = $3, updated_at = NOW()
           RETURNING *`,
          [companyId, flag, enabled]
        )

        const data = res.rows[0]
        if (!data) throw new OpsUpdateError({ message: "Failed to update flag" })

        return mapFlagData(data)
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof OpsUpdateError) return err
        return new OpsUpdateError({ message: err?.message || "Unknown error" })
      },
    }),

  getPlatformStatus: () =>
    Effect.tryPromise({
      try: async () => {
        const res = await query(
          `SELECT * FROM public.platform_status WHERE is_active = true ORDER BY created_at DESC LIMIT 1`
        )

        if (!res.rows || res.rows.length === 0) return null

        return mapStatusData(res.rows[0])
      },
      catch: (err: any) => {
        if (err instanceof OpsFetchError) return err
        return new OpsFetchError({ message: err?.message || "Unknown error" })
      },
    }),

  updatePlatformStatus: (message, isActive, severity, expectedResolution) =>
    Effect.tryPromise({
      try: async () => {
        let userId: string
        try {
          userId = await getCurrentUserId(context)
        } catch (error) {
          throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
        }

        await verifySuperAdminRole(userId)

        // Disable old statuses
        await query(
          `UPDATE public.platform_status SET is_active = false WHERE is_active = true`
        )

        const res = await query(
          `INSERT INTO public.platform_status (message, is_active, severity, expected_resolution)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [message, isActive, severity, expectedResolution || null]
        )

        const data = res.rows[0]
        if (!data) throw new OpsUpdateError({ message: "Failed to update status" })

        return mapStatusData(data)
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof OpsUpdateError) return err
        return new OpsUpdateError({ message: err?.message || "Unknown error" })
      },
    }),
})
