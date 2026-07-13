import { describe, it, expect, vi, beforeEach } from "vitest"
import { MemoryFabricService } from "../memory-fabric-service"

const mockFetch = vi.fn()
global.fetch = mockFetch as any

describe("MemoryFabricService auth", () => {
  beforeEach(() => vi.clearAllMocks())

  it("mints a token for the call's tenant and sends it as Bearer auth", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ result: "ok" }) })
    const mintToken = vi.fn(async (tenantSlug: string) => `token-for-${tenantSlug}`)
    const service = new MemoryFabricService({ baseUrl: "http://localhost:8771", mintToken })

    await service.memorySearch({ tenant: "acme", query: "hi" })

    expect(mintToken).toHaveBeenCalledWith("acme")
    const [, init] = mockFetch.mock.calls[0]
    expect(init.headers.Authorization).toBe("Bearer token-for-acme")
  })

  it("sends no Authorization header when no mintToken is configured", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ result: "ok" }) })
    const service = new MemoryFabricService({ baseUrl: "http://localhost:8771" })

    await service.memorySearch({ tenant: "acme", query: "hi" })

    const [, init] = mockFetch.mock.calls[0]
    expect(init.headers.Authorization).toBeUndefined()
  })
})
