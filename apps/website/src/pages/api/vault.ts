import type { APIRoute } from "astro"
import { callMemoryTool } from "@/lib/memory-fabric"

export const prerender = false

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const tenant = locals.session?.tenantSlug || "default"
    const path = url.searchParams.get("path") || ""
    const result = await callMemoryTool(tenant, "vault_list", { tenant, path })
    return new Response(JSON.stringify({ success: true, data: result }), {
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
