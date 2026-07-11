import type { APIRoute } from "astro"
import { listMemories, deleteMemory } from "@/lib/neon"

export const prerender = false

export const GET: APIRoute = async ({ url }) => {
  try {
    const search = url.searchParams.get("search") || undefined
    const limit = parseInt(url.searchParams.get("limit") || "20", 10)
    const offset = parseInt(url.searchParams.get("offset") || "0", 10)
    const result = await listMemories(search, limit, offset)
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

export const DELETE: APIRoute = async ({ url }) => {
  try {
    const id = url.searchParams.get("id")
    if (!id) {
      return new Response(JSON.stringify({ success: false, error: "Missing id parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }
    await deleteMemory(id)
    return new Response(JSON.stringify({ success: true }), {
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
