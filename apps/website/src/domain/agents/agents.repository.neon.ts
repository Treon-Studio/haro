import { Effect } from 'effect'
import { AgentsRepository } from './agents.repository'
import type { Agent } from './agents.types'
import { AgentFetchError, AgentNotFoundError, AgentCreateError } from './agents.errors'
import { query } from "@/lib/neon/client"
import { getCurrentUserId } from "@/lib/neon/session"

const mapAgentData = (data: any): Agent => ({
  id: data.id,
  name: data.name,
  description: data.description,
  category: data.category,
  author: data.author,
  avatarUrl: data.avatar_url,
  isPromoted: data.is_promoted,
  userId: data.user_id,
  companyId: data.company_id ?? null,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
})

export const makeNeonAgentsRepository = (context: any) =>
  AgentsRepository.of({
    getAll: (companyId) =>
      Effect.tryPromise({
        try: async () => {
          let res
          if (companyId) {
            res = await query(
              `SELECT * FROM public.agents WHERE company_id = $1 ORDER BY created_at DESC`,
              [companyId]
            )
          } else {
            res = await query(
              `SELECT * FROM public.agents WHERE company_id IS NULL ORDER BY created_at DESC`
            )
          }

          return (res.rows || []).map(mapAgentData)
        },
        catch: (e) => new AgentFetchError({ cause: e }),
      }),

    getById: (id) =>
      Effect.tryPromise({
        try: async () => {
          const res = await query(
            `SELECT * FROM public.agents WHERE id = $1 LIMIT 1`,
            [id]
          )

          const data = res.rows[0]
          if (!data) throw new AgentNotFoundError({ id })

          return mapAgentData(data)
        },
        catch: (e: any) => {
          if (e instanceof AgentNotFoundError) throw e
          return new AgentFetchError({ cause: e })
        },
      }).pipe(
        Effect.catchAll((e) => Effect.fail(e))
      ),

    create: (data) =>
      Effect.tryPromise({
        try: async () => {
          let userId: string
          try {
            userId = await getCurrentUserId(context)
          } catch (error) {
            throw new AgentCreateError({ cause: new Error("Sesi tidak valid atau telah berakhir") })
          }

          const dbData = {
            name: data.name,
            description: data.description,
            category: data.category,
            author: data.author,
            avatar_url: data.avatarUrl ?? null,
            is_promoted: data.isPromoted || false,
            user_id: userId,
            company_id: data.companyId ?? null,
          }

          const res = await query(
            `INSERT INTO public.agents (name, description, category, author, avatar_url, is_promoted, user_id, company_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
              dbData.name,
              dbData.description,
              dbData.category,
              dbData.author,
              dbData.avatar_url,
              dbData.is_promoted,
              dbData.user_id,
              dbData.company_id,
            ]
          )

          const created = res.rows[0]
          if (!created) throw new AgentCreateError({ cause: new Error("Gagal membuat agent") })

          return mapAgentData(created)
        },
        catch: (e) => {
          if (e instanceof AgentCreateError) throw e
          return new AgentCreateError({ cause: e })
        },
      }),
  })