import { describe, it, expect, vi, beforeEach } from "vitest"
import { jwtVerify } from "jose"

describe("mintServiceToken", () => {
  beforeEach(() => {
    vi.resetModules()
    import.meta.env.SERVICE_JWT_SECRET = "test-service-secret"
  })

  it("mints a token verifiable with the shared secret, scoped to the given tenant", async () => {
    const { mintServiceToken } = await import("../service-token")
    const token = await mintServiceToken("acme")

    const key = new TextEncoder().encode("test-service-secret")
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"], audience: "memory-fabric" })

    expect(payload.tenantSlug).toBe("acme")
    expect(payload.iss).toBe("haro-website")
    expect(typeof payload.exp).toBe("number")
    expect((payload.exp as number) - (payload.iat as number)).toBe(300)
  })

  it("rejects verification against the wrong secret", async () => {
    const { mintServiceToken } = await import("../service-token")
    const token = await mintServiceToken("acme")

    const wrongKey = new TextEncoder().encode("wrong-secret")
    await expect(jwtVerify(token, wrongKey, { algorithms: ["HS256"] })).rejects.toThrow()
  })
})
