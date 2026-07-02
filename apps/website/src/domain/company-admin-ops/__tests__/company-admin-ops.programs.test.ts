import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { ICompanyAdminOpsRepository } from "../company-admin-ops.repository"
import { getActivityLogsProgram, createSupportTicketProgram, getSupportTicketsProgram } from "../company-admin-ops.programs"
import type { TSupportTicket } from "../company-admin-ops.types"

const mockTicket: TSupportTicket = {
  id: "ticket-1",
  companyId: "company-1",
  subject: "Billing issue",
  description: "Unable to upgrade plan",
  priority: "high",
  status: "open",
  createdAt: "now",
  updatedAt: "now",
}

const mockRepo = {
  getActivityLogs: (companyId: string) => Effect.succeed([{ message: "test audit log", company_id: companyId }]),
  createSupportTicket: (companyId: string, subject: string, description: string, priority: "low" | "medium" | "high") =>
    Effect.succeed({ ...mockTicket, companyId, subject, description, priority }),
  getSupportTickets: (companyId: string) => Effect.succeed([mockTicket]),
} satisfies ICompanyAdminOpsRepository["Type"]

const runWithRepo = (effect: any): Promise<any> =>
  Effect.runPromise(effect.pipe(Effect.provideService(ICompanyAdminOpsRepository, mockRepo)))

describe("getActivityLogsProgram", () => {
  it("fetches corporate B2B activity logs", async () => {
    const result = await runWithRepo(getActivityLogsProgram("company-1"))
    expect(result).toHaveLength(1)
    expect(result[0].company_id).toBe("company-1")
    expect(result[0].message).toBe("test audit log")
  })
})

describe("createSupportTicketProgram", () => {
  it("creates a support ticket for company admin", async () => {
    const result = await runWithRepo(createSupportTicketProgram("company-1", "Upgrade plan error", "Error code X-12", "medium"))
    expect(result.company_id).toBe("company-1")
    expect(result.subject).toBe("Upgrade plan error")
    expect(result.priority).toBe("medium")
    expect(result.status).toBe("open")
  })
})

describe("getSupportTicketsProgram", () => {
  it("fetches corporate support tickets", async () => {
    const result = await runWithRepo(getSupportTicketsProgram("company-1"))
    expect(result).toHaveLength(1)
    expect(result[0].company_id).toBe("company-1")
  })
})
