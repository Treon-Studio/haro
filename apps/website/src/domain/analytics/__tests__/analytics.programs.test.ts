import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { IAnalyticsRepository } from "../analytics.repository"
import { getCompanyAnalyticsProgram } from "../analytics.programs"

const mockRepo = {
  getCompanyMemberCount: (companyId: string) => {
    if (companyId === "company-small") return Effect.succeed(3)
    return Effect.succeed(10)
  },
  getDailyActiveUsers: (companyId: string, limitDays: number) =>
    Effect.succeed([{ date: "2026-06-24", active_users: 6 }]),
  getTotalSessionsCount: (companyId: string, limitDays: number) => Effect.succeed(45),
} satisfies IAnalyticsRepository["Type"]

const runWithRepo = (effect: any): Promise<any> =>
  Effect.runPromise(effect.pipe(Effect.provideService(IAnalyticsRepository, mockRepo)))

describe("getCompanyAnalyticsProgram", () => {
  it("retrieves full metrics if company has 5 or more active members", async () => {
    const result = await runWithRepo(getCompanyAnalyticsProgram("company-large"))
    expect(result.total_members).toBe(10)
    expect(result.total_sessions).toBe(45)
    expect(result.is_privacy_protected).toBe(false)
    expect(result.dau_history).toHaveLength(1)
  })

  it("applies HIPAA Privacy Shield and masks granular metrics if members < 5", async () => {
    const result = await runWithRepo(getCompanyAnalyticsProgram("company-small"))
    expect(result.total_members).toBe(3)
    expect(result.total_sessions).toBe(0) // masked
    expect(result.is_privacy_protected).toBe(true)
    expect(result.dau_history).toHaveLength(0) // masked
  })
})
