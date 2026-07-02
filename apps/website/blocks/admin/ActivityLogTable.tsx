'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@treonstudio/bungas-core/ui/card'
import { Badge } from '@treonstudio/bungas-core/ui/badge'
import { cn } from '@treonstudio/bungas-core/lib/utils'
import { RefreshCircleLinear, CodeLinear, CalendarLinear } from 'solar-icon-set';

type TLog = {
  id: string
  timestamp: string
  message: string
  context: Record<string, any>
  environment: string
}

export function ActivityLogTable({ companyId }: { companyId: string }) {
  const [logs, setLogs] = useState<TLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/companies/${companyId}/activity-log`)
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data) {
          setLogs(result.data)
        }
      })
      .catch(err => console.error('Error fetching activity logs', err))
      .finally(() => setIsLoading(false))
  }, [companyId])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center min-h-[300px]">
        <RefreshCircleLinear className="h-10 w-10 text-brand-primary animate-spin mb-4" />
        <h3 className="font-bold">Memuat Log Aktivitas...</h3>
      </div>
    )
  }

  return (
    <Card className="bg-surface-primary border-border-primary text-text-primary">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <CodeLinear className="h-5 w-5 text-brand-primary" />
          Log Aktivitas Tenant B2B
        </CardTitle>
        <CardDescription className="text-text-secondary text-xs">Rekam jejak tindakan administratif dan event operasional yang terjadi di lingkup organisasi Anda.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {logs.length > 0 ? (
          <div className="divide-y divide-border-primary">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-surface-secondary/20 transition-colors flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div className="space-y-1">
                  <div className="font-bold text-sm flex items-center gap-2">
                    {log.message}
                    <Badge className="bg-surface-tertiary text-text-secondary border-none text-[9px] uppercase font-bold">{log.environment}</Badge>
                  </div>
                  <p className="text-xs text-text-secondary">Actor ID: {log.context?.userId || log.context?.changedBy || 'system'}</p>
                </div>
                <div className="text-xs text-text-secondary flex items-center gap-1.5 shrink-0 self-end sm:self-center font-mono">
                  <CalendarLinear className="h-3.5 w-3.5" />
                  {new Date(log.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-text-secondary text-xs border border-dashed border-border-primary rounded-xl m-6 bg-surface-primary">Belum ada catatan aktivitas organisasi.</div>
        )}
      </CardContent>
    </Card>
  )
}
