'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@treonstudio/bungas-core/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@treonstudio/bungas-core/ui/label'
import { Textarea } from '@treonstudio/bungas-core/ui/textarea'
import { Badge } from '@treonstudio/bungas-core/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@treonstudio/bungas-core/ui/select'
import { cn } from '@treonstudio/bungas-core/lib/utils'
import { RefreshCircleLinear, CheckCircleLinear, DangerTriangleLinear, AddCircleLinear, TicketLinear } from 'solar-icon-set';

type TTicket = {
  id: string
  subject: string
  description: string
  priority: 'low' | 'medium' | 'high'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  created_at: string
}

export function SupportTicketLogger({ companyId }: { companyId: string }) {
  const [tickets, setTickets] = useState<TTicket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form State
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('low')

  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchTickets = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/companies/${companyId}/support`)
      const result = await res.json()
      if (result.success && result.data) {
        setTickets(result.data)
      }
    } catch (err) {
      console.error('Error fetching tickets', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [companyId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setSuccess(null)
    setError(null)

    try {
      const res = await fetch(`/api/companies/${companyId}/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, description, priority })
      })
      const result = await res.json()
      if (result.success) {
        setSuccess('Tiket bantuan berhasil dicatat! Tim teknis kami akan segera menindaklanjuti.')
        setSubject('')
        setDescription('')
        setPriority('low')
        fetchTickets()
      } else {
        setError(result.error?.message || 'Gagal mengirimkan tiket bantuan')
      }
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Create form */}
      <Card className="bg-surface-primary border-border-primary text-text-primary lg:col-span-1 h-fit">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <AddCircleLinear className="h-5 w-5 text-brand-primary" />
            Buat Tiket Bantuan
          </CardTitle>
          <CardDescription className="text-text-secondary text-xs">Butuh bantuan teknis atau operasional? Kirimkan aduan Anda secara aman.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {success && (
              <div className="flex items-center gap-2 rounded bg-green-500/10 border border-green-500/20 p-3 text-xs text-green-500">
                <CheckCircleLinear className="h-4 w-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 rounded bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-500">
                <DangerTriangleLinear className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="sub" className="text-xs font-semibold uppercase text-text-secondary">Subjek Aduan</Label>
              <Input id="sub" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Masalah Penagihan Kuota" required className="border-border-primary bg-transparent text-text-primary" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pri" className="text-xs font-semibold uppercase text-text-secondary">Tingkat Prioritas</Label>
              <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                <SelectTrigger className="border-border-primary bg-transparent text-text-primary">
                  <SelectValue placeholder="Prioritas" />
                </SelectTrigger>
                <SelectContent className="bg-surface-primary text-text-primary border-border-primary">
                  <SelectItem value="low">Low (Normal)</SelectItem>
                  <SelectItem value="medium">Medium (Penting)</SelectItem>
                  <SelectItem value="high">High (Kritis)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc" className="text-xs font-semibold uppercase text-text-secondary">Deskripsi & Detail Masalah</Label>
              <Textarea id="desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Jelaskan secara rinci permasalahan yang terjadi..." required className="border-border-primary bg-transparent text-text-primary min-h-[100px]" />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? <RefreshCircleLinear className="mr-1 h-4 w-4 animate-spin" /> : <TicketLinear className="mr-1 h-4 w-4" />}
              Kirim Tiket
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* List of outstanding tickets */}
      <div className="lg:col-span-2 space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <TicketLinear className="h-5 w-5 text-brand-primary" />
          Status Tiket Bantuan Anda
        </h2>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-20 animate-pulse bg-surface-secondary rounded" />
            ))}
          </div>
        ) : tickets.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {tickets.map((t) => (
              <Card key={t.id} className="bg-surface-primary border-border-primary text-text-primary">
                <div className="p-4 flex justify-between items-start gap-4">
                  <div className="space-y-1 pr-4">
                    <h3 className="font-extrabold text-base flex items-center gap-2 flex-wrap">
                      {t.subject}
                      <Badge className={cn("border-none text-[9px] uppercase font-bold tracking-wider", t.priority === 'high' ? "bg-red-500/10 text-red-500" : t.priority === 'medium' ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500")}>
                        {t.priority}
                      </Badge>
                      <Badge className="bg-surface-tertiary text-text-secondary border-none text-[9px] uppercase font-bold">
                        {t.status.replace('_', ' ')}
                      </Badge>
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed">{t.description}</p>
                    <p className="text-[10px] text-text-secondary pt-2">Dikirim pada {new Date(t.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-dashed border-border-primary rounded-xl bg-surface-primary text-xs text-text-secondary">Belum ada aduan tiket bantuan.</div>
        )}
      </div>
    </div>
  )
}
