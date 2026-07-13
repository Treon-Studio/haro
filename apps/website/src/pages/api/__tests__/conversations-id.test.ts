import { describe, it, expect, vi, beforeEach } from "vitest"

const mockQuery = vi.fn()
vi.mock("@/lib/neon/client", () => ({ query: (...args: unknown[]) => mockQuery(...args) }))

let GET: any

beforeEach(async () => {
  vi.clearAllMocks()
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })
  const mod = await import("@/pages/api/conversations/[id]")
  GET = mod.GET
})

describe("GET /api/conversations/[id]", () => {
  it("returns the conversation scoped to the resolved owner_key", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ data: { id: "c1", title: "hi" } }], rowCount: 1 })
    const url = new URL("http://localhost/api/conversations/c1")
    const res = await GET({ params: { id: "c1" }, request: new Request(url), url, locals: { session: { userId: "u1" } } } as any)
    const body = await res.json()

    expect(mockQuery).toHaveBeenCalledWith("SELECT data FROM conversations WHERE id = $1 AND owner_key = $2", ["c1", "personal:u1"])
    expect(body).toEqual({ id: "c1", title: "hi" })
  })

  it("returns 404 when not found", async () => {
    const url = new URL("http://localhost/api/conversations/missing")
    const res = await GET({ params: { id: "missing" }, request: new Request(url), url, locals: {} } as any)
    expect(res.status).toBe(404)
  })

  it("returns 400 when id param is missing", async () => {
    const url = new URL("http://localhost/api/conversations/")
    const res = await GET({ params: {}, request: new Request(url), url, locals: {} } as any)
    expect(res.status).toBe(400)
  })
})
