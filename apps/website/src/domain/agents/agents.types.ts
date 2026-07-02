export interface Agent {
  id: string
  name: string
  description: string
  category: string
  author: string
  avatarUrl?: string | null
  isPromoted: boolean
  userId?: string | null
  companyId?: string | null
  createdAt: string
  updatedAt: string
}
