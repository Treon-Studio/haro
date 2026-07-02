'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@treonstudio/bungas-core/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@treonstudio/bungas-core/ui/badge'
import { cn } from '@treonstudio/bungas-core/lib/utils'
import { RefreshCircleLinear, CheckCircleLinear, DangerTriangleLinear } from 'solar-icon-set';

type TFlag = {
  flag: string
  enabled: boolean
}

export function FeatureFlagToggler({ companyId }: { companyId: string }) {
  const [flags, setFlags] = useState<TFlag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null) // flag currently toggling

  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchFlags = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/super-admin/features?companyId=${companyId}`)
      const result = await res.json()
      if (result.success && result.data) {
        setFlags(result.data)
      }
    } catch (err) {
      console.error('Error fetching flags', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchFlags()
  }, [companyId])

  const handleToggle = async (flag: string, currentEnabled: boolean) => {
    setIsSubmitting(flag)
    setSuccess(null)
    setError(null)

    try {
      const res = await fetch('/api/super-admin/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, flag, enabled: !currentEnabled })
      })
      const result = await res.json()
      if (result.success) {
        setSuccess(`Sukses merubah status fitur "${flag}"!`)
        fetchFlags()
      } else {
        setError(result.error?.message || 'Gagal mengubah fitur')
      }
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setIsSubmitting(null)
    }
  }

  // Pre-configured B2B extended list of modular features (Mood tracker, bookmarks, goals, custom agents etc.)
  const ALL_B2B_FLAGS = [
    { key: 'mood_checkin', label: 'Clinical Mood Check-Ins (EPIC-14)', desc: 'Mengaktifkan form popup perasaan harian bagi karyawan saat chat dimulai.' },
    { key: 'goals_library', label: 'Mental Wellness Goals (EPIC-15)', desc: 'Membuka tab target perbaikan kebiasaan harian tim.' },
    { key: 'bookmarks', label: 'Bookmark & Favorite Messages', desc: 'Mengizinkan pengguna menyimpan pesan klinis penenang ke arsip pribadi.' },
    { key: 'skills_library', label: 'Clinical Self-Guided Exercises', desc: 'Membuka pustaka modul meditasi dan pernapasan mandiri bagi tim.' }
  ]

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center min-h-[300px]">
        <RefreshCircleLinear className="h-10 w-10 text-brand-primary animate-spin mb-4" />
        <h3 className="font-bold">Memuat Fitur Tenant...</h3>
      </div>
    )
  }

  return (
    <Card className="bg-surface-primary border-border-primary text-text-primary">
      <CardHeader>
        <CardTitle className="text-xl font-bold">B2B Feature Toggles</CardTitle>
        <CardDescription className="text-text-secondary text-xs">Aktifkan atau matikan kapabilitas fungsionalitas modul-modul modular khusus untuk tenant B2B ini.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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

        <div className="divide-y divide-border-primary">
          {ALL_B2B_FLAGS.map((f) => {
            const matchedFlag = flags.find(row => row.flag === f.key)
            const isEnabled = matchedFlag ? matchedFlag.enabled : false

            return (
              <div key={f.key} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div className="space-y-1 pr-4">
                  <h4 className="font-bold text-sm text-text-primary">{f.label}</h4>
                  <p className="text-xs text-text-secondary leading-relaxed">{f.desc}</p>
                </div>

                <Button
                  onClick={() => handleToggle(f.key, isEnabled)}
                  disabled={isSubmitting !== null}
                  className={cn(
                    "text-xs font-bold px-3 py-1.5 h-8 border-none text-white",
                    isEnabled
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-green-600 hover:bg-green-700"
                  )}
                >
                  {isSubmitting === f.key ? (
                    <RefreshCircleLinear className="h-4 w-4 animate-spin" />
                  ) : isEnabled ? (
                    'Disable'
                  ) : (
                    'Enable'
                  )}
                </Button>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
