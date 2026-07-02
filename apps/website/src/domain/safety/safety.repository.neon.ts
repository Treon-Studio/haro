import { Effect } from "effect"
import { ISafetyRepository } from "./safety.repository"
import type { TRiskFlag, TEscalationCase } from "./safety.types"
import { SafetyFetchError, SafetyUpdateError } from "./safety.errors"
import { query, transaction } from "@/lib/neon/client"
import { getCurrentUserId } from "@/lib/neon/session"

const mapRiskData = (data: any): TRiskFlag => ({
  id: data.id,
  userId: data.user_id,
  companyId: data.company_id,
  sessionId: data.session_id,
  tier: data.tier as "standard" | "critical",
  aiSummary: data.ai_summary,
  triggerPattern: data.trigger_pattern,
  createdAt: data.created_at,
})

const mapCaseData = (data: any): TEscalationCase => ({
  id: data.id,
  riskFlagId: data.risk_flag_id,
  companyId: data.company_id,
  status: data.status as "open" | "assigned" | "resolved" | "dismissed",
  primaryAssignee: data.primary_assignee,
  backupAssignee: data.backup_assignee,
  followupAttempts: data.followup_attempts || [],
  outcome: data.outcome,
  outcomeNotes: data.outcome_notes,
  resolvedAt: data.resolved_at,
  resolvedBy: data.resolved_by,
  createdAt: data.created_at,
})

export const makeNeonSafetyRepository = (
  context: any,
): ISafetyRepository["Type"] => ({
  flagRisk: (userId, companyId, sessionId, tier, summary, trigger) =>
    Effect.tryPromise({
      try: async () => {
        if (tier === "critical") {
          // Use transaction to atomically insert risk flag and escalation case
          const result = await transaction(async (client) => {
            const flagRes = await client.query(
              `INSERT INTO public.risk_flags (user_id, company_id, session_id, tier, ai_summary, trigger_pattern)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
              [userId, companyId, sessionId, tier, summary, trigger],
            )
            const flag = flagRes.rows[0]
            if (!flag) throw new SafetyUpdateError({ message: "Gagal mencatat bendera risiko" })

            try {
              await client.query(
                `INSERT INTO public.escalation_cases (risk_flag_id, company_id, status)
                 VALUES ($1, $2, 'open')`,
                [flag.id, companyId],
              )
            } catch (caseErr: any) {
              throw new SafetyUpdateError({ message: `Auto escalation failed: ${caseErr.message}` })
            }

            return flag
          })
          return mapRiskData(result)
        } else {
          // Standard tier — single insert, no escalation
          const res = await query(
            `INSERT INTO public.risk_flags (user_id, company_id, session_id, tier, ai_summary, trigger_pattern)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [userId, companyId, sessionId, tier, summary, trigger],
          )
          const flag = res.rows[0]
          if (!flag) throw new SafetyUpdateError({ message: "Gagal mencatat bendera risiko" })
          return mapRiskData(flag)
        }
      },
      catch: (err: any) => {
        if (err instanceof SafetyUpdateError) return err
        return new SafetyUpdateError({ message: err?.message || "Unknown error" })
      },
    }),

  getEscalationCases: () =>
    Effect.tryPromise({
      try: async () => {
        const res = await query(
          `SELECT * FROM public.escalation_cases
           WHERE status IN ('open', 'assigned')
           ORDER BY created_at DESC`,
        )
        if (!res.rows) return []
        return res.rows.map(mapCaseData)
      },
      catch: (err: any) => {
        if (err instanceof SafetyFetchError) return err
        return new SafetyFetchError({ message: err?.message || "Unknown error" })
      },
    }),

  assignCase: (caseId, assigneeId) =>
    Effect.tryPromise({
      try: async () => {
        const res = await query(
          `UPDATE public.escalation_cases
           SET status = 'assigned', primary_assignee = $2
           WHERE id = $1
           RETURNING *`,
          [caseId, assigneeId],
        )
        const row = res.rows[0]
        if (!row) throw new SafetyUpdateError({ message: "Gagal menetapkan penanganan kasus" })
        return mapCaseData(row)
      },
      catch: (err: any) => {
        if (err instanceof SafetyUpdateError) return err
        return new SafetyUpdateError({ message: err?.message || "Unknown error" })
      },
    }),

  logFollowupAttempt: (caseId, notes) =>
    Effect.tryPromise({
      try: async () => {
        const updated = await transaction(async (client) => {
          const currentRes = await client.query(
            `SELECT followup_attempts FROM public.escalation_cases WHERE id = $1`,
            [caseId],
          )
          const current = currentRes.rows[0]
          if (!current) throw new SafetyUpdateError({ message: "Gagal memuat log follow-up" })

          const attempts = current.followup_attempts || []
          const logs = [...attempts, { date: new Date().toISOString(), notes }]

          const updateRes = await client.query(
            `UPDATE public.escalation_cases SET followup_attempts = $1 WHERE id = $2 RETURNING *`,
            [JSON.stringify(logs), caseId],
          )
          const data = updateRes.rows[0]
          if (!data) throw new SafetyUpdateError({ message: "Gagal memperbarui log follow-up" })
          return data
        })
        return mapCaseData(updated)
      },
      catch: (err: any) => {
        if (err instanceof SafetyUpdateError) return err
        return new SafetyUpdateError({ message: err?.message || "Unknown error" })
      },
    }),

  resolveCase: (caseId, outcome, notes) =>
    Effect.tryPromise({
      try: async () => {
        let userId: string | null = null
        try {
          userId = await getCurrentUserId(context)
        } catch {
          // non-critical — user may not have an active session
        }

        const res = await query(
          `UPDATE public.escalation_cases
           SET status = 'resolved',
               outcome = $1,
               outcome_notes = $2,
               resolved_at = $3,
               resolved_by = $4
           WHERE id = $5
           RETURNING *`,
          [outcome, notes, new Date().toISOString(), userId, caseId],
        )
        const row = res.rows[0]
        if (!row) throw new SafetyUpdateError({ message: "Gagal menyelesaikan kasus" })
        return mapCaseData(row)
      },
      catch: (err: any) => {
        if (err instanceof SafetyUpdateError) return err
        return new SafetyUpdateError({ message: err?.message || "Unknown error" })
      },
    }),
})