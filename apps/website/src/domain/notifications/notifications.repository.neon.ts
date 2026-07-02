import { Effect } from "effect"
import { INotificationsRepository } from "./notifications.repository"
import type { TNotification } from "./notifications.types"
import { NotificationFetchError, NotificationUpdateError, UnauthorizedError } from "./notifications.errors"
import { query, transaction } from "@/lib/neon/client"
import { getCurrentUserId } from "@/lib/neon/session"

const mapNotificationData = (data: any): TNotification => ({
	id: data.id,
	userId: data.user_id,
	category: data.category as "re_engagement" | "content_progress" | "announcement" | "alert" | "crisis",
	title: data.title,
	body: data.body,
	link: data.link,
	readAt: data.read_at,
	createdAt: data.created_at,
})

export const makeNeonNotificationsRepository = (
	context: any,
): INotificationsRepository["Type"] => ({
	getNotifications: () =>
		Effect.tryPromise({
			try: async () => {
				let userId: string
				try {
					userId = await getCurrentUserId(context)
				} catch {
					throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
				}

				const res = await query(
					`SELECT * FROM public.notifications
                     WHERE user_id = $1
                     ORDER BY created_at DESC`,
					[userId],
				)

				if (!res.rows) return []
				return res.rows.map(mapNotificationData)
			},
			catch: (err: any) => {
				if (err instanceof UnauthorizedError) return err
				if (err instanceof NotificationFetchError) return err
				return new NotificationFetchError({ message: err?.message || "Unknown error" })
			},
		}),

	markAsRead: (id) =>
		Effect.tryPromise({
			try: async () => {
				try {
					await getCurrentUserId(context)
				} catch {
					throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
				}

				const res = await query(
					`UPDATE public.notifications
                     SET read_at = NOW()
                     WHERE id = $1
                     RETURNING *`,
					[id],
				)

				const row = res.rows[0]
				if (!row) throw new NotificationUpdateError({ message: "Gagal menandai notifikasi telah dibaca" })

				return mapNotificationData(row)
			},
			catch: (err: any) => {
				if (err instanceof UnauthorizedError) return err
				if (err instanceof NotificationUpdateError) return err
				return new NotificationUpdateError({ message: err?.message || "Unknown error" })
			},
		}),

	createNotification: (userId, category, title, body, link) =>
		Effect.tryPromise({
			try: async () => {
				// No auth check needed as this is a system-side call
				const res = await query(
					`INSERT INTO public.notifications (user_id, category, title, body, link)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING *`,
					[userId, category, title, body, link || null],
				)

				const row = res.rows[0]
				if (!row) throw new NotificationUpdateError({ message: "Gagal membuat notifikasi" })

				return mapNotificationData(row)
			},
			catch: (err: any) => {
				if (err instanceof NotificationUpdateError) return err
				return new NotificationUpdateError({ message: err?.message || "Unknown error" })
			},
		}),

	broadcastAnnouncement: (companyId, title, body, link) =>
		Effect.tryPromise({
			try: async () => {
				try {
					await getCurrentUserId(context)
				} catch {
					throw new UnauthorizedError({ message: "Sesi tidak valid atau telah berakhir" })
				}

				// Broadcast operation inside transaction
				const notifications = await transaction(async (client) => {
					// 1. Fetch all active memberships for this company
					const membersRes = await client.query(
						`SELECT user_id FROM public.company_memberships
                         WHERE company_id = $1 AND status = 'active'`,
						[companyId],
					)

					const members = membersRes.rows
					if (!members || members.length === 0) return []

					// 2. Loop insert notifications for each member
					const insertedRows: any[] = []
					for (const member of members) {
						const res = await client.query(
							`INSERT INTO public.notifications (user_id, category, title, body, link)
                             VALUES ($1, 'announcement', $2, $3, $4)
                             RETURNING *`,
							[member.user_id, title, body, link || null],
						)
						if (res.rows[0]) {
							insertedRows.push(res.rows[0])
						}
					}

					return insertedRows
				})

				return notifications.map(mapNotificationData)
			},
			catch: (err: any) => {
				if (err instanceof UnauthorizedError) return err
				if (err instanceof NotificationUpdateError) return err
				return new NotificationUpdateError({ message: err?.message || "Unknown error" })
			},
		}),
})