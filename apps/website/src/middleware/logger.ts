import { defineMiddleware } from "astro/middleware"
import { Effect } from "effect"
import { makeLogger } from "@/lib/logger/logger.service"
import { makeRequestLogger } from "@/lib/logger/request-logger"

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url)

  const logger = makeLogger({
    environment: (import.meta.env.PUBLIC_APP_ENV as "development" | "staging" | "production") ?? "development",
  })

  const requestId = crypto.randomUUID()
  const { logRequest, logComplete, logError } = makeRequestLogger(
    context.request.method,
    url.pathname,
    requestId,
    logger,
  )

  context.locals.logger = logger.child({ requestId })
  context.locals.requestId = requestId

  logRequest()

  try {
    const response = await next()
    logComplete(response.status)
    if (response.status >= 400 && url.pathname.startsWith("/api/")) {
      response.clone().text().then((body) => {
        const childLogger = logger.child({ requestId })
        Effect.runSync(childLogger.error(`${context.request.method} ${url.pathname} error response`, {
          requestId,
          statusCode: response.status,
          body,
        }))
      }).catch(() => {})
    }
    return response
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)))
    throw error
  }
})
