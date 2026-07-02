import type { APIRoute } from "astro"
import { signSession } from "@/lib/auth/session"

export const GET: APIRoute = async (context) => {
  const code = context.url.searchParams.get("code")
  if (!code) {
    return Response.redirect(`${new URL(context.url).origin}/oauth/error?error=missing_code`, 302)
  }

  try {
    // Mock: since real OAuth exchange is not wired up for Neon yet,
    // generate a temporary session token for the OAuth callback flow.
    // Replace this with real OAuth token exchange when provider is implemented.
    const mockUserId = "00000000-0000-0000-0000-000000000000"
    const mockEmail = "oauth-callback@tenang.ai"
    const mockRole = "authenticated"
    const token = await signSession({ userId: mockUserId, email: mockEmail, role: mockRole }, 60 * 60 * 24 * 7)

    context.cookies.set("tenang-session", token, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    })

    return Response.redirect(`${new URL(context.url).origin}/oauth/success`, 302)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown_error"
    return Response.redirect(`${new URL(context.url).origin}/oauth/error?error=${encodeURIComponent(message)}`, 302)
  }
}
