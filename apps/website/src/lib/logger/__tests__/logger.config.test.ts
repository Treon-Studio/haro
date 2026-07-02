import { describe, it, expect } from "vitest"
import { shouldLog, destinations } from "../logger.config"

describe("shouldLog", () => {
  describe("development environment", () => {
    it("logs debug", () => {
      expect(shouldLog("debug", "development")).toBe(true)
    })

    it("logs info", () => {
      expect(shouldLog("info", "development")).toBe(true)
    })

    it("logs warn", () => {
      expect(shouldLog("warn", "development")).toBe(true)
    })

    it("logs error", () => {
      expect(shouldLog("error", "development")).toBe(true)
    })

    it("logs fatal", () => {
      expect(shouldLog("fatal", "development")).toBe(true)
    })

    it("logs audit (always, even in development)", () => {
      expect(shouldLog("audit", "development")).toBe(true)
    })
  })

  describe("staging environment", () => {
    it("skips debug", () => {
      expect(shouldLog("debug", "staging")).toBe(false)
    })

    it("logs info", () => {
      expect(shouldLog("info", "staging")).toBe(true)
    })

    it("logs warn", () => {
      expect(shouldLog("warn", "staging")).toBe(true)
    })

    it("logs audit (always)", () => {
      expect(shouldLog("audit", "staging")).toBe(true)
    })
  })

  describe("production environment", () => {
    it("skips debug", () => {
      expect(shouldLog("debug", "production")).toBe(false)
    })

    it("skips info", () => {
      expect(shouldLog("info", "production")).toBe(false)
    })

    it("logs warn", () => {
      expect(shouldLog("warn", "production")).toBe(true)
    })

    it("logs error", () => {
      expect(shouldLog("error", "production")).toBe(true)
    })

    it("logs fatal", () => {
      expect(shouldLog("fatal", "production")).toBe(true)
    })

    it("logs audit (always — even in production)", () => {
      expect(shouldLog("audit", "production")).toBe(true)
    })
  })

  describe("unknown environment", () => {
    it("defaults to production-like behavior (warn+ only)", () => {
      expect(shouldLog("debug", "unknown")).toBe(false)
      expect(shouldLog("info", "unknown")).toBe(false)
      expect(shouldLog("warn", "unknown")).toBe(true)
    })
  })
})

describe("destinations", () => {
  it("debug goes to console only", () => {
    expect(destinations.debug).toEqual(["console"])
  })

  it("info goes to console only", () => {
    expect(destinations.info).toEqual(["console"])
  })

  it("warn goes to console and neon:logs", () => {
    expect(destinations.warn).toEqual(["console", "neon:logs"])
  })

  it("error goes to console, neon:logs, and audit_log", () => {
    expect(destinations.error).toEqual(["console", "neon:logs", "audit_log"])
  })

  it("fatal goes to all destinations including alert", () => {
    expect(destinations.fatal).toContain("alert")
    expect(destinations.fatal).toContain("console")
  })

  it("audit goes only to audit_log (immutable record)", () => {
    expect(destinations.audit).toEqual(["audit_log"])
  })
})
