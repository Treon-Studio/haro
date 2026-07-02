export type TBillingInfo = {
  readonly companyId: string
  readonly sessionQuota: number
  readonly sessionsUsed: number
  readonly isQuotaExceeded: boolean
  readonly warningLevel: "none" | "warning" | "critical" | "exceeded"
}

export type TBillingInfoDto = {
  readonly company_id: string
  readonly session_quota: number
  readonly sessions_used: number
  readonly is_quota_exceeded: boolean
  readonly warning_level: string
}

export const toBillingInfoDto = (info: TBillingInfo): TBillingInfoDto => ({
  company_id: info.companyId,
  session_quota: info.sessionQuota,
  sessions_used: info.sessionsUsed,
  is_quota_exceeded: info.isQuotaExceeded,
  warning_level: info.warningLevel,
})
