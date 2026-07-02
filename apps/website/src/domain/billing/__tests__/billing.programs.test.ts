import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { IBillingRepository } from "../billing.repository"
import { getBillingInfoProgram, checkAndIncrementQuotaProgram } from "../billing.programs"
import type { TBillingInfo } from "../billing.types"

const mockBilling: TBillingInfo = {
  companyId: "company-1",
  sessionQuota: 10,
  sessionsUsed: 8,
  isQuotaExceeded: false,
  warningLevel: "warning",
}

const mockRepo = {
  getBillingInfo: (companyId: string) => {
    if (companyId === "company-exhausted") {
      return Effect.succeed({ ...mockBilling, companyId, sessionsUsed: 10, isQuotaExceeded: true, warningLevel: "exceeded" })
    }
    return Effect.succeed({ ...mockBilling, companyId })
  },
  incrementSessionUsage: (companyId: string) =>
    Effect.succeed({ ...mockBilling, companyId, sessionsUsed: 9 }),
} satisfies IBillingRepository["Type"]

const runWithRepo = (effect: any): Promise<any> =>
  Effect.runPromise(effect.pipe(Effect.provideService(IBillingRepository, mockRepo)))

describe("getBillingInfoProgram", () => {
  it("fetches and maps corporate billing quota status", async () => {
    const result = await runWithRepo(getBillingInfoProgram("company-1"))
    expect(result.company_id).toBe("company-1")
    expect(result.sessions_used).toBe(8)
    expect(result.is_quota_exceeded).toBe(false)
    expect(result.warning_level).toBe("warning")
  })
})

describe("checkAndIncrementQuotaProgram", () => {
  it("increments quota if limit has not been reached", async () => {
    const result = await runWithRepo(checkAndIncrementQuotaProgram("company-1"))
    expect(result).toBe(true)
  })

  it("returns false and blocks increment if quota is already exhausted", async () => {
    const result = await runWithRepo(checkAndIncrementQuotaProgram("company-exhausted"))
    expect(result).toBe(false)
  })
})
