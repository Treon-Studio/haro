import { describe, it, expect, vi, beforeEach } from "vitest"

const mockQuery = vi.fn()
vi.mock("@/lib/neon/client", () => ({ query: (...args: unknown[]) => mockQuery(...args) }))
vi.mock("@/lib/api-helpers", () => ({ runBillingEffect: vi.fn(async () => true) }))
vi.mock("@/domain/billing/billing.programs", () => ({ checkAndIncrementQuotaProgram: vi.fn() }))

let GET: any, POST: any, DELETE: any

beforeEach(async () => {
  vi.clearAllMocks()
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })
  const mod = await import("@/pages/api/conversations")
  GET = mod.GET
  POST = mod.POST
  DELETE = mod.DELETE
})

describe("GET /api/conversations", () => {
  it("scopes by personal:<userId> for an authenticated B2C request", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ data: { id: "c1", title: "hi" } }], rowCount: 1 })
    const url = new URL("http://localhost/api/conversations")
    const res = await GET({ request: new Request(url), url, locals: { session: { userId: "u1" } } } as any)
    const body = await res.json()

    expect(mockQuery).toHaveBeenCalledWith(
      "SELECT data FROM conversations WHERE owner_key = $1 ORDER BY updated_at DESC",
      ["personal:u1"],
    )
    expect(body.conversations).toEqual([{ id: "c1", title: "hi" }])
  })

  it("scopes by personal:anonymous for an unauthenticated request", async () => {
    const url = new URL("http://localhost/api/conversations")
    await GET({ request: new Request(url), url, locals: {} } as any)
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), ["personal:anonymous"])
  })

  it("scopes by org:<companyId> and enforces active membership for B2B", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "m1" }], rowCount: 1 })
    const url = new URL("http://localhost/api/conversations?companyId=co1")
    await GET({ request: new Request(url), url, locals: { session: { userId: "u1" } } } as any)

    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      "SELECT id FROM public.company_memberships WHERE company_id = $1 AND user_id = $2 AND status = $3 LIMIT 1",
      ["co1", "u1", "active"],
    )
    expect(mockQuery).toHaveBeenNthCalledWith(2, expect.any(String), ["org:co1"])
  })

  it("returns 403 when the user is not an active member of the requested company", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    const url = new URL("http://localhost/api/conversations?companyId=co1")
    const res = await GET({ request: new Request(url), url, locals: { session: { userId: "u1" } } } as any)
    expect(res.status).toBe(403)
  })
})

describe("POST /api/conversations", () => {
  it("upserts the conversation JSON blob keyed by id, scoped by owner_key", async () => {
    const conversation = { id: "c1", title: "hi", messages: [], model: "m", provider: "p", createdAt: "2026-07-13T00:00:00Z", updatedAt: "2026-07-13T00:00:00Z" }
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // existing-check
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // insert
    const req = new Request("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({ conversation }),
    })
    const res = await POST({ request: req, locals: { session: { userId: "u1" } } } as any)

    expect(res.status).toBe(201)
    const insertCall = mockQuery.mock.calls[1]
    expect(insertCall[0]).toContain("INSERT INTO conversations")
    expect(insertCall[1]).toEqual(["c1", "personal:u1", JSON.stringify(conversation), conversation.createdAt])
  })

  it("returns 400 when conversation.id is missing", async () => {
    const req = new Request("http://localhost/api/conversations", { method: "POST", body: JSON.stringify({ conversation: {} }) })
    const res = await POST({ request: req, locals: {} } as any)
    expect(res.status).toBe(400)
  })
})

describe("DELETE /api/conversations", () => {
  it("deletes all rows scoped to the resolved owner_key", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "c1" }, { id: "c2" }], rowCount: 2 })
    const url = new URL("http://localhost/api/conversations")
    const res = await DELETE({ request: new Request(url), url, locals: { session: { userId: "u1" } } } as any)
    const body = await res.json()

    expect(mockQuery).toHaveBeenCalledWith("DELETE FROM conversations WHERE owner_key = $1 RETURNING id", ["personal:u1"])
    expect(body.deleted).toBe(2)
  })
})
