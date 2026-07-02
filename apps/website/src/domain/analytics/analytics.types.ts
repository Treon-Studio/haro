export type TAnalyticsData = {
  readonly totalMembers: number
  readonly totalSessions: number
  readonly dauHistory: readonly { date: string; active_users: number }[]
  readonly isPrivacyProtected: boolean
}

export type TAnalyticsDto = {
  readonly total_members: number
  readonly total_sessions: number
  readonly dau_history: readonly { date: string; active_users: number }[]
  readonly is_privacy_protected: boolean
}

export const toAnalyticsDto = (data: TAnalyticsData): TAnalyticsDto => ({
  total_members: data.totalMembers,
  total_sessions: data.totalSessions,
  dau_history: data.dauHistory,
  is_privacy_protected: data.isPrivacyProtected,
})
