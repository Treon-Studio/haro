import { Effect } from "effect"
import { ISkillsRepository } from "./skills.repository"
import type { TSkill } from "./skills.types"
import { SkillCreationError, SkillFetchError, UnauthorizedError } from "./skills.errors"
import { query } from "@/lib/neon/client"
import { getCurrentUserId } from "@/lib/neon/session"

const mapSkillData = (data: any): TSkill => ({
  id: data.id,
  name: data.name,
  description: data.description,
  body: data.body,
  category: data.category,
  userId: data.user_id,
  companyId: data.company_id ?? null,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
})

export const makeNeonSkillsRepository = (
  context: any,
): ISkillsRepository["Type"] => ({
  createSkill: (name, description, body, category, companyId) =>
    Effect.tryPromise({
      try: async () => {
        let userId: string
        try {
          userId = await getCurrentUserId(context)
        } catch (error) {
          throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
        }

        const res = await query(
          `INSERT INTO skills (name, description, body, category, user_id, company_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [name, description, body, category, userId, companyId ?? null]
        )

        const data = res.rows[0]
        if (!data) throw new SkillCreationError({ message: "Gagal membuat skill" })

        return mapSkillData(data)
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof SkillCreationError) return err
        return new SkillCreationError({ message: err?.message || "Unknown error occurred" })
      },
    }),

  getSkills: (companyId) =>
    Effect.tryPromise({
      try: async () => {
        try {
          await getCurrentUserId(context)
        } catch (error) {
          throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
        }

        let res
        if (companyId) {
          res = await query(
            `SELECT * FROM skills WHERE company_id = $1 ORDER BY created_at DESC`,
            [companyId]
          )
        } else {
          res = await query(
            `SELECT * FROM skills WHERE company_id IS NULL ORDER BY created_at DESC`
          )
        }

        if (!res.rows) return []

        return res.rows.map(mapSkillData)
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof SkillFetchError) return err
        return new SkillFetchError({ message: err?.message || "Unknown error occurred" })
      },
    }),
})
