import { describe, it, expect, vi } from "vitest"
import { Effect } from "effect"
import { ISuperAdminRepository } from "../super-admin.repository"
import {
  createHandoffProgram,
  getHandoffsProgram,
  provisionTenantProgram,
} from "../super-admin.programs"
import type { THandoff } from "../super-admin.types"
import type { TCompany } from "@/domain/companies/index"

const mockHandoff: THandoff = {
  id: "handoff-1",
  companyName: "Initech Corp",
  companySize: 150,
  billingModel: "per_seat",
  companyAdminEmail: "admin@initech.com",
  contractTerms: "1 year, standard B2B",
  goLiveDate: "2026-07-01",
  salesContact: "Bill Lumbergh",
  createdAt: "2026-06-24T00:00:00Z",
  updatedAt: "2026-06-24T00:00:00Z",
}

const mockCompany: TCompany = {
  id: "company-101",
  name: "Initech Corp",
  createdAt: "2026-06-24T00:00:00Z",
  updatedAt: "2026-06-24T00:00:00Z",
}

const mockRepo = {
  createHandoff: (data: any) => Effect.succeed({ ...mockHandoff, ...data }),
  getHandoffs: () => Effect.succeed([mockHandoff]),
  provisionTenant: (_id: string) => Effect.succeed(mockCompany),
} satisfies ISuperAdminRepository["Type"]

const runWithRepo = <A, E>(effect: Effect.Effect<A, E, ISuperAdminRepository>): Promise<A> =>
  Effect.runPromise(effect.pipe(Effect.provideService(ISuperAdminRepository, mockRepo)))

describe("createHandoffProgram", () => {
  it("validates and creates a sales handoff", async () => {
    const result = await runWithRepo(
      createHandoffProgram({
        companyName: "Tyrell Corp",
        companySize: 500,
        billingModel: "usage_based",
        companyAdminEmail: "eldon@tyrell.com",
        salesContact: "Deckard",
      }),
    )
    expect(result.company_name).toBe("Tyrell Corp")
    expect(result.company_size).toBe(500)
    expect(result.billing_model).toBe("usage_based")
    expect(result.company_admin_email).toBe("eldon@tyrell.com")
  })

  it("fails on invalid email", async () => {
    await expect(
      runWithRepo(
        createHandoffProgram({
          companyName: "Tyrell Corp",
          companySize: 500,
          billingModel: "usage_based",
          companyAdminEmail: "not-an-email",
          salesContact: "Deckard",
        }),
      ),
    ).rejects.toThrow()
  })
})

describe("getHandoffsProgram", () => {
  it("retrieves list of sales handoffs", async () => {
    const result = await runWithRepo(getHandoffsProgram())
    expect(result).toHaveLength(1)
    expect(result[0].company_name).toBe("Initech Corp")
    expect(result[0].sales_contact).toBe("Bill Lumbergh")
  })
})

describe("provisionTenantProgram", () => {
  it("provisions a new tenant company from handoff", async () => {
    const result = await runWithRepo(provisionTenantProgram("handoff-1"))
    expect(result.id).toBe("company-101")
    expect(result.name).toBe("Initech Corp")
  })
})
