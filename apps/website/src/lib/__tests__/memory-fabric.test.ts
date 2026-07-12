import { describe, it, expect, vi, beforeEach } from "vitest"

const mockFetch = vi.fn()
global.fetch = mockFetch

describe("memory-fabric client", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    import.meta.env.MEMORY_FABRIC_URL = "http://localhost:8771"
    import.meta.env.MANAGEMENT_API_KEY = "test-key"
  })

  it("callMemoryTool sends correct request", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { status: "ok" } }),
    })

    const { callMemoryTool } = await import("@/lib/memory-fabric")
    const result = await callMemoryTool("fabric_health", { tenant: "test" })

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8771/api/tool",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: expect.stringContaining("fabric_health"),
      }),
    )
    expect(result).toEqual({ result: { status: "ok" } })
  })
})
