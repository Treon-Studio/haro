'use client'

import { useEffect, useRef, useState } from "react"
import { Network } from "vis-network"
import { DataSet } from "vis-data"

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

export function MemoryGraph() {
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)
  const [pages, setPages] = useState<GbrainPage[]>([])
  const [selected, setSelected] = useState<GbrainPage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/gbrain")
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
          <h3 class="font-semibold text-foreground mb-1">{selected.title || selected.slug}</h3>
          <p class="text-xs text-text-tertiary mb-2">Type: {selected.type}</p>
          <p class="text-xs text-text-tertiary mb-2">Slug: /{selected.slug}</p>
          <p class="text-sm text-text-secondary whitespace-pre-wrap line-clamp-[15]">
            {selected.body || "(no body)"}
          </p>
        </div>
      )}
    </div>
  )
}
