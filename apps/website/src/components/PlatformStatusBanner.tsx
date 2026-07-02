'use client'

import { useState, useEffect } from 'react'
import { DangerTriangleLinear, InfoCircleLinear, ShieldWarningLinear, CloseCircleLinear } from 'solar-icon-set';
import { cn } from '@treonstudio/bungas-core/lib/utils'

type TPlatformStatus = {
  id: string
  message: string
  is_active: boolean
  severity: 'info' | 'warning' | 'critical'
  expected_resolution: string | null
}

export function PlatformStatusBanner() {
  const [status, setStatus] = useState<TPlatformStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/super-admin/status')
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data) {
          setStatus(result.data)
        }
      })
      .catch(() => {})
  }, [])

  if (!status || dismissed) return null

  const bgClass =
    status.severity === 'critical' ? 'bg-red-600 text-white' :
    status.severity === 'warning' ? 'bg-amber-500 text-black' :
    'bg-blue-600 text-white'

  const Icon =
    status.severity === 'critical' ? ShieldWarningLinear :
    status.severity === 'warning' ? DangerTriangleLinear :
    InfoCircleLinear

  return (
    <div className={cn("w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold leading-relaxed shrink-0 shadow-sm z-50", bgClass)}>
      <div className="flex items-center gap-2 mx-auto">
        <Icon className="h-4 w-4 shrink-0" />
        <span>
          {status.message}
          {status.expected_resolution && ` (Estimasi perbaikan: ${status.expected_resolution})`}
        </span>
      </div>
      <button onClick={() => setDismissed(true)} className="p-1 hover:bg-black/10 rounded-full border-none bg-transparent cursor-pointer text-inherit shrink-0">
        <CloseCircleLinear className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
