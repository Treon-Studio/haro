import { Effect } from "effect"
import { IProjectsRepository } from "./projects.repository"
import type { TProject } from "./projects.types"
import { ProjectCreationError, ProjectFetchError, UnauthorizedError } from "./projects.errors"
import { query } from "@/lib/neon/client"
import { getCurrentUserId } from "@/lib/neon/session"

const mapProjectData = (data: any): TProject => ({
  id: data.id,
  name: data.name,
  userId: data.user_id,
  companyId: data.company_id ?? null,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
})

export const makeNeonProjectsRepository = (
  context: any,
): IProjectsRepository["Type"] => ({
  createProject: (name, companyId) =>
    Effect.tryPromise({
      try: async () => {
        let userId: string
        try {
          userId = await getCurrentUserId(context)
        } catch (error) {
          throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
        }

        const res = await query(
          `INSERT INTO projects (name, user_id, company_id)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [name, userId, companyId ?? null]
        )

        const data = res.rows[0]
        if (!data) throw new ProjectCreationError({ message: "Gagal membuat proyek" })

        return mapProjectData(data)
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof ProjectCreationError) return err
        return new ProjectCreationError({ message: err?.message || "Unknown error occurred" })
      },
    }),

  getProjects: (companyId) =>
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
            `SELECT * FROM projects WHERE company_id = $1 ORDER BY created_at DESC`,
            [companyId]
          )
        } else {
          res = await query(
            `SELECT * FROM projects WHERE company_id IS NULL ORDER BY created_at DESC`
          )
        }

        if (!res.rows) return []

        return res.rows.map(mapProjectData)
      },
      catch: (err: any) => {
        if (err instanceof UnauthorizedError) return err
        if (err instanceof ProjectFetchError) return err
        return new ProjectFetchError({ message: err?.message || "Unknown error occurred" })
      },
    }),
})
