import type { APIRoute } from "astro"
import { listVaultFiles } from "@/lib/neon"

export const prerender = false

export const GET: APIRoute = async () => {
  try {
    const files = await listVaultFiles()
    return new Response(JSON.stringify({ success: true, data: files }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
