import { Context, Effect } from "effect"
import type { TNotification } from "./notifications.types"
import { NotificationFetchError, NotificationUpdateError, UnauthorizedError } from "./notifications.errors"

export class INotificationsRepository extends Context.Tag("INotificationsRepository")<
  INotificationsRepository,
  {
    readonly getNotifications: () => Effect.Effect<readonly TNotification[], NotificationFetchError | UnauthorizedError>
    readonly markAsRead: (id: string) => Effect.Effect<TNotification, NotificationUpdateError | UnauthorizedError>
    readonly createNotification: (
      userId: string,
      category: "re_engagement" | "content_progress" | "announcement" | "alert" | "crisis",
      title: string,
      body: string,
      link?: string | null,
    ) => Effect.Effect<TNotification, NotificationUpdateError | UnauthorizedError>
    readonly broadcastAnnouncement: (
      companyId: string,
      title: string,
      body: string,
      link?: string | null,
    ) => Effect.Effect<readonly TNotification[], NotificationUpdateError | UnauthorizedError>
  }
> () {}
