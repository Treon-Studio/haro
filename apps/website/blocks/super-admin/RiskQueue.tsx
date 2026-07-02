'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@treonstudio/bungas-core/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@treonstudio/bungas-core/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@treonstudio/bungas-core/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@treonstudio/bungas-core/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@treonstudio/bungas-core/ui/select'
import { ShieldWarningLinear, UsersGroupTwoRoundedLinear, PulseLinear, UserCheckLinear, CheckCircleLinear, RefreshCircleLinear, ClockCircleLinear, ClipboardCheckLinear, AddCircleLinear, CloseCircleLinear } from 'solar-icon-set';

type TEscalationCase = {
  id: string
  risk_flag_id: string
  company_id: string
  status: 'open' | 'assigned' | 'resolved' | 'dismissed'
  primary_assignee: string | null
  followup_attempts: { date: string; notes: string }[]
  created_at: string
}

export function RiskQueue() {
  const [cases, setCases] = useState<TEscalationCase[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCase, setSelectedCase] = useState<TEscalationCase | null>(null)
  const [followupNotes, setFollowupNotes] = useState('')
  const [resolveOutcome, setResolveOutcome] = useState<'referred_to_psychologist' | 'resolved_offline' | 'dismissed_false_positive'>('resolved_offline')
  const [resolveNotes, setResolveNotes] = useState('')
  const [isActionLoading, setIsActionLoading] = useState(false)

  const fetchRiskCases = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/super-admin/risk/cases')
      const result = await res.json()
      if (result.success && result.data) {
        setCases(result.data)
      }
    } catch (err) {
      console.error('Error fetching clinical cases', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRiskCases()

    const interval = setInterval(() => {
      fetchRiskCases()
    }, 15000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  const handleAssign = async (caseId: string) => {
    setIsActionLoading(true)
    try {
      const res = await fetch(`/api/super-admin/risk/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign', assigneeId: 'clinical_user' }) // session user
      })
      const result = await res.json()
      if (result.success) {
        fetchRiskCases()
        setSelectedCase(null)
      }
    } catch (err) {
      console.error('Error assigning case', err)
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleAddFollowup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCase || !followupNotes.trim() || isActionLoading) return

    setIsActionLoading(true)
    try {
      const res = await fetch(`/api/super-admin/risk/cases/${selectedCase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'log_attempt', notes: followupNotes.trim() })
      })
      const result = await res.json()
      if (result.success) {
        setFollowupNotes('')
        fetchRiskCases()
        setSelectedCase(null)
      }
    } catch (err) {
      console.error('Error adding followup', err)
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCase || isActionLoading) return

    setIsActionLoading(true)
    try {
      const res = await fetch(`/api/super-admin/risk/cases/${selectedCase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', outcome: resolveOutcome, notes: resolveNotes })
      })
      const result = await res.json()
      if (result.success) {
        setResolveNotes('')
        setSelectedCase(null)
        fetchRiskCases()
      }
    } catch (err) {
      console.error('Error resolving case', err)
    } finally {
      setIsActionLoading(false)
    }
  }

  const criticalQueue = cases.filter(c => c.status === 'open')
  const assignedQueue = cases.filter(c => c.status === 'assigned')

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* 1. Critical Queue (Open Crises) */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2 text-red-500">
          <ShieldWarningLinear className="h-5 w-5 animate-pulse" />
          Critical Queue (Unassigned)
        </h2>
        {isLoading ? (
          <div className="h-20 animate-pulse bg-surface-secondary rounded" />
        ) : criticalQueue.length > 0 ? (
          criticalQueue.map(c => (
            <Card key={c.id} className="bg-surface-primary border-red-500/20 text-text-primary hover:border-red-500/40 transition-colors cursor-pointer" onClick={() => setSelectedCase(c)}>
              <div className="p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-sm">Case {c.id.slice(0,8)}</h3>
                  <p className="text-[10px] text-text-secondary">Opened: {new Date(c.created_at).toLocaleString()}</p>
                </div>
                <Badge className="bg-red-500/10 text-red-500 border-none text-[10px] uppercase font-bold">Open</Badge>
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center py-8 text-text-secondary border border-dashed border-border-primary rounded-lg text-xs">Antrean aman. Tidak ada krisis mendesak.</div>
        )}
      </div>

      {/* 2. Assigned Triage Queue */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2 text-brand-primary">
          <PulseLinear className="h-5 w-5" />
          Assigned & In-Followup
        </h2>
        {isLoading ? (
          <div className="h-20 animate-pulse bg-surface-secondary rounded" />
        ) : assignedQueue.length > 0 ? (
          assignedQueue.map(c => (
            <Card key={c.id} className="bg-surface-primary border-border-primary text-text-primary hover:border-brand-primary/30 transition-colors cursor-pointer" onClick={() => setSelectedCase(c)}>
              <div className="p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-sm">Case {c.id.slice(0,8)}</h3>
                  <p className="text-[10px] text-text-secondary">Assignee: {c.primary_assignee || 'Assigned'}</p>
                </div>
                <Badge className="bg-brand-primary/10 text-brand-primary border-none text-[10px] uppercase font-bold">Assigned</Badge>
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center py-8 text-text-secondary border border-dashed border-border-primary rounded-lg text-xs">Tidak ada kasus penanganan aktif.</div>
        )}
      </div>

      {/* Triage & Management Dialog */}
      {selectedCase && (
        <Dialog open={!!selectedCase} onOpenChange={(open) => !open && setSelectedCase(null)}>
          <DialogContent className="bg-surface-primary text-text-primary border-border-primary max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardCheckLinear className="h-5 w-5 text-brand-primary" />
                Manage Case {selectedCase.id.slice(0,8)}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs text-text-secondary">
              <div>Status Kasus: <Badge className="border-none bg-brand-primary/10 text-brand-primary uppercase font-bold text-[9px]">{selectedCase.status}</Badge></div>

              {selectedCase.status === 'open' ? (
                <div className="space-y-2">
                  <p>Kasus ini belum ditugaskan kepada siapa pun. Ambil alih untuk memulai pelacakan penanganan.</p>
                  <Button onClick={() => handleAssign(selectedCase.id)} className="w-full bg-brand-primary text-white">
                    {isActionLoading ? <RefreshCircleLinear className="h-4 w-4 animate-spin" /> : <UserCheckLinear className="h-4 w-4 mr-1" />}
                    Ambil Alih Kasus
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Followup logs */}
                  <div className="space-y-1.5 p-3 rounded bg-surface-secondary/50 border border-border-primary">
                    <span className="font-bold text-text-primary block mb-1">Riwayat Follow-Up:</span>
                    {selectedCase.followup_attempts.length > 0 ? (
                      selectedCase.followup_attempts.map((att, i) => (
                        <div key={i} className="border-b border-border-primary last:border-none pb-1 mb-1">
                          <div className="text-[10px] text-text-secondary font-mono">{new Date(att.date).toLocaleString()}</div>
                          <p className="text-text-primary mt-0.5">{att.notes}</p>
                        </div>
                      ))
                    ) : (
                      <p className="italic">Belum ada aktivitas follow-up yang dicatat.</p>
                    )}
                  </div>

                  {/* Add Followup Form */}
                  <form onSubmit={handleAddFollowup} className="space-y-2">
                    <Label htmlFor="notes" className="font-bold text-text-primary">Catat Aktivitas Follow-up Baru</Label>
                    <Input id="notes" value={followupNotes} onChange={e => setFollowupNotes(e.target.value)} placeholder="Tulis catatan, e.g. Telah melakukan panggilan telepon..." required className="border-border-primary bg-transparent text-text-primary" />
                    <Button type="submit" disabled={isActionLoading} className="w-full">
                      {isActionLoading ? <RefreshCircleLinear className="h-4 w-4 animate-spin" /> : 'Log Aktivitas'}
                    </Button>
                  </form>

                  {/* Resolve Form */}
                  <form onSubmit={handleResolve} className="space-y-2 border-t border-border-primary pt-4">
                    <Label htmlFor="outcome" className="font-bold text-text-primary">Selesaikan & Tutup Kasus</Label>
                    <Select value={resolveOutcome} onValueChange={(val: any) => setResolveOutcome(val)}>
                      <SelectTrigger className="border-border-primary bg-transparent text-text-primary">
                        <SelectValue placeholder="Pilih Hasil" />
                      </SelectTrigger>
                      <SelectContent className="bg-surface-primary text-text-primary border-border-primary">
                        <SelectItem value="referred_to_psychologist">Dirujuk ke Psikolog Offline</SelectItem>
                        <SelectItem value="resolved_offline">Selesai via Konseling</SelectItem>
                        <SelectItem value="dismissed_false_positive">Salah Deteksi (False Positive)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} placeholder="Tulis rincian penutupan kasus..." required className="border-border-primary bg-transparent text-text-primary animate-none" />
                    <Button type="submit" disabled={isActionLoading} className="w-full bg-green-600 hover:bg-green-700 text-white border-none">
                      {isActionLoading ? <RefreshCircleLinear className="h-4 w-4 animate-spin" /> : 'Selesaikan Kasus'}
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
