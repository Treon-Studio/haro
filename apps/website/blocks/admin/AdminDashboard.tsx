'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@treonstudio/bungas-core/ui/card'
import { Badge } from '@treonstudio/bungas-core/ui/badge'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer
} from 'recharts'
import { UsersGroupTwoRoundedLinear, ChatSquareLinear, RefreshCircleLinear, CalendarLinear, LockLinear } from 'solar-icon-set';

type TAnalytics = {
  total_members: number
  total_sessions: number
  dau_history: { date: string; active_users: number }[]
  is_privacy_protected: boolean
}

export function AdminDashboard({ companyId }: { companyId: string }) {
  const [data, setData] = useState<TAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/companies/${companyId}/analytics`)
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data) {
          setData(result.data)
        }
      })
      .catch(err => console.error('Error loading analytics', err))
      .finally(() => setIsLoading(false))
  }, [companyId])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
        <RefreshCircleLinear className="h-10 w-10 text-brand-primary animate-spin mb-4" />
        <h3 className="font-bold">Memuat Dashboard Analytics...</h3>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-surface-primary border-border-primary text-text-primary">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-text-secondary uppercase">Jumlah Karyawan Terdaftar</span>
              <h3 className="text-3xl font-bold">{data.total_members}</h3>
              <p className="text-[10px] text-text-secondary">Kursi terisi aktif</p>
            </div>
            <UsersGroupTwoRoundedLinear className="h-8 w-8 text-brand-primary" />
          </CardContent>
        </Card>

        <Card className="bg-surface-primary border-border-primary text-text-primary">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-text-secondary uppercase">Total Sesi Obrolan</span>
              <h3 className="text-3xl font-bold">{data.is_privacy_protected ? 'N/A' : data.total_sessions}</h3>
              <p className="text-[10px] text-text-secondary">{data.is_privacy_protected ? 'Dilindungi (Anggota < 5)' : 'Jumlah total sesi obrolan'}</p>
            </div>
            <ChatSquareLinear className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Chart with Blocker ShieldMinimalisticLinear overlay */}
      <Card className="bg-surface-primary border-border-primary text-text-primary relative overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <CalendarLinear className="h-5 w-5 text-brand-primary" />
            Aktifitas Harian Karyawan (Last 30 Days)
          </CardTitle>
          <CardDescription className="text-text-secondary text-xs">Menampilkan jumlah harian karyawan aktif (DAU) yang berkonsultasi.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          {data.is_privacy_protected ? (
            /* 3. HIPAA ShieldMinimalisticLinear Overlay (Choice A) */
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-surface-primary/95 z-10 space-y-4">
              <div className="h-14 w-14 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                <LockLinear className="h-7 w-7" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h4 className="font-extrabold text-base">Proteksi Privasi Aktif (Anonymity ShieldMinimalisticLinear)</h4>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Untuk melindungi kerahasiaan karyawan di organisasi kecil, statistik harian dinonaktifkan hingga organisasi Anda memiliki minimal <strong className="text-text-primary">5 anggota aktif</strong>. Saat ini Anda memiliki <strong className="text-brand-primary">{data.total_members} anggota</strong>.
                </p>
              </div>
            </div>
          ) : (
            /* Render line chart if ≥ 5 members */
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.dau_history} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="#8e8ea0" fontSize={11} />
                <YAxis stroke="#8e8ea0" fontSize={11} allowDecimals={false} />
                <ChartTooltip contentStyle={{ background: '#2f2f2f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                <Line type="monotone" dataKey="active_users" name="Active UsersGroupTwoRoundedLinear" stroke="#9B5B3E" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
