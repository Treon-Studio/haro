export type TFeatureFlag = {
  readonly companyId: string
  readonly flag: string
  readonly enabled: boolean
  readonly config: Record<string, any>
  readonly updatedAt: string
}

export type TPlatformStatus = {
  readonly id: string
  readonly message: string
  readonly isActive: boolean
  readonly severity: "info" | "warning" | "critical"
  readonly expectedResolution: string | null
  readonly createdAt: string
  readonly updatedAt: string
}
