import { describe, it, expect } from "vitest"
import { redactFields, type PiiField } from "../pii"

describe("redactFields", () => {
  it("redacts single known PII field", () => {
    const result = redactFields({ email: "user@example.com" })
    expect(result.email).toBe("[REDACTED]")
  })

  it("redacts multiple PII fields", () => {
    const result = redactFields({
      email: "user@example.com",
      phone: "+1-555-1234",
      ssn: "123-45-6789",
    })
    expect(result).toEqual({
      email: "[REDACTED]",
      phone: "[REDACTED]",
      ssn: "[REDACTED]",
    })
  })

  it("redacts all known PII fields", () => {
    const input: Record<string, unknown> = {
      email: "a@b.com",
      phone: "555",
      ssn: "123",
      creditCard: "4111-1111-1111-1111",
      taxId: "12-3456789",
      fullName: "John Doe",
      address: "123 Main St",
      dob: "1990-01-01",
      ipAddress: "192.168.1.1",
      authToken: "tok_abc123",
      sessionToken: "sess_xyz",
      password: "hunter2",
      apiKey: "sk-abc123",
    }
    const result = redactFields(input)
    for (const key of Object.keys(input)) {
      expect(result[key]).toBe("[REDACTED]")
    }
  })

  it("preserves non-PII fields unchanged", () => {
    const result = redactFields({
      userId: "usr_abc",
      companyId: "comp_xyz",
      message: "User logged in",
    })
    expect(result).toEqual({
      userId: "usr_abc",
      companyId: "comp_xyz",
      message: "User logged in",
    })
  })

  it("handles nested objects (recursive)", () => {
    const result = redactFields({
      user: {
        email: "a@b.com",
        profile: { fullName: "John", ssn: "123-45-6789" },
      },
      action: "update",
    })
    expect((result as any).user.email).toBe("[REDACTED]")
    expect((result as any).user.profile.fullName).toBe("[REDACTED]")
    expect((result as any).user.profile.ssn).toBe("[REDACTED]")
    expect((result as any).action).toBe("update")
  })

  it("handles arrays of objects", () => {
    const result = redactFields({
      users: [
        { email: "a@b.com" },
        { email: "c@d.com", fullName: "Jane" },
      ],
    })
    expect((result as any).users[0].email).toBe("[REDACTED]")
    expect((result as any).users[1].email).toBe("[REDACTED]")
    expect((result as any).users[1].fullName).toBe("[REDACTED]")
  })

  it("does not mutate the original object", () => {
    const input = { email: "a@b.com", message: "hello" }
    const result = redactFields(input)
    expect(input.email).toBe("a@b.com")
    expect(result).not.toBe(input)
  })

  it("returns empty object when given empty object", () => {
    expect(redactFields({})).toEqual({})
  })

  it("handles null and undefined values", () => {
    const result = redactFields({ email: null, phone: undefined })
    expect(result.email).toBe("[REDACTED]")
    expect(result.phone).toBe("[REDACTED]")
  })

  it("redacts fields regardless of case (case-insensitive)", () => {
    const result = redactFields({
      Email: "a@b.com",
      FULLNAME: "John",
      "credit_card": "4111",
    })
    expect(result.Email).toBe("[REDACTED]")
    expect(result.FULLNAME).toBe("[REDACTED]")
    expect((result as any)["credit_card"]).toBe("[REDACTED]")
  })
})
