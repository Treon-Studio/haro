import { describe, it, expect, vi } from "vitest"
import { Effect, pipe } from "effect"
import { runTraced } from "../run-traced"
import { makeLogger } from "../logger.service"

describe("runTraced", () => {
  it("runs a successful effect and logs completion", async () => {
    const writer = vi.fn()
    const logger = makeLogger({ environment: "development", writers: { console: writer } })
    const result = await runTraced("test-span", logger, Effect.succeed(42))
    expect(result).toBe(42)
    const logCalls = writer.mock.calls.map((c: any[]) => c[0])
    expect(logCalls.some((e: any) => e.message.includes("span:test-span completed"))).toBe(true)
  })

  it("rejects on effect failure", async () => {
    const writer = vi.fn()
    const logger = makeLogger({ environment: "development", writers: { console: writer } })
    await expect(
      runTraced("failing-span", logger, Effect.fail("boom")),
    ).rejects.toThrow()
    const logCalls = writer.mock.calls.map((c: any[]) => c[0])
    expect(logCalls.some((e: any) => e.message.includes("span:failing-span failed"))).toBe(true)
  })
})
