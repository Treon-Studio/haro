import { describe, it, expect } from "vitest"
import { jwtVerify } from "jose"
import { mintServiceToken } from "../service-token"

describe("mintServiceToken (apps/mcp)", () => {
  it("mints a token verifiable with the given secret, scoped to the given tenant", async () => {
    const token = await mintServiceToken("acme", "test-secret")
    const key = new TextEncoder().encode("test-secret")
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"], audience: "memory-fabric" })

    expect(payload.tenantSlug).toBe("acme")
    expect(payload.iss).toBe("haro-mcp")
  })
})
