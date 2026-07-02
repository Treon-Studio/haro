import { describe, it, expect, vi } from "vitest"
import { Effect } from "effect"
import { ICompaniesRepository } from "../companies.repository"
import {
  createCompanyProgram,
  getCompaniesProgram,
  updateCompanyProgram,
  getCompanyMembersProgram,
  addCompanyMemberProgram,
  updateCompanyMemberProgram,
  removeCompanyMemberProgram,
} from "../companies.programs"
import { ValidationError } from "@/shared/errors/application.errors"
import type { TCompany, TCompanyMembership } from "../companies.types"

const mockCompany: TCompany = {
  id: "company-1",
  name: "Acme Corp",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
}

const mockMembership: TCompanyMembership = {
  id: "membership-1",
  companyId: "company-1",
  userId: "user-1",
  role: "owner",
  status: "active",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
}

const mockRepo = {
  createCompany: (name: string) => Effect.succeed({ ...mockCompany, name }),
  getCompanies: () => Effect.succeed([mockCompany]),
  updateCompany: (id: string, name: string) => Effect.succeed({ ...mockCompany, id, name }),
  getCompanyMembers: (companyId: string) => Effect.succeed([{ ...mockMembership, companyId }]),
  addCompanyMember: (companyId: string, userId: string, role: "owner" | "admin" | "member") =>
    Effect.succeed({ ...mockMembership, companyId, userId, role, status: "invited" }),
  updateCompanyMember: (membershipId: string, role: "owner" | "admin" | "member", status: "active" | "invited" | "suspended") =>
    Effect.succeed({ ...mockMembership, id: membershipId, role, status }),
  removeCompanyMember: (_membershipId: string) => Effect.void,
} satisfies ICompaniesRepository["Type"]

const runWithRepo = <A, E>(effect: Effect.Effect<A, E, ICompaniesRepository>): Promise<A> =>
  Effect.runPromise(effect.pipe(Effect.provideService(ICompaniesRepository, mockRepo)))

describe("createCompanyProgram", () => {
  it("validates and creates a company", async () => {
    const result = await runWithRepo(createCompanyProgram({ name: "Wayne Enterprises" }))
    expect(result.name).toBe("Wayne Enterprises")
    expect(result.id).toBe("company-1")
  })

  it("fails on invalid input (empty name)", async () => {
    await expect(
      runWithRepo(createCompanyProgram({ name: "" })),
    ).rejects.toThrow()
  })
})

describe("getCompaniesProgram", () => {
  it("retrieves list of companies", async () => {
    const result = await runWithRepo(getCompaniesProgram())
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe("Acme Corp")
    expect(result[0].id).toBe("company-1")
  })
})

describe("updateCompanyProgram", () => {
  it("validates and updates a company name", async () => {
    const result = await runWithRepo(updateCompanyProgram({ id: "company-123", name: "Initech" }))
    expect(result.id).toBe("company-123")
    expect(result.name).toBe("Initech")
  })

  it("fails on invalid input (missing name)", async () => {
    await expect(
      runWithRepo(updateCompanyProgram({ id: "company-123", name: "" })),
    ).rejects.toThrow()
  })
})

describe("getCompanyMembersProgram", () => {
  it("retrieves memberships for a company", async () => {
    const result = await runWithRepo(getCompanyMembersProgram("company-xyz"))
    expect(result).toHaveLength(1)
    expect(result[0].company_id).toBe("company-xyz")
    expect(result[0].role).toBe("owner")
  })
})

describe("addCompanyMemberProgram", () => {
  it("validates and adds a company member", async () => {
    const result = await runWithRepo(
      addCompanyMemberProgram({
        companyId: "company-1",
        userId: "user-2",
        role: "admin",
      }),
    )
    expect(result.company_id).toBe("company-1")
    expect(result.user_id).toBe("user-2")
    expect(result.role).toBe("admin")
    expect(result.status).toBe("invited")
  })
})

describe("updateCompanyMemberProgram", () => {
  it("validates and updates a membership", async () => {
    const result = await runWithRepo(
      updateCompanyMemberProgram({
        membershipId: "membership-123",
        role: "member",
        status: "active",
      }),
    )
    expect(result.id).toBe("membership-123")
    expect(result.role).toBe("member")
    expect(result.status).toBe("active")
  })
})

describe("removeCompanyMemberProgram", () => {
  it("removes a company member successfully", async () => {
    const result = await runWithRepo(removeCompanyMemberProgram("membership-abc"))
    expect(result).toBeUndefined()
  })
})
