import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { ISuperAdminOpsRepository } from "../super-admin-ops.repository"
import { getFeatureFlagsProgram, updateFeatureFlagProgram, getPlatformStatusProgram, updatePlatformStatusProgram } from "../super-admin-ops.programs"
import type { TFeatureFlag, TPlatformStatus } from "../super-admin-ops.types"

const mockFlag: TFeatureFlag = {
  companyId: "company-1",
  flag: "self_guided_content",
  enabled: true,
  config: {},
  updatedAt: "now",
}

const mockStatus: TPlatformStatus = {
  id: "status-1",
  message: "Maintenance scheduled",
  isActive: true,
  severity: "warning",
  expectedResolution: "2 hours",
  createdAt: "now",
  updatedAt: "now",
}

const mockRepo = {
  getFeatureFlags: (companyId: string) => Effect.succeed([{ ...mockFlag, companyId }]),
  updateFeatureFlag: (companyId: string, flag: string, enabled: boolean) =>
    Effect.succeed({ ...mockFlag, companyId, flag, enabled }),
  getPlatformStatus: () => Effect.succeed(mockStatus),
  updatePlatformStatus: (message: string, isActive: boolean, severity: "info" | "warning" | "critical", expectedResolution?: string | null) =>
    Effect.succeed({ ...mockStatus, message, isActive, severity, expectedResolution: expectedResolution || null }),
} satisfies ISuperAdminOpsRepository["Type"]

const runWithRepo = (effect: any): Promise<any> =>
  Effect.runPromise(effect.pipe(Effect.provideService(ISuperAdminOpsRepository, mockRepo)))

describe("getFeatureFlagsProgram", () => {
  it("fetches corporate B2B feature flags", async () => {
    const result = await runWithRepo(getFeatureFlagsProgram("company-1"))
    expect(result).toHaveLength(1)
    expect(result[0].flag).toBe("self_guided_content")
    expect(result[0].enabled).toBe(true)
  })
})

describe("updateFeatureFlagProgram", () => {
  it("updates and toggles a B2B company feature flag", async () => {
    const result = await runWithRepo(updateFeatureFlagProgram("company-1", "bookmarks", false))
    expect(result.companyId).toBe("company-1")
    expect(result.flag).toBe("bookmarks")
    expect(result.enabled).toBe(false)
  })
})

describe("getPlatformStatusProgram", () => {
  it("fetches active system-wide maintenance banners", async () => {
    const result = await runWithRepo(getPlatformStatusProgram())
    expect(result?.message).toBe("Maintenance scheduled")
    expect(result?.severity).toBe("warning")
  })
})

describe("updatePlatformStatusProgram", () => {
  it("creates and broadcasts new platform statuses", async () => {
    const result = await runWithRepo(updatePlatformStatusProgram("Major database upgrade", true, "critical", "1 hour"))
    expect(result.message).toBe("Major database upgrade")
    expect(result.severity).toBe("critical")
    expect(result.expectedResolution).toBe("1 hour")
  })
})
