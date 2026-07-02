export type TCompany = {
  readonly id: string
  readonly name: string
  readonly createdAt: string
  readonly updatedAt: string
}

export type TCompanyDto = {
  readonly id: string
  readonly name: string
  readonly created_at: string
  readonly updated_at: string
}

export type TCompanyMembership = {
  readonly id: string
  readonly companyId: string
  readonly userId: string
  readonly role: "owner" | "admin" | "member"
  readonly status: "active" | "invited" | "suspended"
  readonly createdAt: string
  readonly updatedAt: string
}

export type TCompanyMembershipDto = {
  readonly id: string
  readonly company_id: string
  readonly user_id: string
  readonly role: string
  readonly status: string
  readonly created_at: string
  readonly updated_at: string
}

export const toCompanyDto = (company: TCompany): TCompanyDto => ({
  id: company.id,
  name: company.name,
  created_at: company.createdAt,
  updated_at: company.updatedAt,
})

export const toCompanyMembershipDto = (membership: TCompanyMembership): TCompanyMembershipDto => ({
  id: membership.id,
  company_id: membership.companyId,
  user_id: membership.userId,
  role: membership.role,
  status: membership.status,
  created_at: membership.createdAt,
  updated_at: membership.updatedAt,
})
