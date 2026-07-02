import { describe, it, expect, vi } from "vitest"
import { auditAction, auditEntity } from "../audit"
import { makeLogger } from "../logger.service"

describe("auditAction", () => {
  it("logs an audit event via the logger", () => {
    const writer = vi.fn()
    const logger = makeLogger({ environment: "production", writers: { audit_log: writer } })
    auditAction(logger, "company.suspended", "company", "comp_1", { reason: "non-payment" })
    expect(writer).toHaveBeenCalledTimes(1)
    const entry = writer.mock.calls[0][0]
    expect(entry.level).toBe("audit")
    expect(entry.message).toBe("company.suspended")
    expect(entry.context).toMatchObject({
      action: "company.suspended",
      resourceType: "company",
      resourceId: "comp_1",
      reason: "non-payment",
    })
  })

  it("includes userId in context when provided", () => {
    const writer = vi.fn()
    const logger = makeLogger({ environment: "development", writers: { audit_log: writer } })
    auditAction(logger, "user.role_changed", "user", "usr_2", { changedBy: "usr_1" })
    const entry = writer.mock.calls[0][0]
    expect(entry.context.changedBy).toBe("usr_1")
  })

  it("uses audit destination regardless of logger env config", () => {
    const writer = vi.fn()
    const logger = makeLogger({ environment: "development", writers: { audit_log: writer } })
    auditAction(logger, "test.event", "test", "t_1")
    expect(writer).toHaveBeenCalledTimes(1)
  })

  it("redacts PII from audit context", () => {
    const writer = vi.fn()
    const logger = makeLogger({ environment: "development", writers: { audit_log: writer } })
    auditAction(logger, "user.updated", "user", "usr_3", { email: "secret@example.com" })
    const entry = writer.mock.calls[0][0]
    expect(entry.context.email).toBe("[REDACTED]")
  })
})

describe("auditEntity", () => {
  it("logs entity creation", () => {
    const writer = vi.fn()
    const logger = makeLogger({ environment: "production", writers: { audit_log: writer } })
    auditEntity(logger, "create", "company", "comp_1", { name: "Acme Inc" })
    const entry = writer.mock.calls[0][0]
    expect(entry.level).toBe("audit")
    expect(entry.message).toBe("company.create")
    expect(entry.context.resourceId).toBe("comp_1")
    expect(entry.context.changes).toEqual({ name: "Acme Inc" })
  })

  it("logs entity update with before/after", () => {
    const writer = vi.fn()
    const logger = makeLogger({ environment: "production", writers: { audit_log: writer } })
    auditEntity(logger, "update", "company", "comp_1", { name: { from: "Old Co", to: "New Co" } })
    const entry = writer.mock.calls[0][0]
    expect(entry.context.changes).toEqual({ name: { from: "Old Co", to: "New Co" } })
  })

  it("logs entity deletion", () => {
    const writer = vi.fn()
    const logger = makeLogger({ environment: "production", writers: { audit_log: writer } })
    auditEntity(logger, "delete", "user", "usr_99")
    const entry = writer.mock.calls[0][0]
    expect(entry.message).toBe("user.delete")
    expect(entry.context.resourceId).toBe("usr_99")
  })
})
