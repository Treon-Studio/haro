import { defineMiddleware } from "astro/middleware"
import { verifySession } from "@/lib/auth/session"
import { ROUTES } from "@/shared/constants/api.constants"

const PROTECTED_PATHS: readonly string[] = ROUTES.PROTECTED
const GUEST_ONLY_PATHS: readonly string[] = ROUTES.GUEST_ONLY

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url)
  const pathname = url.pathname

  if (pathname.startsWith("/_astro") || pathname === "/") {
    return next()
  }

  const sessionToken = context.cookies.get("tenang-session")?.value
  const sessionPayload = sessionToken ? await verifySession(sessionToken) : null

  context.locals.session = sessionPayload
    ? {
        userId: sessionPayload.userId,
        email: sessionPayload.email,
        sessionId: sessionToken ?? "",
      }
    : null

  const isApiRoute = pathname.startsWith("/api/")
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p))
  const isGuestOnly = GUEST_ONLY_PATHS.some((p) => pathname.startsWith(p))

  if (!isApiRoute) {
    if (isProtected && !context.locals.session) {
      return context.redirect(ROUTES.PAGE.LOGIN)
    }

    if (isGuestOnly && context.locals.session) {
      return context.redirect(ROUTES.PAGE.DASHBOARD)
    }
  }

  return next()
})
