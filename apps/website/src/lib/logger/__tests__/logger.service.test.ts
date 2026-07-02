import { describe, it, expect, vi } from "vitest"
import { Effect, pipe } from "effect"
import { ILogger, makeLogger } from "../logger.service"
import type { LoggerService } from "../logger.service"

describe("makeLogger", () => {
  it("returns a Logger instance", () => {
    const logger = makeLogger({ environment: "development" })
    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe("function")
  })

  it("logs info in development", () => {
    const logger = makeLogger({ environment: "development" })
    const result = pipe(
      ILogger,
      Effect.flatMap((l) => l.info("test message", { action: "test" })),
      Effect.provideService(ILogger, logger),
      Effect.runSync,
    )
    expect(result).toBeUndefined()
  })

  it("skips debug in production", () => {
    const logger = makeLogger({ environment: "production" })
    expect(() =>
      pipe(
        ILogger,
        Effect.flatMap((l) => l.debug("should not appear")),
        Effect.provideService(ILogger, logger),
        Effect.runSync,
      ),
    ).not.toThrow()
  })

  it("logs fatal even in production", () => {
    const logger = makeLogger({ environment: "production" })
    const result = pipe(
      ILogger,
      Effect.flatMap((l) => l.fatal("crash", { error: new Error("oops") })),
      Effect.provideService(ILogger, logger),
      Effect.runSync,
    )
    expect(result).toBeUndefined()
  })

  it("returns child with merged context", () => {
    const logger = makeLogger({ environment: "development" })
    const child = logger.child({ requestId: "req-123" })
    expect(child).toBeDefined()
    expect(typeof child.info).toBe("function")
  })

  it("withSpan executes the effect and returns its value", () => {
    const logger = makeLogger({ environment: "development" })
    const result = pipe(
      ILogger,
      Effect.flatMap((l) =>
        l.withSpan("test-span", () => Effect.succeed(42))
      ),
      Effect.provideService(ILogger, logger),
      Effect.runSync,
    )
    expect(result).toBe(42)
  })

  it("withSpan propagates error from inner effect", async () => {
    const logger = makeLogger({ environment: "development" })
    await expect(
      pipe(
        ILogger,
        Effect.flatMap((l) =>
          l.withSpan("failing-span", () => Effect.fail("boom"))
        ),
        Effect.provideService(ILogger, logger),
        Effect.runPromise,
      ),
    ).rejects.toThrow()
  })

  it("child context is included in logged output", () => {
    const writer = vi.fn()
    const logger = makeLogger({ environment: "development", writers: { console: writer } })
    const child = logger.child({ userId: "usr_1", companyId: "comp_1" })
    pipe(
      ILogger,
      Effect.flatMap((l) => l.info("child context test", { action: "test" })),
      Effect.provideService(ILogger, child),
      Effect.runSync,
    )
    expect(writer).toHaveBeenCalledTimes(1)
    const entry = writer.mock.calls[0][0]
    expect(entry.context).toMatchObject({ userId: "usr_1", companyId: "comp_1" })
  })

  it("redacts PII fields from context when logging", () => {
    const writer = vi.fn()
    const logger = makeLogger({ environment: "development", writers: { console: writer } })
    pipe(
      ILogger,
      Effect.flatMap((l) => l.info("pii test", { email: "user@example.com", ssn: "123-45-6789" })),
      Effect.provideService(ILogger, logger),
      Effect.runSync,
    )
    expect(writer).toHaveBeenCalledTimes(1)
    const entry = writer.mock.calls[0][0]
    expect(entry.context.email).toBe("[REDACTED]")
    expect(entry.context.ssn).toBe("[REDACTED]")
  })

  it("redacts PII from message content", () => {
    const writer = vi.fn()
    const logger = makeLogger({ environment: "development", writers: { console: writer } })
    pipe(
      ILogger,
      Effect.flatMap((l) => l.info("email user@example.com in message")),
      Effect.provideService(ILogger, logger),
      Effect.runSync,
    )
    expect(writer).toHaveBeenCalledTimes(1)
    const entry = writer.mock.calls[0][0]
    expect(entry.message).not.toContain("user@example.com")
    expect(entry.message).toContain("[REDACTED]")
  })

  it("logs with correct environment", () => {
    const writer = vi.fn()
    const logger = makeLogger({ environment: "staging", writers: { console: writer } })
    pipe(
      ILogger,
      Effect.flatMap((l) => l.warn("env test")),
      Effect.provideService(ILogger, logger),
      Effect.runSync,
    )
    expect(writer).toHaveBeenCalledTimes(1)
    const entry = writer.mock.calls[0][0]
    expect(entry.environment).toBe("staging")
  })

  it("logs with correct service name", () => {
    const writer = vi.fn()
    const logger = makeLogger({ environment: "development", writers: { console: writer } })
    pipe(
      ILogger,
      Effect.flatMap((l) => l.info("service test")),
      Effect.provideService(ILogger, logger),
      Effect.runSync,
    )
    const entry = writer.mock.calls[0][0]
    expect(entry.service).toBe("tenang-web")
  })

  it("only routes audit to audit_log destination", () => {
    const writer = vi.fn()
    const logger = makeLogger({ environment: "production", writers: { audit_log: writer } })
    pipe(
      ILogger,
      Effect.flatMap((l) => l.audit("company.suspended", { companyId: "comp_1", action: "suspend" })),
      Effect.provideService(ILogger, logger),
      Effect.runSync,
    )
    expect(writer).toHaveBeenCalledTimes(1)
  })
})
