import { describe, it, expect, vi, beforeEach } from "vitest"

const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock("@/lib/auth/service-token", () => ({
  mintServiceToken: vi.fn(async (tenantSlug: string) => `mock-token-for-${tenantSlug}`),
}))

describe("memory-fabric client", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    import.meta.env.MEMORY_FABRIC_URL = "http://localhost:8771"
  })

  it("callMemoryTool mints a tenant-scoped token and sends it as Bearer auth", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { status: "ok" } }),
    })

    const { callMemoryTool } = await import("@/lib/memory-fabric")
    const result = await callMemoryTool("test", "fabric_health", {})

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8771/api/tool",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer mock-token-for-test",
        }),
        body: expect.stringContaining("fabric_health"),
      }),
    )
    expect(result).toEqual({ result: { status: "ok" } })
  })

  it("forwards the resolved tenant into args even if not passed explicitly", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ result: [] }) })
    const { callMemoryTool } = await import("@/lib/memory-fabric")
    await callMemoryTool("acme", "memory_search", { query: "hi" })

    const [, init] = mockFetch.mock.calls[0]
    const sentBody = JSON.parse(init.body)
    expect(sentBody.args.tenant).toBe("acme")
  })
})
