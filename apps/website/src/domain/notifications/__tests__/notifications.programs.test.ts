import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { INotificationsRepository } from "../notifications.repository"
import { getNotificationsProgram, markAsReadProgram, createNotificationProgram, broadcastAnnouncementProgram } from "../notifications.programs"
import type { TNotification } from "../notifications.types"

const mockNotification: TNotification = {
  id: "notif-1",
  userId: "user-1",
  category: "announcement",
  title: "Mental health month kickoff!",
  body: "Join us for free yoga sessions",
  link: "/events/yoga",
  readAt: null,
  createdAt: "now",
}

const mockRepo = {
  getNotifications: () => Effect.succeed([mockNotification]),
  markAsRead: (id: string) =>
    Effect.succeed({ ...mockNotification, id, readAt: "2026-06-24T00:00:00Z" }),
  createNotification: (userId: string, category: "re_engagement" | "content_progress" | "announcement" | "alert" | "crisis", title: string, body: string, link?: string | null) =>
    Effect.succeed({ ...mockNotification, userId, category, title, body, link: link || null }),
  broadcastAnnouncement: (companyId: string, title: string, body: string, link?: string | null) =>
    Effect.succeed([{ ...mockNotification, category: "announcement", title, body, link: link || null }]),
} satisfies INotificationsRepository["Type"]

const runWithRepo = (effect: any): Promise<any> =>
  Effect.runPromise(effect.pipe(Effect.provideService(INotificationsRepository, mockRepo)))

describe("getNotificationsProgram", () => {
  it("fetches active user notifications", async () => {
    const result = await runWithRepo(getNotificationsProgram())
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe("Mental health month kickoff!")
    expect(result[0].read_at).toBeNull()
  })
})

describe("markAsReadProgram", () => {
  it("marks an unread notification as read", async () => {
    const result = await runWithRepo(markAsReadProgram("notif-1"))
    expect(result.id).toBe("notif-1")
    expect(result.read_at).toBeDefined()
  })
})

describe("createNotificationProgram", () => {
  it("creates a single user alert", async () => {
    const result = await runWithRepo(createNotificationProgram("user-9", "alert", "Security notice", "Please reset pass"))
    expect(result.user_id).toBe("user-9")
    expect(result.category).toBe("alert")
    expect(result.title).toBe("Security notice")
  })
})

describe("broadcastAnnouncementProgram", () => {
  it("broadcasts B2B corporate announcements to all active employees", async () => {
    const result = await runWithRepo(broadcastAnnouncementProgram("company-123", "Office Closed", "Mental Health Day off"))
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe("announcement")
    expect(result[0].title).toBe("Office Closed")
  })
})
