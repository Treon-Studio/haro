import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/memory-fabric", () => ({
  callMemoryTool: vi.fn(),
}))

let mockCallMemoryTool: ReturnType<typeof vi.fn>
let GET: any, DELETE: any

beforeEach(async () => {
  vi.clearAllMocks()
  const memoryFabric = await import("@/lib/memory-fabric")
  mockCallMemoryTool = memoryFabric.callMemoryTool as any
  const mod = await import("@/pages/api/memories")
  GET = mod.GET
  DELETE = mod.DELETE
})

describe("GET /api/memories", () => {
  it("proxies search to MCP memory_search", async () => {
    mockCallMemoryTool.mockResolvedValueOnce({ rows: [{ id: "1", content: "test" }], total: 1 })

    const url = new URL("http://localhost/api/memories?search=hello&limit=10&offset=0")
    const response = await GET({ url })
    const body = await response.json()

    expect(mockCallMemoryTool).toHaveBeenCalledWith("memory_search", {
      tenant: "default",
      query: "hello",
      limit: 10,
      offset: 0,
    })
    expect(body.success).toBe(true)
    expect(body.data).toEqual({ rows: [{ id: "1", content: "test" }], total: 1 })
  })

  it("passes tenant param through", async () => {
    mockCallMemoryTool.mockResolvedValueOnce({ rows: [] })

    const url = new URL("http://localhost/api/memories?tenant=custom-tenant")
    await GET({ url })

    expect(mockCallMemoryTool).toHaveBeenCalledWith(
      "memory_search",
      expect.objectContaining({ tenant: "custom-tenant" }),
    )
  })

  it("returns 500 when callMemoryTool throws", async () => {
    mockCallMemoryTool.mockRejectedValueOnce(new Error("connection refused"))

    const url = new URL("http://localhost/api/memories")
    const response = await GET({ url })
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.error).toBe("connection refused")
  })
})

describe("DELETE /api/memories", () => {
  it("calls memory_delete with id and tenant", async () => {
    mockCallMemoryTool.mockResolvedValueOnce({ success: true })

    const url = new URL("http://localhost/api/memories?id=mem_123&tenant=foo")
    const response = await DELETE({ url })
    const body = await response.json()

    expect(mockCallMemoryTool).toHaveBeenCalledWith("memory_delete", {
      tenant: "foo",
      memory_id: "mem_123",
    })
    expect(body.success).toBe(true)
  })

  it("returns 400 when id is missing", async () => {
    const url = new URL("http://localhost/api/memories")
    const response = await DELETE({ url })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error).toBe("Missing id parameter")
  })
})
