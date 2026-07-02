import { Effect } from "effect"
import { IPromptsRepository } from "./prompts.repository"
import type { TPrompt } from "./prompts.types"
import { PromptCreationError, PromptFetchError, UnauthorizedError } from "./prompts.errors"
import { query } from "@/lib/neon/client"
import { getCurrentUserId } from "@/lib/neon/session"

const mapPromptData = (data: any): TPrompt => ({
  id: data.id,
  name: data.name,
  category: data.category,
  snippet: data.snippet,
  authorName: data.author_name,
  isPublic: data.is_public,
  userId: data.user_id,
  companyId: data.company_id ?? null,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
})

export const makeNeonPromptsRepository = (
  context: any,
): IPromptsRepository["Type"] => ({
  createPrompt: (name, category, snippet, authorName, isPublic, companyId) =>
    Effect.tryPromise({
      try: async () => {
        let userId: string
        try {
          userId = await getCurrentUserId(context)
        } catch (error) {
          throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
        }

        const res = await query(
          `INSERT INTO prompts (name, category, snippet, author_name, is_public, user_id, company_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [name, category, snippet, authorName ?? null, isPublic ?? false, userId, companyId ?? null]
        )

        const data = res.rows[0]
        if (!data) throw new PromptCreationError({ message: "Gagal membuat prompt" })

        return mapPromptData(data)
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof PromptCreationError) return err
        return new PromptCreationError({ message: err?.message || "Unknown error occurred" })
      },
    }),

  getPrompts: (companyId) =>
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
            `SELECT * FROM prompts WHERE company_id = $1 ORDER BY created_at DESC`,
            [companyId]
          )
        } else {
          res = await query(
            `SELECT * FROM prompts WHERE company_id IS NULL ORDER BY created_at DESC`
          )
        }

        if (!res.rows) return []

        return res.rows.map(mapPromptData)
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof PromptFetchError) return err
        return new PromptFetchError({ message: err?.message || "Unknown error occurred" })
      },
    }),
})
