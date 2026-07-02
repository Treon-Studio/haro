import { Effect } from "effect"
import { IProfilesRepository } from "./profiles.repository"
import type { TProfile } from "./profiles.types"
import { ProfileFetchError, ProfileUpdateError, UnauthorizedError } from "./profiles.errors"
import { query } from "@/lib/neon/client"
import { getCurrentUserId } from "@/lib/neon/session"

const mapProfileData = (data: any): TProfile => ({
  userId: data.user_id,
  fullName: data.full_name,
  ageRange: data.age_range,
  gender: data.gender,
  pronouns: data.pronouns,
  phone: data.phone,
  language: data.language,
  notificationOptIn: data.notification_opt_in,
  department: data.department,
  onboardingCompletedAt: data.onboarding_completed_at,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
})

export const makeNeonProfilesRepository = (
  context: any,
): IProfilesRepository["Type"] => ({
  getProfile: () =>
    Effect.tryPromise({
      try: async () => {
        let userId: string
        try {
          userId = await getCurrentUserId(context)
        } catch (error) {
          throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
        }

        const res = await query(
          `SELECT * FROM profiles WHERE user_id = $1 LIMIT 1`,
          [userId]
        )

        const data = res.rows[0]
        if (!data) return null

        return mapProfileData(data)
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof ProfileFetchError) return err
        return new ProfileFetchError({ message: err?.message || "Unknown error occurred" })
      },
    }),

  updateProfile: (data) =>
    Effect.tryPromise({
      try: async () => {
        let userId: string
        try {
          userId = await getCurrentUserId(context)
        } catch (error) {
          throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
        }

        const upsertData: Record<string, any> = {
          user_id: userId,
          full_name: data.fullName,
          age_range: data.ageRange,
          gender: data.gender,
          pronouns: data.pronouns,
          phone: data.phone,
          language: data.language,
          notification_opt_in: data.notificationOptIn,
          department: data.department,
        }

        if (data.onboardingCompleted) {
          upsertData.onboarding_completed_at = new Date().toISOString()
        }

        // Remove undefined fields
        Object.keys(upsertData).forEach((key) => {
          if (upsertData[key] === undefined) {
            delete upsertData[key]
          }
        })

        // Build dynamic SQL for upsert based on provided fields
        const keys = Object.keys(upsertData)
        const values = Object.values(upsertData)
        
        const setClause = keys
          .filter(k => k !== 'user_id')
          .map((k, i) => `${k} = EXCLUDED.${k}`)
          .join(', ')

        const cols = keys.join(', ')
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')

        let sql = `INSERT INTO profiles (${cols}) VALUES (${placeholders})`
        
        if (setClause) {
          sql += ` ON CONFLICT (user_id) DO UPDATE SET ${setClause}, updated_at = NOW()`
        } else {
          sql += ` ON CONFLICT (user_id) DO NOTHING`
        }
        
        sql += ` RETURNING *`

        const res = await query(sql, values)
        const updated = res.rows[0]

        if (!updated) throw new ProfileUpdateError({ message: "Gagal memperbarui profil" })

        return mapProfileData(updated)
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof ProfileUpdateError) return err
        return new ProfileUpdateError({ message: err?.message || "Unknown error occurred" })
      },
    }),
})
