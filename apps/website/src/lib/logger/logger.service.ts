import { Context, Effect, pipe, Layer } from "effect"
import type { TLogEntry, TLogContext, TLogLevel, TLogEnvironment } from "./logger.types"
import { shouldLog, destinations } from "./logger.config"
import { redactFields, redactContent } from "./pii"

export type LogWriter = (entry: TLogEntry) => void

export type LoggerConfig = {
  readonly environment: TLogEnvironment
  readonly writers?: {
    readonly console?: LogWriter
    readonly "neon:logs"?: LogWriter
    readonly audit_log?: LogWriter
    readonly alert?: LogWriter
  }
}

function defaultConsoleWriter(entry: TLogEntry): void {
  const { level, message, context, error } = entry
  if (level === "error" || level === "fatal") {
    console.error(level, message, context, error ?? "")
  } else if (level === "warn") {
    console.warn(level, message, context)
  } else {
    console.log(level, message, context)
  }
}

function buildEntry(
  level: TLogLevel,
  message: string,
  context: TLogContext,
  environment: TLogEnvironment,
  parentContext: TLogContext,
  error?: Error,
): TLogEntry {
  const merged = { ...parentContext, ...context }
  return {
    timestamp: new Date().toISOString(),
    level,
    message: redactContent(message),
    context: redactFields(merged) as TLogContext,
    ...(error ? { error: { tag: error.name, message: error.message, stack: error.stack } } : {}),
    service: "tenang-web",
    environment,
  }
}

export interface LoggerService {
  readonly debug: (message: string, context?: TLogContext) => Effect.Effect<void>
  readonly info: (message: string, context?: TLogContext) => Effect.Effect<void>
  readonly warn: (message: string, context?: TLogContext) => Effect.Effect<void>
  readonly error: (message: string, context?: TLogContext, err?: Error) => Effect.Effect<void>
  readonly fatal: (message: string, context?: TLogContext, err?: Error) => Effect.Effect<void>
  readonly audit: (message: string, context?: TLogContext) => Effect.Effect<void>
  readonly child: (context: TLogContext) => LoggerService
  readonly withSpan: <A, E, R>(name: string, fn: () => Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
}

export class ILogger extends Context.Tag("ILogger")<ILogger, LoggerService>() {}

function makeLogEntry(
  level: TLogLevel,
  message: string,
  config: LoggerConfig,
  parentContext: TLogContext,
  context?: TLogContext,
  err?: Error,
): Effect.Effect<void> {
  return Effect.sync(() => {
    if (!shouldLog(level, config.environment)) return

    const entry = buildEntry(level, message, context ?? {}, config.environment, parentContext, err)
    const writers = config.writers ?? {}
    const dests = destinations[level]

    for (const dest of dests) {
      const writer = writers[dest as keyof typeof writers]
      if (writer) {
        writer(entry)
      } else if (dest === "console") {
        defaultConsoleWriter(entry)
      }
    }
  })
}

export function makeLogger(
  config: LoggerConfig,
  parentContext: TLogContext = {},
): LoggerService {
  const logger: LoggerService = {
    debug: (msg, ctx) => makeLogEntry("debug", msg, config, parentContext, ctx),
    info: (msg, ctx) => makeLogEntry("info", msg, config, parentContext, ctx),
    warn: (msg, ctx) => makeLogEntry("warn", msg, config, parentContext, ctx),
    error: (msg, ctx, err) => makeLogEntry("error", msg, config, parentContext, ctx, err),
    fatal: (msg, ctx, err) => makeLogEntry("fatal", msg, config, parentContext, ctx, err),
    audit: (msg, ctx) => makeLogEntry("audit", msg, config, parentContext, ctx),

    child: (additionalContext) => {
      const merged = { ...parentContext, ...additionalContext }
      return makeLogger(config, merged)
    },

    withSpan: (name, fn) =>
      pipe(
        Effect.sync(() => {
          const start = performance.now()
          return { start }
        }),
        Effect.flatMap(({ start }) =>
          pipe(
            fn(),
            Effect.tapBoth({
              onSuccess: () => {
                const durationMs = performance.now() - start
                return makeLogEntry("debug", `span:${name} completed`, config, parentContext, {
                  durationMs,
                  action: name,
                })
              },
              onFailure: () => {
                const durationMs = performance.now() - start
                return makeLogEntry("error", `span:${name} failed`, config, parentContext, {
                  durationMs,
                  action: name,
                })
              },
            }),
          ),
        ),
      ),
  }

  return logger
}

export const LoggerLayer = (config: LoggerConfig): Layer.Layer<ILogger, never, never> =>
  Layer.effect(ILogger, Effect.succeed(makeLogger(config)))
