export type TProfile = {
  readonly userId: string
  readonly fullName: string | null
  readonly ageRange: "18-24" | "25-34" | "35-44" | "45-54" | "55+" | null
  readonly gender: string | null
  readonly pronouns: string | null
  readonly phone: string | null
  readonly language: "id" | "en"
  readonly notificationOptIn: boolean
  readonly department: string | null
  readonly onboardingCompletedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export type TProfileDto = {
  readonly user_id: string
  readonly full_name: string | null
  readonly age_range: string | null
  readonly gender: string | null
  readonly pronouns: string | null
  readonly phone: string | null
  readonly language: string
  readonly notification_opt_in: boolean
  readonly department: string | null
  readonly onboarding_completed_at: string | null
  readonly created_at: string
  readonly updated_at: string
}

export const toProfileDto = (profile: TProfile): TProfileDto => ({
  user_id: profile.userId,
  full_name: profile.fullName,
  age_range: profile.ageRange,
  gender: profile.gender,
  pronouns: profile.pronouns,
  phone: profile.phone,
  language: profile.language,
  notification_opt_in: profile.notificationOptIn,
  department: profile.department,
  onboarding_completed_at: profile.onboardingCompletedAt,
  created_at: profile.createdAt,
  updated_at: profile.updatedAt,
})
