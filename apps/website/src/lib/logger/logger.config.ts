import type { TLogLevel, TLogEnvironment } from "./logger.types"

const LOG_LEVEL_THRESHOLDS: Record<TLogEnvironment, number> = {
  development: 0, // log everything
  staging: 1,     // info+
  production: 2,  // warn+
}

const LEVEL_VALUES: Record<TLogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
  audit: 0, // same threshold as debug, but always logged via dedicated destination
}

export const shouldLog = (level: TLogLevel, environment: string): boolean => {
  // Audit is a separate concern: always logged, regardless of environment threshold.
  // Sensitive actions (company.suspended, billing.payment_failed, etc.) must be
  // recorded in the immutable audit_log table even in production.
  if (level === "audit") return true

  const threshold = LOG_LEVEL_THRESHOLDS[environment as TLogEnvironment] ?? LOG_LEVEL_THRESHOLDS.production
  return LEVEL_VALUES[level] >= threshold
}

export const destinations: Record<TLogLevel, readonly string[]> = {
  debug: ["console"],
  info: ["console"],
  warn: ["console", "neon:logs"],
  error: ["console", "neon:logs", "audit_log"],
  fatal: ["console", "neon:logs", "audit_log", "alert"],
  audit: ["audit_log"],
}
