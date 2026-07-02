import { Effect } from "effect"
import { IBrandingRepository } from "./branding.repository"
import type { TBranding } from "./branding.types"
import { BrandingFetchError, BrandingUpdateError, UnauthorizedError } from "./branding.errors"
import { query } from "@/lib/neon/client"
import { getCurrentUserId } from "@/lib/neon/session"

const mapBrandingData = (data: any): TBranding => ({
  companyId: data.company_id,
  logoUrl: data.logo_url,
  primaryColor: data.primary_color,
  welcomeMessage: data.welcome_message,
  defaultLanguage: data.default_language as "id" | "en",
  notificationSettings: data.notification_settings || {},
  updatedAt: data.updated_at,
  updatedBy: data.updated_by,
})

export const makeNeonBrandingRepository = (
  context: any,
): IBrandingRepository["Type"] => ({
  getBranding: (companyId) =>
    Effect.tryPromise({
      try: async () => {
        let userId: string
        try {
          userId = await getCurrentUserId(context)
        } catch {
          throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
        }
        void userId // auth check only

        const res = await query(
          `SELECT * FROM public.company_branding WHERE company_id = $1`,
          [companyId],
        )

        const row = res.rows[0]
        if (!row) return null

        return mapBrandingData(row)
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof BrandingFetchError) return err
        return new BrandingFetchError({ message: err?.message || "Unknown error occurred" })
      },
    }),

  updateBranding: (companyId, data) =>
    Effect.tryPromise({
      try: async () => {
        let userId: string
        try {
          userId = await getCurrentUserId(context)
        } catch {
          throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
        }

        const now = new Date().toISOString()
        const res = await query(
          `INSERT INTO public.company_branding (company_id, logo_url, primary_color, welcome_message, default_language, notification_settings, updated_by, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (company_id) DO UPDATE SET
             logo_url = $2,
             primary_color = $3,
             welcome_message = $4,
             default_language = $5,
             notification_settings = $6,
             updated_by = $7,
             updated_at = $8
           RETURNING *`,
          [
            companyId,
            data.logoUrl ?? null,
            data.primaryColor ?? null,
            data.welcomeMessage ?? null,
            data.defaultLanguage ?? "id",
            data.notificationSettings ?? {},
            userId,
            now,
          ],
        )

        const row = res.rows[0]
        if (!row) throw new BrandingUpdateError({ message: "Gagal memperbarui branding" })

        return mapBrandingData(row)
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof BrandingUpdateError) return err
        return new BrandingUpdateError({ message: err?.message || "Unknown error occurred" })
      },
    }),
})
