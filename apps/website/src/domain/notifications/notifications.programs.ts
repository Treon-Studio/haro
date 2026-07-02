import { Effect, pipe } from "effect"
import { INotificationsRepository } from "./notifications.repository"
import { toNotificationDto } from "./notifications.types"
import type { TNotificationDto } from "./notifications.types"
import { NotificationFetchError, NotificationUpdateError, UnauthorizedError } from "./notifications.errors"

export type NotificationProgramError = NotificationFetchError | NotificationUpdateError | UnauthorizedError

export const getNotificationsProgram = (): Effect.Effect<
  readonly TNotificationDto[],
  NotificationProgramError,
  INotificationsRepository
> =>
  pipe(
    INotificationsRepository,
    Effect.flatMap((repo) => repo.getNotifications()),
    Effect.map((notifications) => notifications.map(toNotificationDto)),
  )

export const markAsReadProgram = (
  id: string,
): Effect.Effect<TNotificationDto, NotificationProgramError, INotificationsRepository> =>
  pipe(
    INotificationsRepository,
    Effect.flatMap((repo) => repo.markAsRead(id)),
    Effect.map(toNotificationDto),
  )

export const createNotificationProgram = (
  userId: string,
  category: "re_engagement" | "content_progress" | "announcement" | "alert" | "crisis",
  title: string,
  body: string,
  link?: string | null,
): Effect.Effect<TNotificationDto, NotificationProgramError, INotificationsRepository> =>
  pipe(
    INotificationsRepository,
    Effect.flatMap((repo) => repo.createNotification(userId, category, title, body, link)),
    Effect.map(toNotificationDto),
  )

export const broadcastAnnouncementProgram = (
  companyId: string,
  title: string,
  body: string,
  link?: string | null,
): Effect.Effect<readonly TNotificationDto[], NotificationProgramError, INotificationsRepository> =>
  pipe(
    INotificationsRepository,
    Effect.flatMap((repo) => repo.broadcastAnnouncement(companyId, title, body, link)),
    Effect.map((notifications) => notifications.map(toNotificationDto)),
  )
