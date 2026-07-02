import { describe, it, expect } from "vitest"
import { redactContent } from "../pii"

describe("redactContent", () => {
  it("redacts email addresses", () => {
    expect(redactContent("user email is user@example.com")).toBe("user email is [REDACTED]")
  })

  it("redacts multiple emails in same string", () => {
    expect(redactContent("a@b.com and c@d.com")).toBe("[REDACTED] and [REDACTED]")
  })

  it("redacts US phone numbers (xxx-xxx-xxxx)", () => {
    expect(redactContent("call 555-123-4567 now")).toBe("call [REDACTED] now")
  })

  it("redacts SSNs (xxx-xx-xxxx)", () => {
    expect(redactContent("SSN is 123-45-6789")).toBe("SSN is [REDACTED]")
  })

  it("redacts credit card numbers (basic 16-digit formats)", () => {
    expect(redactContent("card 4111-1111-1111-1111 charged")).toBe("card [REDACTED] charged")
  })

  it("redacts credit card numbers with spaces", () => {
    expect(redactContent("card 4111 1111 1111 1111 charged")).toBe("card [REDACTED] charged")
  })

  it("redacts OpenAI-style API keys (sk-...)", () => {
    expect(redactContent("key is sk-abc123def456ghijklmnop")).toBe("key is [REDACTED]")
  })

  it("redacts IPv4 addresses", () => {
    expect(redactContent("from IP 192.168.1.1")).toBe("from IP [REDACTED]")
  })

  it("redacts IPv6 addresses", () => {
    expect(redactContent("from ::1")).toBe("from [REDACTED]")
  })

  it("preserves safe text unchanged", () => {
    const msg = "User logged in successfully"
    expect(redactContent(msg)).toBe(msg)
  })

  it("handles empty string", () => {
    expect(redactContent("")).toBe("")
  })

  it("redacts multiple PII types in same string", () => {
    const result = redactContent("email a@b.com, phone 555-123-4567, SSN 123-45-6789")
    expect(result).toBe("email [REDACTED], phone [REDACTED], SSN [REDACTED]")
  })

  it("does not redact short number sequences (false positive prevention)", () => {
    expect(redactContent("code is 12345")).toBe("code is 12345")
  })

  it("redacts bearer tokens in Authorization headers", () => {
    expect(redactContent("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.token")).toContain("[REDACTED]")
  })

  it("redacts JWT-like tokens", () => {
    expect(redactContent("token eyJhbG.eyJzdWI.token")).toBe("token [REDACTED]")
  })
})
