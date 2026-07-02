export type TBranding = {
  readonly companyId: string
  readonly logoUrl: string | null
  readonly primaryColor: string | null
  readonly welcomeMessage: string | null
  readonly defaultLanguage: "id" | "en"
  readonly notificationSettings: Record<string, any>
  readonly updatedAt: string
  readonly updatedBy: string | null
}

export type TBrandingDto = {
  readonly company_id: string
  readonly logo_url: string | null
  readonly primary_color: string | null
  readonly welcome_message: string | null
  readonly default_language: string
  readonly notification_settings: Record<string, any>
  readonly updated_at: string
  readonly updated_by: string | null
}

export const toBrandingDto = (branding: TBranding): TBrandingDto => ({
  company_id: branding.companyId,
  logo_url: branding.logoUrl,
  primary_color: branding.primaryColor,
  welcome_message: branding.welcomeMessage,
  default_language: branding.defaultLanguage,
  notification_settings: branding.notificationSettings,
  updated_at: branding.updatedAt,
  updated_by: branding.updatedBy,
})
