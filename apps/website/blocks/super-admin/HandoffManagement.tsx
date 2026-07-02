'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@treonstudio/bungas-core/ui/label'
import { Badge } from '@treonstudio/bungas-core/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@treonstudio/bungas-core/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@treonstudio/bungas-core/ui/select'
import { Textarea } from '@treonstudio/bungas-core/ui/textarea'
import { FileTextLinear, AddCircleLinear, LetterLinear, UsersGroupTwoRoundedLinear, CardLinear, UserLinear, CalendarLinear, RefreshCircleLinear, CheckCircleLinear, DangerTriangleLinear, FileTextLinear } from 'solar-icon-set';

type THandoff = {
  id: string
  company_name: string
  company_size: number
  billing_model: 'flat_rate' | 'per_seat' | 'usage_based'
  company_admin_email: string
  contract_terms: string | null
  go_live_date: string | null
  sales_contact: string
  created_at: string
}

export function HandoffManagement() {
  const [handoffs, setHandoffs] = useState<THandoff[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form State
  const [companyName, setCompanyName] = useState('')
  const [companySize, setCompanySize] = useState<number>(10)
  const [billingModel, setBillingModel] = useState<'flat_rate' | 'per_seat' | 'usage_based'>('flat_rate')
  const [companyAdminEmail, setCompanyAdminEmail] = useState('')
  const [contractTerms, setContractTerms] = useState('')
  const [goLiveDate, setGoLiveDate] = useState('')
  const [salesContact, setSalesContact] = useState('')

  // Notifications
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchHandoffs = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/super-admin/handoff')
      const result = await res.json()
      if (result.success && result.data) {
        setHandoffs(result.data)
      }
    } catch (err) {
      console.error('Error fetching handoffs', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchHandoffs()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setSuccessMsg(null)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/super-admin/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          companySize: Number(companySize),
          billingModel,
          companyAdminEmail,
          contractTerms: contractTerms || null,
          goLiveDate: goLiveDate || null,
          salesContact,
        }),
      })

      const result = await res.json()
      if (result.success && result.data) {
        setSuccessMsg(`Dokumen Sales Handoff untuk "${result.data.company_name}" berhasil disimpan!`)
        // Reset form
        setCompanyName('')
        setCompanySize(10)
        setBillingModel('flat_rate')
        setCompanyAdminEmail('')
        setContractTerms('')
        setGoLiveDate('')
        setSalesContact('')
        
        // Refresh list
        fetchHandoffs()
      } else {
        setErrorMsg(result.error?.message || 'Gagal menyimpan handoff')
      }
    } catch (err) {
      setErrorMsg('Terjadi kesalahan jaringan')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Creation Form */}
      <div className="lg:col-span-1 space-y-4">
        <Card className="bg-surface-primary border-border-primary text-text-primary">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <AddCircleLinear className="h-5 w-5 text-brand-primary" />
              Log Sales Handoff
            </CardTitle>
            <CardDescription className="text-text-secondary">Daftarkan kontrak baru dari marketing untuk di-provision.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Notifications inside form */}
              {successMsg && (
                <div className="flex items-center gap-2 rounded bg-green-500/10 border border-green-500/20 p-3 text-xs text-green-500">
                  <CheckCircleLinear className="h-4 w-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}
              {errorMsg && (
                <div className="flex items-center gap-2 rounded bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-500">
                  <DangerTriangleLinear className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="company-name" className="text-xs font-semibold uppercase text-text-secondary">Nama Perusahaan B2B</Label>
                <Input
                  id="company-name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="PT Maju Jaya Tbk"
                  required
                  className="border-border-primary bg-transparent text-text-primary placeholder:text-text-secondary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company-size" className="text-xs font-semibold uppercase text-text-secondary">Ukuran Tim (Pax)</Label>
                  <Input
                    id="company-size"
                    type="number"
                    value={companySize}
                    onChange={(e) => setCompanySize(Number(e.target.value))}
                    min={1}
                    required
                    className="border-border-primary bg-transparent text-text-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billing-model" className="text-xs font-semibold uppercase text-text-secondary">Billing Model</Label>
                  <Select value={billingModel} onValueChange={(val: any) => setBillingModel(val)}>
                    <SelectTrigger className="border-border-primary bg-transparent text-text-primary">
                      <SelectValue placeholder="Model" />
                    </SelectTrigger>
                    <SelectContent className="bg-surface-primary text-text-primary border-border-primary">
                      <SelectItem value="flat_rate">Flat Rate</SelectItem>
                      <SelectItem value="per_seat">Per Seat</SelectItem>
                      <SelectItem value="usage_based">Usage Based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-email" className="text-xs font-semibold uppercase text-text-secondary">Email Administrator Tenant</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={companyAdminEmail}
                  onChange={(e) => setCompanyAdminEmail(e.target.value)}
                  placeholder="admin@majujaya.com"
                  required
                  className="border-border-primary bg-transparent text-text-primary placeholder:text-text-secondary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="go-live" className="text-xs font-semibold uppercase text-text-secondary">Rencana Go-Live</Label>
                <Input
                  id="go-live"
                  type="date"
                  value={goLiveDate}
                  onChange={(e) => setGoLiveDate(e.target.value)}
                  className="border-border-primary bg-transparent text-text-primary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sales-contact" className="text-xs font-semibold uppercase text-text-secondary">Kontak Sales Executive</Label>
                <Input
                  id="sales-contact"
                  value={salesContact}
                  onChange={(e) => setSalesContact(e.target.value)}
                  placeholder="e.g. Bill Lumbergh"
                  required
                  className="border-border-primary bg-transparent text-text-primary placeholder:text-text-secondary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="terms" className="text-xs font-semibold uppercase text-text-secondary">Klausul Kontrak & Catatan</Label>
                <Textarea
                  id="terms"
                  value={contractTerms}
                  onChange={(e) => setContractTerms(e.target.value)}
                  placeholder="Tuliskan syarat khusus kontrak, durasi, batasan akses API, dll..."
                  className="border-border-primary bg-transparent text-text-primary placeholder:text-text-secondary"
                />
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? <RefreshCircleLinear className="mr-1 h-4 w-4 animate-spin" /> : <AddCircleLinear className="mr-1 h-4 w-4" />}
                Log Sales Handoff
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Roster List of Handoffs */}
      <div className="lg:col-span-2 space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FileTextLinear class="h-5 w-5 text-brand-primary" />
          Roster Sales Handoffs
        </h2>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-surface-secondary" />
            ))}
          </div>
        ) : handoffs.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {handoffs.map((h) => (
              <Card key={h.id} className="bg-surface-primary border-border-primary text-text-primary hover:border-brand-primary/30 transition-colors">
                <div className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div>
                      <div className="font-extrabold text-lg flex items-center gap-2">
                        {h.company_name}
                        <Badge className="bg-brand-primary/10 text-brand-primary border-none text-[10px] uppercase font-bold tracking-wider">
                          {h.billing_model.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-xs text-text-secondary">Dibuat pada {new Date(h.created_at).toLocaleDateString()}</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-text-secondary flex items-center gap-1"><LetterLinear className="h-3.5 w-3.5 shrink-0" /> Admin Email</span>
                        <span className="font-semibold block truncate max-w-[120px]">{h.company_admin_email}</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-text-secondary flex items-center gap-1"><UsersGroupTwoRoundedLinear className="h-3.5 w-3.5 shrink-0" /> Ukuran Tim</span>
                        <span className="font-semibold block">{h.company_size} Pax</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-text-secondary flex items-center gap-1"><CalendarLinear className="h-3.5 w-3.5 shrink-0" /> Rencana Go-Live</span>
                        <span className="font-semibold block">{h.go_live_date ? new Date(h.go_live_date).toLocaleDateString() : '-'}</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-text-secondary flex items-center gap-1"><UserLinear className="h-3.5 w-3.5 shrink-0" /> Sales Exec</span>
                        <span className="font-semibold block truncate max-w-[100px]">{h.sales_contact}</span>
                      </div>
                    </div>

                    {h.contract_terms && (
                      <div className="flex gap-1.5 p-3 rounded-lg bg-surface-secondary/50 border border-border-primary/50 text-xs text-text-secondary">
                        <FileTextLinear className="h-4 w-4 shrink-0 text-brand-primary" />
                        <p className="italic leading-relaxed">{h.contract_terms}</p>
                      </div>
                    )}
                  </div>

                  <a
                    href={`/super-admin/tenants?handoff=${h.id}`}
                    className="flex items-center justify-center gap-1 px-4 py-2.5 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white rounded-lg transition-colors text-xs font-bold shrink-0 border border-transparent"
                  >
                    Provision Tenant
                  </a>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-dashed border-border-primary rounded-xl bg-surface-primary">
            <FileTextLinear className="h-12 w-12 text-text-secondary mb-3 mx-auto" />
            <h3 className="font-bold text-lg">Belum ada Sales Handoff</h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto mt-1">
              Gunakan form di samping kiri untuk mendaftarkan kontrak B2B baru yang dikirimkan oleh tim Sales.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
