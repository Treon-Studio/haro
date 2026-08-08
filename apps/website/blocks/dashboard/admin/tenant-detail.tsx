"use client"

import { useState, useEffect } from "react"
import { getTenant, getTenantStats } from "@/api/tenants"

export default function TenantDetail({
  slug,
  onClose,
  onAction,
}: {
  slug: string
  onClose: () => void
  onAction: (slug: string, action: string, reason: string) => void
}) {
  const [tenant, setTenant] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [confirmAction, setConfirmAction] = useState("")
  const [reason, setReason] = useState("")

  useEffect(() => {
    getTenant(slug).then(r => r.success && setTenant(r.data))
    getTenantStats(slug).then(r => r.success && setStats(r.data))
  }, [slug])

  if (!tenant) return <div className="p-4 text-sm text-text-secondary">Loading...</div>

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold">{tenant.name}</h3>
            <p className="text-sm text-text-secondary">{tenant.slug}</p>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-foreground">&times;</button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div><span className="text-text-secondary">Status:</span> {tenant.status}</div>
          <div><span className="text-text-secondary">Plan:</span> {tenant.plan}</div>
          <div><span className="text-text-secondary">Vault:</span> {tenant.vault_path}</div>
          <div><span className="text-text-secondary">Created:</span> {new Date(tenant.created_at).toLocaleString()}</div>
        </div>

        {stats && (
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-2">Resource Usage</h4>
            {Object.entries(stats.limits || {}).map(([key, val]: any) => (
              <div key={key} className="mb-1">
                <div className="flex justify-between text-xs">
                  <span>{key}</span>
                  <span>{val.used} / {val.max} ({val.percent}%)</span>
                </div>
                <div className="w-full bg-surface-hover rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${
                      val.percent > 90 ? "bg-red-500" : val.percent > 70 ? "bg-yellow-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${Math.min(val.percent, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {confirmAction ? (
          <div className="border-t pt-3">
            <p className="text-sm mb-2">
              {confirmAction === "suspend" ? "Suspend this tenant?" :
               confirmAction === "reactivate" ? "Reactivate this tenant?" :
               "Schedule this tenant for deletion?"}
            </p>
            <input
              type="text"
              placeholder="Reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border text-sm mb-2"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { onAction(slug, confirmAction, reason); onClose() }}
                className="px-3 py-1.5 rounded bg-red-500 text-white text-sm"
              >
                Confirm
              </button>
              <button onClick={() => setConfirmAction("")} className="px-3 py-1.5 rounded border text-sm">
                Cancel
              </button>
            </div>
          </div>
        ) : tenant.status === "active" ? (
          <div className="flex gap-2 border-t pt-3">
            <button onClick={() => setConfirmAction("suspend")} className="px-3 py-1.5 rounded bg-yellow-500 text-white text-sm">
              Suspend
            </button>
            <button onClick={() => setConfirmAction("delete")} className="px-3 py-1.5 rounded bg-red-500 text-white text-sm">
              Schedule Delete
            </button>
          </div>
        ) : tenant.status === "suspended" ? (
          <div className="flex gap-2 border-t pt-3">
            <button onClick={() => setConfirmAction("reactivate")} className="px-3 py-1.5 rounded bg-green-500 text-white text-sm">
              Reactivate
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
