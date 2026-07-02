export type TSkill = {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly body: string
  readonly category: string
  readonly userId: string
  readonly companyId: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export type TSkillDto = {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly body: string
  readonly category: string
  readonly user_id: string
  readonly company_id: string | null
  readonly created_at: string
  readonly updated_at: string
}

export const toSkillDto = (skill: TSkill): TSkillDto => ({
  id: skill.id,
  name: skill.name,
  description: skill.description,
  body: skill.body,
  category: skill.category,
  user_id: skill.userId,
  company_id: skill.companyId,
  created_at: skill.createdAt,
  updated_at: skill.updatedAt,
})
