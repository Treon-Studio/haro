import { describe, it, expect, vi } from "vitest"
import { Effect } from "effect"
import { IBrandingRepository } from "../branding.repository"
import { getBrandingProgram, updateBrandingProgram } from "../branding.programs"
import type { TBranding } from "../branding.types"

const mockBranding: TBranding = {
  companyId: "company-101",
  logoUrl: "https://example.com/logo.png",
  primaryColor: "#00FF00",
  welcomeMessage: "Custom corporate greeting",
  defaultLanguage: "en",
  notificationSettings: {},
  updatedAt: "2026-06-24T00:00:00Z",
  updatedBy: "user-1",
}

const mockRepo = {
  getBranding: (companyId: string) => {
    if (companyId === "company-101") return Effect.succeed(mockBranding)
    return Effect.succeed(null)
  },
  updateBranding: (companyId: string, data: any) =>
    Effect.succeed({
      ...mockBranding,
      companyId,
      ...data,
    }),
} satisfies IBrandingRepository["Type"]

const runWithRepo = <A, E>(effect: Effect.Effect<A, E, IBrandingRepository>): Promise<A> =>
  Effect.runPromise(effect.pipe(Effect.provideService(IBrandingRepository, mockRepo)))

describe("getBrandingProgram", () => {
  it("retrieves custom B2B corporate branding if configured", async () => {
    const result = await runWithRepo(getBrandingProgram("company-101"))
    expect(result.company_id).toBe("company-101")
    expect(result.primary_color).toBe("#00FF00")
    expect(result.logo_url).toBe("https://example.com/logo.png")
  })

  it("injects Tenang Earthy Ochre defaults if no corporate branding exists", async () => {
    const result = await runWithRepo(getBrandingProgram("company-unconfigured"))
    expect(result.company_id).toBe("company-unconfigured")
    expect(result.primary_color).toBe("#9B5B3E") // Earthy Ochre fallback
    expect(result.logo_url).toBeNull()
    expect(result.welcome_message).toContain("Selamat datang")
  })
})

describe("updateBrandingProgram", () => {
  it("validates and updates company branding", async () => {
    const result = await runWithRepo(
      updateBrandingProgram({
        companyId: "company-101",
        primaryColor: "#FF00FF",
        welcomeMessage: "Hi Replican!",
      }),
    )
    expect(result.company_id).toBe("company-101")
    expect(result.primary_color).toBe("#FF00FF")
    expect(result.welcome_message).toBe("Hi Replican!")
  })

  it("fails on invalid HEX color code format", async () => {
    await expect(
      runWithRepo(
        updateBrandingProgram({
          companyId: "company-101",
          primaryColor: "not-a-color",
        }),
      ),
    ).rejects.toThrow()
  })
})
