export type THandoff = {
  readonly id: string
  readonly companyName: string
  readonly companySize: number
  readonly billingModel: "flat_rate" | "per_seat" | "usage_based"
  readonly companyAdminEmail: string
  readonly contractTerms: string | null
  readonly goLiveDate: string | null
  readonly salesContact: string
  readonly createdAt: string
  readonly updatedAt: string
}

export type THandoffDto = {
  readonly id: string
  readonly company_name: string
  readonly company_size: number
  readonly billing_model: string
  readonly company_admin_email: string
  readonly contract_terms: string | null
  readonly go_live_date: string | null
  readonly sales_contact: string
  readonly created_at: string
  readonly updated_at: string
}

export const toHandoffDto = (handoff: THandoff): THandoffDto => ({
  id: handoff.id,
  company_name: handoff.companyName,
  company_size: handoff.companySize,
  billing_model: handoff.billingModel,
  company_admin_email: handoff.companyAdminEmail,
  contract_terms: handoff.contractTerms,
  go_live_date: handoff.goLiveDate,
  sales_contact: handoff.salesContact,
  created_at: handoff.createdAt,
  updated_at: handoff.updatedAt,
})
