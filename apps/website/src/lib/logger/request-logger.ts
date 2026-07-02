import { Effect } from "effect"
import type { TLogContext } from "./logger.types"
import type { LoggerService } from "./logger.service"

const noopEffect = Effect.sync(() => {})

const noopLogger: LoggerService = {
  debug: () => noopEffect,
  info: () => noopEffect,
  warn: () => noopEffect,
  error: () => noopEffect,
  fatal: () => noopEffect,
  audit: () => noopEffect,
  child: () => noopLogger,
  withSpan: (_name, fn) => fn(),
}

export type RequestLogInfo = {
  logger: LoggerService
  logRequest: () => void
  logComplete: (statusCode: number) => void
  logError: (error: Error) => void
}

export function makeRequestLogger(
  method: string,
  path: string,
  requestId?: string,
  logger?: LoggerService,
): RequestLogInfo {
  const rid = requestId ?? crypto.randomUUID()
  const context: TLogContext = { requestId: rid }

  const startTime = performance.now()
  const activeLogger = logger ?? noopLogger

  const logRequest = (): void => {
    Effect.runSync(activeLogger.info(`${method} ${path}`, {
      ...context,
      action: "request.start",
    }))
  }

  const logComplete = (statusCode: number): void => {
    const durationMs = performance.now() - startTime
    Effect.runSync(activeLogger.info(`${method} ${path}`, {
      ...context,
      statusCode,
      durationMs,
      action: "request.complete",
    }))
  }

  const logError = (error: Error): void => {
    const durationMs = performance.now() - startTime
    Effect.runSync(activeLogger.error(`${method} ${path}`, {
      ...context,
      durationMs,
      action: "request.error",
    }, error))
  }

  return {
    logger: activeLogger.child(context),
    logRequest,
    logComplete,
    logError,
  }
}
