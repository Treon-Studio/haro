'use client'

import { useState, useEffect, useCallback } from "react"
import { Search, Trash2, ChevronLeft, ChevronRight } from "lucide-react"

interface Memory {
  id: string
  user_id: string
  agent_id: string
  messages: unknown
  metadata: unknown
  created_at: string
  updated_at: string
}

interface ListResponse {
  rows: Memory[]
  total: number
}

export function MemoryList() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const limit = 20

  const fetchMemories = useCallback(async (q: string, off: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(off) })
      if (q) params.set("search", q)
      const res = await fetch(`/api/memories?${params}`)
      const json = await res.json()
      if (json.success) {
        setMemories(json.data.rows)
        setTotal(json.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMemories(search, offset)
  }, [fetchMemories, search, offset])

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/memories?id=${id}`, { method: "DELETE" })
    const json = await res.json()
    if (json.success) {
      setMemories((prev) => prev.filter((m) => m.id !== id))
      setTotal((prev) => prev - 1)
    }
  }

  const snippet = (mem: Memory): string => {
    try {
      const msgs = typeof mem.messages === "string" ? JSON.parse(mem.messages) : mem.messages
      if (Array.isArray(msgs) && msgs.length > 0) {
        const first = msgs[0]
        const text = first.content || first.text || ""
        return text.length > 80 ? text.slice(0, 80) + "..." : text
      }
    } catch {}
    return "(empty)"
  }

  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  return (
    <div class="space-y-4">
      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
        <input
          type="text"
          placeholder="Search memories..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0) }}
          class="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div class="overflow-x-auto rounded-lg border border-border">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-muted text-muted-foreground">
              <th class="text-left px-4 py-3 font-medium">ID</th>
              <th class="text-left px-4 py-3 font-medium">User</th>
              <th class="text-left px-4 py-3 font-medium">Snippet</th>
              <th class="text-left px-4 py-3 font-medium">Created</th>
              <th class="w-16 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colspan={5} class="text-center py-8 text-text-tertiary">Loading...</td>
              </tr>
            ) : memories.length === 0 ? (
              <tr>
                <td colspan={5} class="text-center py-8 text-text-tertiary">No memories found</td>
              </tr>
            ) : (
              memories.map((mem) => (
                <tr key={mem.id} class="border-t border-border hover:bg-surface-hover transition-colors">
                  <td class="px-4 py-3 font-mono text-xs text-text-secondary">{mem.id.slice(0, 8)}...</td>
                  <td class="px-4 py-3 text-text-secondary">{mem.user_id}</td>
                  <td class="px-4 py-3 text-foreground">{snippet(mem)}</td>
                  <td class="px-4 py-3 text-text-secondary text-xs">{new Date(mem.created_at).toLocaleDateString()}</td>
                  <td class="px-4 py-3">
                    <button
                      onClick={() => handleDelete(mem.id)}
                      class="p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                      title="Delete memory"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div class="flex items-center justify-between text-sm text-text-secondary">
          <span>{total} total memories</span>
          <div class="flex items-center gap-2">
            <button
              onClick={() => setOffset((p) => Math.max(0, p - limit))}
              disabled={offset === 0}
              class="p-1.5 rounded-md hover:bg-surface-hover disabled:opacity-40 transition-colors"
            >
              <ChevronLeft class="w-4 h-4" />
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setOffset((p) => (currentPage < totalPages ? p + limit : p))}
              disabled={currentPage >= totalPages}
              class="p-1.5 rounded-md hover:bg-surface-hover disabled:opacity-40 transition-colors"
            >
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
