'use client'

import { useState, useEffect } from "react"
import { Folder, File, ChevronRight, Eye } from "lucide-react"
import { callMemoryTool } from "@/lib/memory-fabric"

interface VaultFile {
  name: string
  path: string
  type: "file" | "directory"
  size?: number
  modified_at?: string
}

export default function VaultBrowser({ tenant }: { tenant: string }) {
  const [currentPath, setCurrentPath] = useState("")
  const [files, setFiles] = useState<VaultFile[]>([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<{ path: string; content: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchFiles = async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await callMemoryTool("vault_list", { tenant, path })
      const data = res as { result?: VaultFile[] }
      setFiles(data?.result || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFiles(currentPath)
  }, [currentPath])

  const handleOpen = async (file: VaultFile) => {
    if (file.type === "directory") {
      setCurrentPath(file.path)
    } else {
      const res = await callMemoryTool("vault_read", { tenant, path: file.path })
      const data = res as { result?: string }
      setPreview({ path: file.path, content: data?.result || "(binary file)" })
    }
  }

  const pathParts = currentPath ? currentPath.split("/").filter(Boolean) : []

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-text-secondary">
        <button onClick={() => setCurrentPath("")} className="hover:text-foreground">Root</button>
        {pathParts.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="w-3 h-3" />
            <button
              onClick={() => setCurrentPath(pathParts.slice(0, i + 1).join("/"))}
              className="hover:text-foreground"
            >
              {part}
            </button>
          </span>
        ))}
      </div>

      {/* File list */}
      <div className="rounded-lg border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-tertiary">Loading...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : files.length === 0 ? (
          <div className="p-8 text-center text-text-tertiary">No files found in this directory.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-hover text-text-secondary">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-right px-4 py-2 font-medium">Size</th>
                <th className="text-right px-4 py-2 font-medium">Modified</th>
                <th className="w-20 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr
                  key={file.path}
                  className="border-t border-border hover:bg-surface-hover cursor-pointer"
                  onClick={() => handleOpen(file)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {file.type === "directory" ? (
                        <Folder className="w-4 h-4 text-blue-500" />
                      ) : (
                        <File className="w-4 h-4 text-text-tertiary" />
                      )}
                      <span>{file.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary">
                    {file.size ? `${(file.size / 1024).toFixed(1)} KB` : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary text-xs">
                    {file.modified_at ? new Date(file.modified_at).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {file.type === "file" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpen(file) }}
                        className="p-1 rounded hover:bg-surface-hover"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setPreview(null)}>
          <div className="bg-card rounded-xl border border-border p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold">{preview.path}</h3>
              <button onClick={() => setPreview(null)} className="text-text-secondary hover:text-foreground">&times;</button>
            </div>
            <pre className="text-sm text-text-secondary whitespace-pre-wrap bg-surface-hover p-4 rounded-lg overflow-x-auto max-h-[60vh]">
              {preview.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
