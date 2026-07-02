import { describe, it, expect, vi } from "vitest"
import { Effect } from "effect"
import { IInvitationsRepository } from "../invitations.repository"
import {
  createInvitationProgram,
  getInvitationsProgram,
  verifyInvitationTokenProgram,
  acceptInvitationProgram,
  previewBulkInviteProgram,
  bulkInviteProgram,
  hashToken,
} from "../invitations.programs"
import type { TInvitation } from "../invitations.types"

const mockInvitation: TInvitation = {
  id: "invitation-1",
  companyId: "company-1",
  email: "employee@acme.com",
  role: "member",
  tokenHash: hashToken("raw-token-123"),
  invitedBy: "admin-1",
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
  status: "pending",
  acceptedAt: null,
  createdAt: new Date().toISOString(),
}

const mockRepo = {
  createInvitation: (companyId: string, email: string, role: "owner" | "admin" | "member", tokenHash: string, expiresAt: string) =>
    Effect.succeed({
      ...mockInvitation,
      companyId,
      email,
      role,
      tokenHash,
      expiresAt,
    }),
  getInvitations: (companyId: string) => Effect.succeed([{ ...mockInvitation, companyId }]),
  verifyInvitation: (tokenHash: string) => {
    if (tokenHash === hashToken("raw-token-123")) return Effect.succeed(mockInvitation)
    return Effect.fail(new Error("Token invalid") as any)
  },
  acceptInvitation: (id: string, userId: string) =>
    Effect.succeed({
      ...mockInvitation,
      id,
      status: "accepted",
      acceptedAt: new Date().toISOString(),
    }),
  revokeInvitation: (_id: string) => Effect.void,
} satisfies IInvitationsRepository["Type"]

const runWithRepo = <A, E>(effect: Effect.Effect<A, E, IInvitationsRepository>): Promise<A> =>
  Effect.runPromise(effect.pipe(Effect.provideService(IInvitationsRepository, mockRepo)))

describe("createInvitationProgram", () => {
  it("validates and creates a single invitation with raw token", async () => {
    const result = await runWithRepo(
      createInvitationProgram({
        companyId: "company-xyz",
        email: "elon@spacex.com",
        role: "admin",
      }),
    )
    expect(result.company_id).toBe("company-xyz")
    expect(result.email).toBe("elon@spacex.com")
    expect(result.role).toBe("admin")
    expect(result.raw_token).toBeDefined()
    expect(result.token_hash).toBe(hashToken(result.raw_token))
  })

  it("fails on invalid email format", async () => {
    await expect(
      runWithRepo(
        createInvitationProgram({
          companyId: "company-xyz",
          email: "not-an-email",
          role: "member",
        }),
      ),
    ).rejects.toThrow()
  })
})

describe("verifyInvitationTokenProgram", () => {
  it("verifies a valid unhashed token", async () => {
    const result = await runWithRepo(verifyInvitationTokenProgram("raw-token-123"))
    expect(result.id).toBe("invitation-1")
    expect(result.email).toBe("employee@acme.com")
    expect(result.status).toBe("pending")
  })

  it("fails on invalid token", async () => {
    await expect(runWithRepo(verifyInvitationTokenProgram("wrong-token"))).rejects.toThrow()
  })
})

describe("acceptInvitationProgram", () => {
  it("accepts a pending invitation and returns accepted dto", async () => {
    const result = await runWithRepo(
      acceptInvitationProgram({
        token: "raw-token-123",
        userId: "user-99",
      }),
    )
    expect(result.id).toBe("invitation-1")
    expect(result.status).toBe("accepted")
    expect(result.accepted_at).toBeDefined()
  })
})

describe("previewBulkInviteProgram", () => {
  it("previews a valid CSV without anomalies", async () => {
    const csv = "email,role\nelon@spacex.com,admin\ngwynne@spacex.com,member"
    const result = await Effect.runPromise(previewBulkInviteProgram("company-1", csv))
    expect(result.total_count).toBe(2)
    expect(result.anomalies_count).toBe(0)
    expect(result.preview_rows[0].email).toBe("elon@spacex.com")
    expect(result.preview_rows[0].role).toBe("admin")
    expect(result.preview_rows[0].valid).toBe(true)
  })

  it("detects email formatting anomalies in dry-run preview", async () => {
    const csv = "email,role\nvalid@domain.com,member\ninvalid-email,member"
    const result = await Effect.runPromise(previewBulkInviteProgram("company-1", csv))
    expect(result.total_count).toBe(2)
    expect(result.anomalies_count).toBe(1)
    expect(result.preview_rows[1].email).toBe("invalid-email")
    expect(result.preview_rows[1].valid).toBe(false)
    expect(result.preview_rows[1].error).toBeDefined()
  })
})

describe("bulkInviteProgram", () => {
  it("processes bulk invitations successfully", async () => {
    const csv = "email,role\na@b.com,member\nb@c.com,admin"
    const result = await runWithRepo(bulkInviteProgram("company-1", csv))
    expect(result).toHaveLength(2)
    expect(result[0].email).toBe("a@b.com")
    expect(result[0].status).toBe("success")
    expect(result[1].email).toBe("b@c.com")
    expect(result[1].status).toBe("success")
  })

  it("records errors for rows with malformed emails", async () => {
    const csv = "email,role\na@b.com,member\nbad-row,admin"
    const result = await runWithRepo(bulkInviteProgram("company-1", csv))
    expect(result).toHaveLength(2)
    expect(result[0].status).toBe("success")
    expect(result[1].email).toBe("bad-row")
    expect(result[1].status).toBe("error")
    expect(result[1].error_message).toBe("Format email tidak valid")
  })
})
