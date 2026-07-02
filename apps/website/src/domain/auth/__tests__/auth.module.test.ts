import { describe, it, expect } from "vitest"
import { AuthModule } from "../auth.module"

describe("AuthModule.normalizeEmail", () => {
  it("lowercases email", () => {
    expect(AuthModule.normalizeEmail("USER@Example.COM")).toBe("user@example.com")
  })

  it("trims whitespace", () => {
    expect(AuthModule.normalizeEmail("  user@example.com  ")).toBe("user@example.com")
  })

  it("handles already normalized email", () => {
    expect(AuthModule.normalizeEmail("user@example.com")).toBe("user@example.com")
  })
})

describe("AuthModule.isValidEmail", () => {
  it("accepts valid emails", () => {
    expect(AuthModule.isValidEmail("user@example.com")).toBe(true)
    expect(AuthModule.isValidEmail("user+tag@example.co.id")).toBe(true)
    expect(AuthModule.isValidEmail("  USER@Example.COM  ")).toBe(true)
  })

  it("rejects emails without @", () => {
    expect(AuthModule.isValidEmail("userexample.com")).toBe(false)
  })

  it("rejects emails without domain", () => {
    expect(AuthModule.isValidEmail("user@")).toBe(false)
  })

  it("rejects empty string", () => {
    expect(AuthModule.isValidEmail("")).toBe(false)
  })

  it("rejects emails without TLD", () => {
    expect(AuthModule.isValidEmail("user@example")).toBe(false)
  })
})
