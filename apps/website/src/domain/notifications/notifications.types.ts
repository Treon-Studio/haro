export type TNotification = {
  readonly id: string
  readonly userId: string
  readonly category: "re_engagement" | "content_progress" | "announcement" | "alert" | "crisis"
  readonly title: string
  readonly body: string
  readonly link: string | null
  readonly readAt: string | null
  readonly createdAt: string
}

export type TNotificationDto = {
  readonly id: string
  readonly user_id: string
  readonly category: string
  readonly title: string
  readonly body: string
  readonly link: string | null
  readonly read_at: string | null
  readonly created_at: string
}

export const toNotificationDto = (n: TNotification): TNotificationDto => ({
  id: n.id,
  user_id: n.userId,
  category: n.category,
  title: n.title,
  body: n.body,
  link: n.link,
  read_at: n.readAt,
  created_at: n.createdAt,
})
