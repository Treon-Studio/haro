export type TPrompt = {
  readonly id: string
  readonly name: string
  readonly category: string
  readonly snippet: string
  readonly authorName: string | null
  readonly isPublic: boolean
  readonly userId: string
  readonly companyId: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export type TPromptDto = {
  readonly id: string
  readonly name: string
  readonly category: string
  readonly snippet: string
  readonly authorName: string | null
  readonly isPublic: boolean
  readonly user_id: string
  readonly company_id: string | null
  readonly created_at: string
  readonly updated_at: string
}

export const toPromptDto = (prompt: TPrompt): TPromptDto => ({
  id: prompt.id,
  name: prompt.name,
  category: prompt.category,
  snippet: prompt.snippet,
  authorName: prompt.authorName,
  isPublic: prompt.isPublic,
  user_id: prompt.userId,
  company_id: prompt.companyId,
  created_at: prompt.createdAt,
  updated_at: prompt.updatedAt,
})
