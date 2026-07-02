export type TProject = {
  readonly id: string
  readonly name: string
  readonly userId: string
  readonly companyId: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export type TProjectDto = {
  readonly id: string
  readonly name: string
  readonly user_id: string
  readonly company_id: string | null
  readonly created_at: string
  readonly updated_at: string
}

export const toProjectDto = (project: TProject): TProjectDto => ({
  id: project.id,
  name: project.name,
  user_id: project.userId,
  company_id: project.companyId,
  created_at: project.createdAt,
  updated_at: project.updatedAt,
})
