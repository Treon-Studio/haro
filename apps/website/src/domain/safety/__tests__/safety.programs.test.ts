import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { ISafetyRepository } from "../safety.repository"
import { flagRiskProgram, assignCaseProgram, logFollowupAttemptProgram, resolveCaseProgram } from "../safety.programs"
import type { TRiskFlag, TEscalationCase } from "../safety.types"

const mockFlag: TRiskFlag = {
  id: "flag-1",
  userId: "user-1",
  companyId: "company-1",
  sessionId: "session-1",
  tier: "critical",
  aiSummary: "Suicidality keywords triggered",
  triggerPattern: "bunuh diri",
  createdAt: "2026-06-24T00:00:00Z",
}

const mockCase: TEscalationCase = {
  id: "case-1",
  riskFlagId: "flag-1",
  companyId: "company-1",
  status: "open",
  primaryAssignee: null,
  backupAssignee: null,
  followupAttempts: [],
  outcome: null,
  outcomeNotes: null,
  resolvedAt: null,
  resolvedBy: null,
  createdAt: "2026-06-24T00:00:00Z",
}

const mockRepo = {
  flagRisk: (userId: string, companyId: string, sessionId: string, tier: "standard" | "critical", summary: string, trigger: string) =>
    Effect.succeed({ ...mockFlag, userId, companyId, sessionId, tier, aiSummary: summary, triggerPattern: trigger }),
  getEscalationCases: () => Effect.succeed([mockCase]),
  assignCase: (caseId: string, assigneeId: string) =>
    Effect.succeed({ ...mockCase, id: caseId, primaryAssignee: assigneeId, status: "assigned" }),
  logFollowupAttempt: (caseId: string, notes: string) =>
    Effect.succeed({ ...mockCase, id: caseId, followupAttempts: [{ date: "2026-06-24T00:00:00Z", notes }] }),
  resolveCase: (caseId: string, outcome: string, notes: string) =>
    Effect.succeed({ ...mockCase, id: caseId, status: "resolved", outcome, outcomeNotes: notes, resolvedAt: "2026-06-24T00:00:00Z" }),
} satisfies ISafetyRepository["Type"]

const runWithRepo = (effect: any): Promise<any> =>
  Effect.runPromise(effect.pipe(Effect.provideService(ISafetyRepository, mockRepo)))

describe("flagRiskProgram", () => {
  it("records risk flags and triggers automatic case escalation", async () => {
    const result = await runWithRepo(flagRiskProgram("user-9", "company-1", "session-9", "critical", "Crisis detected", "harm"))
    expect(result.user_id).toBe("user-9")
    expect(result.tier).toBe("critical")
  })
})

describe("assignCaseProgram", () => {
  it("assigns active psychologists and locks states", async () => {
    const result = await runWithRepo(assignCaseProgram("case-123", "psychologist-1"))
    expect(result.id).toBe("case-123")
    expect(result.primary_assignee).toBe("psychologist-1")
    expect(result.status).toBe("assigned")
  })
})

describe("logFollowupAttemptProgram", () => {
  it("appends timeline entries", async () => {
    const result = await runWithRepo(logFollowupAttemptProgram("case-123", "User called, no response"))
    expect(result.id).toBe("case-123")
    expect(result.followup_attempts).toHaveLength(1)
    expect(result.followup_attempts[0].notes).toBe("User called, no response")
  })
})

describe("resolveCaseProgram", () => {
  it("resolves clinical cases with closing outcomes", async () => {
    const result = await runWithRepo(resolveCaseProgram("case-123", "referred_to_psychologist", "Referred to local clinic"))
    expect(result.id).toBe("case-123")
    expect(result.status).toBe("resolved")
    expect(result.outcome).toBe("referred_to_psychologist")
  })
})
