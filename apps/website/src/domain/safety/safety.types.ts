export type TRiskFlag = {
  readonly id: string
  readonly userId: string
  readonly companyId: string
  readonly sessionId: string
  readonly tier: "standard" | "critical"
  readonly aiSummary: string | null
  readonly triggerPattern: string | null
  readonly createdAt: string
}

export type TRiskFlagDto = {
  readonly id: string
  readonly user_id: string
  readonly company_id: string
  readonly session_id: string
  readonly tier: string
  readonly ai_summary: string | null
  readonly trigger_pattern: string | null
  readonly created_at: string
}

export type TEscalationCase = {
  readonly id: string
  readonly riskFlagId: string
  readonly companyId: string
  readonly status: "open" | "assigned" | "resolved" | "dismissed"
  readonly primaryAssignee: string | null
  readonly backupAssignee: string | null
  readonly followupAttempts: readonly { date: string; notes: string }[]
  readonly outcome: string | null
  readonly outcomeNotes: string | null
  readonly resolvedAt: string | null
  readonly resolvedBy: string | null
  readonly createdAt: string
}

export type TEscalationCaseDto = {
  readonly id: string
  readonly risk_flag_id: string
  readonly company_id: string
  readonly status: string
  readonly primary_assignee: string | null
  readonly backup_assignee: string | null
  readonly followup_attempts: readonly { date: string; notes: string }[]
  readonly outcome: string | null
  readonly outcome_notes: string | null
  readonly resolved_at: string | null
  readonly resolved_by: string | null
  readonly created_at: string
}

export const toRiskFlagDto = (flag: TRiskFlag): TRiskFlagDto => ({
  id: flag.id,
  user_id: flag.userId,
  company_id: flag.companyId,
  session_id: flag.sessionId,
  tier: flag.tier,
  ai_summary: flag.aiSummary,
  trigger_pattern: flag.triggerPattern,
  created_at: flag.createdAt,
})

export const toEscalationCaseDto = (c: TEscalationCase): TEscalationCaseDto => ({
  id: c.id,
  risk_flag_id: c.riskFlagId,
  company_id: c.companyId,
  status: c.status,
  primary_assignee: c.primaryAssignee,
  backup_assignee: c.backupAssignee,
  followup_attempts: c.followupAttempts,
  outcome: c.outcome,
  outcome_notes: c.outcomeNotes,
  resolved_at: c.resolvedAt,
  resolved_by: c.resolvedBy,
  created_at: c.createdAt,
})
