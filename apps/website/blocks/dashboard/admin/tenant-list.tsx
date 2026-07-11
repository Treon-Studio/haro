"use client"

import { useState, useEffect, useCallback } from "react"
import { listTenants, suspendTenant, reactivateTenant, scheduleDeleteTenant } from "@/api/tenants"
import TenantDetail from "./tenant-detail"

interface Tenant {
  slug: string
  name: string
  status: string
  plan: string
  usage_memories: number
  usage_vault_bytes: number
  usage_gbrain_pages: number
  provisioned_at: string
  last_active_at: string | null
}

export default function TenantList() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [error, setError] = useState("")

  const fetchTenants = useCallback(async () => {
    setLoading(true)
    setError("")
    const params: Record<string, string> = { page: String(page), per_page: "20" }
    if (search) params.search = search
    if (statusFilter) params.status = statusFilter

    const res = await listTenants(params)
    if (res.success) {
      setTenants(res.data)
      setTotalPages(res.pagination?.total_pages || 1)
    } else {
      setError(res.error?.message || "Failed to load tenants")
    }
    setLoading(false)
  }, [page, search, statusFilter])

  useEffect(() => { fetchTenants() }, [fetchTenants])

  const handleAction = async (slug: string, action: string, reason: string) => {
    if (action === "suspend") await suspendTenant(slug, reason)
    else if (action === "reactivate") await reactivateTenant(slug, reason)
    else if (action === "delete") await scheduleDeleteTenant(slug, reason)
    fetchTenants()
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 items-center">
        <input
          type="text"
          placeholder="Search tenants..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-md border border-border bg-surface text-sm w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-md border border-border bg-surface text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deleting">Deleting</option>
          <option value="deleted">Deleted</option>
        </select>
      </div>

      {/* Error */}
      {error && <div className="text-red-500 text-sm">{error}</div>}

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-hover text-text-secondary">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-left px-4 py-2 font-medium">Plan</th>
              <th className="text-right px-4 py-2 font-medium">Memories</th>
              <th className="text-right px-4 py-2 font-medium">Pages</th>
              <th className="text-right px-4 py-2 font-medium">Created</th>
              <th className="text-right px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr
                key={t.slug}
                className="border-t border-border hover:bg-surface-hover cursor-pointer"
                onClick={() => setSelectedSlug(t.slug)}
              >
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    t.status === "active" ? "bg-green-100 text-green-700" :
                    t.status === "suspended" ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3">{t.plan}</td>
                <td className="px-4 py-3 text-right">{t.usage_memories}</td>
                <td className="px-4 py-3 text-right">{t.usage_gbrain_pages}</td>
                <td className="px-4 py-3 text-right text-text-secondary">
                  {t.provisioned_at ? new Date(t.provisioned_at).toLocaleDateString() : "-"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAction(t.slug, "suspend", "Admin action") }}
                    className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200 mr-1"
                  >
                    Suspend
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAction(t.slug, "delete", "Admin requested") }}
                    className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center text-sm text-text-secondary">
        <span>Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1 rounded border disabled:opacity-40"
          >
            Previous
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 rounded border disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {/* Detail panel */}
      {selectedSlug && (
        <TenantDetail
          slug={selectedSlug}
          onClose={() => setSelectedSlug(null)}
          onAction={handleAction}
        />
      )}
    </div>
  )
}
