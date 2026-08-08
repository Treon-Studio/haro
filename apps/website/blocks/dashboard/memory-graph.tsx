'use client'

import { useEffect, useRef, useState } from "react"
import { Network } from "vis-network"
import { DataSet } from "vis-data"
import { callMemoryTool } from "@/lib/memory-fabric"

interface GbrainPage {
  id: string
  slug: string
  title: string
  type: string
  body: string
  tenant: string
  created_at: string
  updated_at: string
}

interface GraphNode {
  id: string
  label: string
  title: string
  group: string
}

interface GraphEdge {
  from: string
  to: string
  label?: string
}

export function MemoryGraph({ tenant = "default" }: { tenant?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)
  const [pages, setPages] = useState<GbrainPage[]>([])
  const [selected, setSelected] = useState<GbrainPage | null>(null)
  const [editing, setEditing] = useState<GbrainPage | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editBody, setEditBody] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/gbrain?tenant=" + tenant)
        const json = await res.json()
        if (json.success) {
          setPages(json.data)
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!containerRef.current || pages.length === 0) return

    const nodes = new DataSet<GraphNode>(
      pages.map((p) => ({
        id: p.id,
        label: p.title || p.slug,
        title: `<b>${p.title || p.slug}</b><br/>${p.type}`,
        group: p.type,
      })),
    )

    const tags = pages
      .map((p) => {
        const parts = p.slug.split("/")
        return parts.length > 1 ? parts.slice(0, -1).join("/") : null
      })
      .filter(Boolean) as string[]

    const tagSet = new Set(tags)
    const edges = new DataSet<GraphEdge>()

    tagSet.forEach((tag) => {
      const tagged = pages.filter((p) => p.slug.startsWith(tag + "/") || p.slug === tag)
      for (let i = 1; i < tagged.length; i++) {
        edges.add({ from: tagged[0].id, to: tagged[i].id, label: tag })
      }
    })

    const options = {
      physics: { solver: "forceAtlas2Based", stabilization: { iterations: 100 } },
      interaction: { hover: true, highlightNearest: { enabled: true, degree: 1 } },
      nodes: {
        shape: "dot",
        size: 20,
        font: { size: 12, color: "#ececec" },
        borderWidth: 2,
      },
      edges: {
        color: { color: "#3f3f46", highlight: "#10b981" },
        width: 1,
        smooth: { type: "continuous" },
      },
      groups: {
        page: { color: { background: "#3b82f6", border: "#2563eb" } },
        section: { color: { background: "#10b981", border: "#059669" } },
        default: { color: { background: "#8b5cf6", border: "#7c3aed" } },
      },
    }

    const network = new Network(containerRef.current, { nodes, edges }, options)
    networkRef.current = network

    network.on("click", (params: { nodes: string[] }) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0]
        const page = pages.find((p) => p.id === nodeId)
        setSelected(page || null)
      } else {
        setSelected(null)
      }
    })

    return () => {
      network.destroy()
    }
  }, [pages])

  if (loading) {
    return (
      <div class="flex items-center justify-center h-64 text-text-tertiary">
        Loading knowledge graph...
      </div>
    )
  }

  if (pages.length === 0) {
    return (
      <div class="flex items-center justify-center h-64 text-text-tertiary">
        No pages found. Add some gbrain pages to see the graph.
      </div>
    )
  }

  return (
    <div class="flex gap-4 h-[600px]">
      <div ref={containerRef} class="flex-1 rounded-lg border border-border bg-background" />
      {selected && (
        <div class="w-72 shrink-0 rounded-lg border border-border bg-card p-4 overflow-y-auto">
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-semibold text-foreground">{selected.title || selected.slug}</h3>
            <div class="flex gap-1">
              <button
                type="button"
                class="rounded p-1 text-text-tertiary hover:text-foreground hover:bg-background-secondary transition-colors"
                title="Edit"
                onClick={() => {
                  setEditing(selected)
                  setEditTitle(selected.title)
                  setEditBody(selected.body)
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </button>
              <button
                type="button"
                class="rounded p-1 text-text-tertiary hover:text-red-500 hover:bg-background-secondary transition-colors"
                title="Delete"
                onClick={async () => {
                  if (!confirm("Delete this node?")) return
                  await callMemoryTool("gbrain_delete", { tenant, slug: selected.slug })
                  setPages((prev) => prev.filter((p) => p.id !== selected.id))
                  setSelected(null)
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>
          <p class="text-xs text-text-tertiary mb-2">Type: {selected.type}</p>
          <p class="text-xs text-text-tertiary mb-2">Slug: /{selected.slug}</p>
          <p class="text-sm text-text-secondary whitespace-pre-wrap line-clamp-[15]">
            {selected.body || "(no body)"}
          </p>
        </div>
      )}

      {editing && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div class="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl">
            <h3 class="font-semibold text-foreground mb-4">Edit Node</h3>
            <label class="block text-sm text-text-secondary mb-1">Title</label>
            <input
              class="w-full mb-3 rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <label class="block text-sm text-text-secondary mb-1">Body</label>
            <textarea
              class="w-full mb-4 rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]"
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
            />
            <div class="flex justify-end gap-2">
              <button
                type="button"
                class="rounded px-4 py-2 text-sm text-text-secondary hover:text-foreground border border-border transition-colors"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                class="rounded px-4 py-2 text-sm text-white bg-primary hover:bg-primary-hover transition-colors"
                onClick={async () => {
                  await callMemoryTool("gbrain_put", {
                    tenant,
                    slug: editing.slug,
                    title: editTitle,
                    body: editBody,
                  })
                  setPages((prev) =>
                    prev.map((p) =>
                      p.id === editing.id
                        ? { ...p, title: editTitle, body: editBody }
                        : p,
                    ),
                  )
                  setSelected((prev) =>
                    prev?.id === editing.id
                      ? { ...prev, title: editTitle, body: editBody }
                      : prev,
                  )
                  setEditing(null)
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
