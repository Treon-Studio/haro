import { describe, it, expect, vi, beforeEach } from "vitest"

const mockFetch = vi.fn()
global.fetch = mockFetch

describe("GET /api/vault", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    import.meta.env.MEMORY_FABRIC_URL = "http://localhost:8771"
    import.meta.env.MANAGEMENT_API_KEY = "test-key"
  })

  it("proxies to MCP vault_list", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: [{ path: "docs/file.pdf", size: 1024 }] }),
    })

    const { GET } = await import("../vault")
    const url = new URL("http://localhost:4321/api/vault?tenant=test-tenant")
    const res = await GET({ url } as any)
    const json = await res.json()

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/tool"),
      expect.objectContaining({
        body: expect.stringContaining("vault_list"),
      }),
    )
    expect(json.success).toBe(true)
  })
})
