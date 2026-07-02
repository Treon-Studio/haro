'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@treonstudio/bungas-core/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@treonstudio/bungas-core/ui/card'
import { Buildings2Linear, FileTextLinear, AddCircleLinear, RefreshCircleLinear, CheckCircleLinear, DangerTriangleLinear, ShareLinear, ShieldCheckLinear } from 'solar-icon-set';
import { Check } from 'lucide-react';;

type TCompany = {
  id: string
  name: string
  created_at: string
}

type THandoff = {
  id: string
  company_name: string
  company_size: number
  billing_model: string
  company_admin_email: string
  created_at: string
}

interface TenantProvisionerProps {
  initialHandoffId: string | null
}

export function TenantProvisioner({ initialHandoffId }: TenantProvisionerProps) {
  const [companies, setCompanies] = useState<TCompany[]>([])
  const [handoffs, setHandoffs] = useState<THandoff[]>([])
  const [isCompaniesLoading, setIsCompaniesLoading] = useState(true)
  const [isHandoffsLoading, setIsHandoffsLoading] = useState(true)
  const [isProvisioning, setIsProvisioning] = useState<string | null>(null) // handoffId currently deploying

  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchCompanies = async () => {
    setIsCompaniesLoading(true)
    try {
      const res = await fetch('/api/companies')
      const result = await res.json()
      if (result.success && result.data) {
        setCompanies(result.data)
      }
    } catch (err) {
      console.error('Error fetching companies', err)
    } finally {
      setIsCompaniesLoading(false)
    }
  }

  const fetchHandoffs = async () => {
    setIsHandoffsLoading(true)
    try {
      const res = await fetch('/api/super-admin/handoff')
      const result = await res.json()
      if (result.success && result.data) {
        setHandoffs(result.data)
      }
    } catch (err) {
      console.error('Error fetching handoffs', err)
    } finally {
      setIsHandoffsLoading(false)
    }
  }

  useEffect(() => {
    fetchCompanies()
    fetchHandoffs()
  }, [])

  // Auto trigger provisioning if handoffId is passed in query
  useEffect(() => {
    if (initialHandoffId && handoffs.length > 0) {
      const found = handoffs.find((h) => h.id === initialHandoffId)
      if (found) {
        // We can pre-highlight or let user click. Let's trigger a notification.
        setSuccessMsg(`Dokumen handoff untuk "${found.company_name}" terpilih. Silakan klik tombol 'Deploy' di bawah ini untuk memulai provisioning.`)
      }
    }
  }, [initialHandoffId, handoffs])

  const handleProvision = async (handoffId: string, companyName: string) => {
    if (isProvisioning) return

    setIsProvisioning(handoffId)
    setSuccessMsg(null)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/super-admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handoffId }),
      })

      const result = await res.json()
      if (result.success && result.data) {
        setSuccessMsg(`Sukses! Tenant "${result.data.name}" berhasil di-provision dengan UUID: ${result.data.id}`)
        
        // Refresh
        fetchCompanies()
        fetchHandoffs()
      } else {
        setErrorMsg(result.error?.message || 'Gagal melakukan provisioning tenant')
      }
    } catch (err) {
      setErrorMsg('Terjadi kesalahan jaringan selama provisioning')
    } finally {
      setIsProvisioning(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Notifications */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-500">
          <CheckCircleLinear className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-500">
          <DangerTriangleLinear className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Handoffs ready for deploy */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileTextLinear className="h-5 w-5 text-amber-500" />
            Handoff Menunggu Deploy
          </h2>

          {isHandoffsLoading ? (
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg bg-surface-secondary" />
              ))}
            </div>
          ) : handoffs.length > 0 ? (
            <div className="space-y-4">
              {handoffs.map((h) => {
                // If company with same name already exists, we can show deployed badge
                const isAlreadyDeployed = companies.some((c) => c.name.toLowerCase() === h.company_name.toLowerCase())
                const isSelected = h.id === initialHandoffId

                return (
                  <Card
                    key={h.id}
                    className={cn(
                      "bg-surface-primary border-border-primary text-text-primary",
                      isSelected && "ring-2 ring-brand-primary"
                    )}
                  >
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="font-bold flex items-center justify-between gap-2">
                          {h.company_name}
                          {isAlreadyDeployed && (
                            <Badge className="bg-green-500/10 text-green-500 border-none flex items-center gap-0.5 text-[9px] uppercase">
                              <Check className="h-2.5 w-2.5" /> Deployed
                            </Badge>
                          )}
                        </h3>
                        <p className="text-[10px] text-text-secondary">Admin: {h.company_admin_email}</p>
                      </div>

                      <Button
                        onClick={() => handleProvision(h.id, h.company_name)}
                        disabled={!!isProvisioning}
                        className={cn(
                          "w-full text-xs font-bold py-1.5 h-8 border-none text-white",
                          isAlreadyDeployed
                            ? "bg-surface-tertiary text-text-secondary hover:bg-surface-tertiary"
                            : "bg-brand-primary hover:bg-brand-secondary"
                        )}
                      >
                        {isProvisioning === h.id ? (
                          <>
                            <RefreshCircleLinear className="mr-1 h-3.5 w-3.5 animate-spin" />
                            Provisioning...
                          </>
                        ) : isAlreadyDeployed ? (
                          'Deploy Lagi (Duplikasi)'
                        ) : (
                          'Deploy Tenant'
                        )}
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-border-primary rounded-lg bg-surface-primary text-text-secondary text-xs">
              Belum ada Sales Handoffs.
            </div>
          )}
        </div>

        {/* List of Active Deployed Companies */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Buildings2Linear className="h-5 w-5 text-brand-primary" />
            Active B2B Tenants
          </h2>

          {isCompaniesLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-secondary" />
              ))}
            </div>
          ) : companies.length > 0 ? (
            <Card className="bg-surface-primary border-border-primary text-text-primary">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-primary bg-surface-secondary/50 text-xs font-bold text-text-secondary uppercase">
                      <th className="p-4">Nama Perusahaan</th>
                      <th className="p-4">Tenant UUID</th>
                      <th className="p-4">Tanggal Deployment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-primary text-sm">
                    {companies.map((c) => (
                      <tr key={c.id} className="hover:bg-surface-secondary/30 transition-colors">
                        <td className="p-4 font-bold flex items-center gap-2">
                          <Buildings2Linear className="h-4 w-4 text-brand-primary" />
                          {c.name}
                        </td>
                        <td className="p-4 text-xs font-mono text-text-secondary">{c.id}</td>
                        <td className="p-4 text-xs text-text-secondary">{new Date(c.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <div className="text-center py-20 border border-dashed border-border-primary rounded-xl bg-surface-primary">
              <Buildings2Linear className="h-12 w-12 text-text-secondary mb-3 mx-auto" />
              <h3 className="font-bold text-lg">Belum ada Deployed Tenants</h3>
              <p className="text-xs text-text-secondary max-w-sm mx-auto mt-1">
                Lakukan deploy pada modul handoff di sebelah kiri untuk membuat tenant B2B pertama Anda.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
