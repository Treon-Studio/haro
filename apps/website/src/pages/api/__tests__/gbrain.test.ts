import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/memory-fabric", () => ({
  callMemoryTool: vi.fn(),
}))

let mockCallMemoryTool: ReturnType<typeof vi.fn>
let GET: any

beforeEach(async () => {
  vi.clearAllMocks()
  const memoryFabric = await import("@/lib/memory-fabric")
  mockCallMemoryTool = memoryFabric.callMemoryTool as any
  const mod = await import("@/pages/api/gbrain")
  GET = mod.GET
})

describe("GET /api/gbrain", () => {
  it("proxies to MCP gbrain_list", async () => {
    mockCallMemoryTool.mockResolvedValueOnce({
      result: [{ slug: "test", title: "Test Page" }],
    })

    const url = new URL("http://localhost/api/gbrain")
    const response = await GET({ url, locals: { session: { tenantSlug: "test-tenant" } } })
    const body = await response.json()

    expect(mockCallMemoryTool).toHaveBeenCalledWith("test-tenant", "gbrain_list", {
      tenant: "test-tenant",
    })
    expect(body.success).toBe(true)
  })

  it("uses default tenant when none provided", async () => {
    mockCallMemoryTool.mockResolvedValueOnce({ result: [] })

    const url = new URL("http://localhost/api/gbrain")
    const response = await GET({ url, locals: {} })
    const body = await response.json()

    expect(mockCallMemoryTool).toHaveBeenCalledWith("default", "gbrain_list", {
      tenant: "default",
    })
    expect(body.success).toBe(true)
  })

  it("returns 500 when callMemoryTool throws", async () => {
    mockCallMemoryTool.mockRejectedValueOnce(new Error("connection refused"))

    const url = new URL("http://localhost/api/gbrain")
    const response = await GET({ url, locals: {} })
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.error).toBe("connection refused")
  })
})
