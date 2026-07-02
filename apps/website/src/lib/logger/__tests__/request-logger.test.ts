import { describe, it, expect, vi } from "vitest"
import { makeRequestLogger } from "../request-logger"
import { makeLogger } from "../logger.service"

describe("makeRequestLogger", () => {
  it("returns a logger and a log function", () => {
    const { logger, logRequest } = makeRequestLogger("GET", "/api/test")
    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe("function")
    expect(typeof logRequest).toBe("function")
  })

  it("includes requestId in logger context", () => {
    const { logger } = makeRequestLogger("POST", "/api/users", "req-abc-123")
    const child = logger.child({})
    expect(child).toBeDefined()
  })

  it("logRequest logs start message", () => {
    const writer = vi.fn()
    const envLogger = makeLogger({ environment: "development", writers: { console: writer } })
    const { logRequest } = makeRequestLogger("GET", "/api/test", "req-1", envLogger)
    logRequest()
    const entry = writer.mock.calls[0][0]
    expect(entry.message).toContain("GET /api/test")
    expect(entry.context.requestId).toBe("req-1")
  })

  it("logComplete logs duration and status", () => {
    const writer = vi.fn()
    const envLogger = makeLogger({ environment: "development", writers: { console: writer } })
    const { logComplete } = makeRequestLogger("DELETE", "/api/items/1", "req-2", envLogger)
    logComplete(204)
    const entry = writer.mock.calls[0][0]
    expect(entry.message).toContain("DELETE /api/items/1")
    expect(entry.context.statusCode).toBe(204)
    expect(entry.context.durationMs).toBeGreaterThanOrEqual(0)
  })

  it("logError logs error details", () => {
    const writer = vi.fn()
    const envLogger = makeLogger({ environment: "development", writers: { console: writer } })
    const { logError } = makeRequestLogger("PUT", "/api/data", "req-3", envLogger)
    logError(new Error("something broke"))
    const entry = writer.mock.calls[0][0]
    expect(entry.level).toBe("error")
    expect(entry.message).toContain("PUT /api/data")
    expect(entry.error).toBeDefined()
    expect(entry.error?.message).toBe("something broke")
    expect(entry.context.requestId).toBe("req-3")
  })
})
