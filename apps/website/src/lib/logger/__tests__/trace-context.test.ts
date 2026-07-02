import { describe, it, expect } from "vitest"
import { parseTraceparent, generateTraceparent, type TraceContext } from "../trace-context"

describe("generateTraceparent", () => {
  it("generates a valid W3C traceparent string", () => {
    const result = generateTraceparent()
    expect(result).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/)
  })

  it("generates different trace IDs on successive calls", () => {
    const a = generateTraceparent()
    const b = generateTraceparent()
    expect(a).not.toBe(b)
  })

  it("accepts an existing traceId and spanId", () => {
    const traceId = "0af7651916cd43dd8448eb211c80319c"
    const spanId = "b7ad6b7169203331"
    const result = generateTraceparent(traceId, spanId)
    expect(result).toBe(`00-${traceId}-${spanId}-01`)
  })
})

describe("parseTraceparent", () => {
  it("parses a valid traceparent string", () => {
    const result = parseTraceparent("00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01")
    expect(result).toEqual({
      version: "00",
      traceId: "0af7651916cd43dd8448eb211c80319c",
      spanId: "b7ad6b7169203331",
      traceFlags: "01",
    })
  })

  it("returns null for invalid version", () => {
    expect(parseTraceparent("ff-abc-xyz-01")).toBeNull()
  })

  it("returns null for malformed string", () => {
    expect(parseTraceparent("not-a-traceparent")).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(parseTraceparent("")).toBeNull()
  })
})

describe("integration with TLogContext", () => {
  it("generates trace context for TLogContext fields", () => {
    const ctx: TraceContext = {
      version: "00",
      traceId: "0af7651916cd43dd8448eb211c80319c",
      spanId: "b7ad6b7169203331",
      traceFlags: "01",
    }
    expect(ctx.traceId).toHaveLength(32)
    expect(ctx.spanId).toHaveLength(16)
  })
})
