import type { APIRoute } from "astro"
import { callMemoryTool } from "@/lib/memory-fabric"

export const prerender = false

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const tenant = locals.session?.tenantSlug || "default"
    const search = url.searchParams.get("search") || undefined
    const limit = parseInt(url.searchParams.get("limit") || "20", 10)
    const offset = parseInt(url.searchParams.get("offset") || "0", 10)

    const result = await callMemoryTool(tenant, "memory_search", {
      tenant,
      query: search || "",
      limit,
      offset,
    })

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

export const DELETE: APIRoute = async ({ url, locals }) => {
  try {
    const id = url.searchParams.get("id")
    const tenant = locals.session?.tenantSlug || "default"
    if (!id) {
      return new Response(JSON.stringify({ success: false, error: "Missing id parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }
    const result = await callMemoryTool(tenant, "memory_delete", { tenant, memory_id: id })
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
