export type TLogLevel = "debug" | "info" | "warn" | "error" | "fatal" | "audit"

export type TLogContext = {
  readonly requestId?: string
  readonly userId?: string
  readonly companyId?: string
  readonly sessionId?: string
  readonly caseId?: string
  readonly action?: string
  readonly resourceType?: string
  readonly resourceId?: string
  readonly durationMs?: number
  readonly traceId?: string
  readonly spanId?: string
  readonly [key: string]: unknown
}

export type TLogEnvironment = "development" | "staging" | "production"

export type TLogEntry = {
  readonly timestamp: string
  readonly level: TLogLevel
  readonly message: string
  readonly context: TLogContext
  readonly error?: {
    readonly tag: string
    readonly message: string
    readonly stack?: string
    readonly cause?: unknown
  }
  readonly service: "tenang-web"
  readonly environment: TLogEnvironment
}
