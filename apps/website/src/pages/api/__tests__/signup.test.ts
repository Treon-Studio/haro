import { describe, it, expect, vi, beforeEach } from "vitest"
import { Effect } from "effect"

vi.mock("@/domain/auth/auth.programs", () => ({
  signUpProgram: vi.fn(),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch as any

const organicDto = {
  user: { id: "user-1", email: "user@example.com", full_name: "Jane Doe" },
  session: { id: "session-1", user_id: "user-1", expires_at: "2027-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z" },
}

const invitedDto = {
  user: { id: "user-2", email: "invitee@example.com", full_name: "Invitee User" },
  session: { id: "session-2", user_id: "user-2", expires_at: "2027-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z" },
  company_id: "company-abc",
  company_name: "Acme Inc",
}

const fakeContext = () => ({
  request: { json: async () => ({ email: "user@example.com", password: "password123" }) },
  locals: {},
}) as any

const jsonResponse = (body: unknown, init?: { status?: number }) =>
  ({ ok: (init?.status ?? 200) < 300, status: init?.status ?? 200, json: async () => body }) as any

describe("POST /api/auth/signup", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    import.meta.env.MEMORY_FABRIC_URL = "http://localhost:8771"
    import.meta.env.MANAGEMENT_API_KEY = "test-key"
    const authPrograms = await import("@/domain/auth/auth.programs")
    ;(authPrograms.signUpProgram as any).mockReturnValue(Effect.succeed(organicDto))
  })

  it("provisions a personal tenant (keyed to user.id) for an organic signup", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true, data: { slug: "jane-doe" } }, { status: 201 }))

    const { POST } = await import("../auth/signup")
    const res = await POST(fakeContext())
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain("/api/tenants/provision")
    const sentBody = JSON.parse(init.body)
    expect(sentBody.company_id).toBe("user-1")
    expect(sentBody.created_by).toBe("user-1")
  })

  it("provisions the invitation's real company tenant for an invited signup", async () => {
    const authPrograms = await import("@/domain/auth/auth.programs")
    ;(authPrograms.signUpProgram as any).mockReturnValue(Effect.succeed(invitedDto))
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true, data: { slug: "acme-inc" } }, { status: 201 }))

    const { POST } = await import("../auth/signup")
    const res = await POST(fakeContext())
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, init] = mockFetch.mock.calls[0]
    const sentBody = JSON.parse(init.body)
    expect(sentBody.company_id).toBe("company-abc")
    expect(sentBody.name).toBe("Acme Inc")
    expect(sentBody.created_by).toBe("user-2")
  })

  it("does not error when the invited company's tenant was already provisioned (no duplicate)", async () => {
    const authPrograms = await import("@/domain/auth/auth.programs")
    ;(authPrograms.signUpProgram as any).mockReturnValue(Effect.succeed(invitedDto))
    mockFetch.mockResolvedValueOnce(
      jsonResponse(
        { success: false, error: { code: "TENANT_SLUG_EXISTS", message: "Tenant 'acme-inc' already exists with status 'active'" } },
        { status: 409 },
      ),
    )

    const { POST } = await import("../auth/signup")
    const res = await POST(fakeContext())
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("fails the signup request loudly when tenant provisioning fails", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: false, error: { code: "INTERNAL_ERROR", message: "VPS unreachable" } }, { status: 500 }),
    )

    const { POST } = await import("../auth/signup")
    const res = await POST(fakeContext())
    const body = await res.json()

    expect(res.status).not.toBe(201)
    expect(body.success).toBe(false)
  })

  it("skips provisioning when MANAGEMENT_API_KEY is not configured", async () => {
    import.meta.env.MANAGEMENT_API_KEY = ""

    const { POST } = await import("../auth/signup")
    const res = await POST(fakeContext())
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
