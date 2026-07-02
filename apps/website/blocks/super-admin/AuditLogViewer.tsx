'use client'

import { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@treonstudio/bungas-core/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@treonstudio/bungas-core/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeLinear, MagniferLinear, CalendarLinear, LayersLinear, AltArrowDownLinear, AltArrowUpLinear, InfoCircleLinear, DatabaseLinear, CodeLinear, DangerTriangleLinear } from 'solar-icon-set';

type TAuditLog = {
  id: string
  timestamp: string
  level: string
  message: string
  context: Record<string, any>
  service: string
  environment: string
  error: Record<string, any> | null
}

interface AuditLogViewerProps {
  initialLogs: TAuditLog[]
}

export function AuditLogViewer({ initialLogs }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<TAuditLog[]>(initialLogs)
  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [envFilter, setEnvFilter] = useState<string>('all')
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id)
  }

  // Reactive Filter logic
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(log.context).toLowerCase().includes(searchTerm.toLowerCase())

      const matchesLevel = levelFilter === 'all' || log.level === levelFilter
      const matchesEnv = envFilter === 'all' || log.environment === envFilter

      return matchesSearch && matchesLevel && matchesEnv
    })
  }, [logs, searchTerm, levelFilter, envFilter])

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <Card className="bg-surface-primary border-border-primary text-text-primary">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* MagniferLinear */}
          <div className="relative w-full md:max-w-md">
            <MagniferLinear className="absolute left-3 top-3 h-4 w-4 text-text-secondary" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari audit trail (action, resource, context)..."
              className="pl-9 bg-transparent border-border-primary text-text-primary placeholder:text-text-secondary"
            />
          </div>

          {/* Select filters */}
          <div className="flex gap-2 w-full md:w-auto">
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="flex-1 md:flex-none h-10 px-3 py-1.5 rounded-lg border border-border-primary bg-transparent text-text-primary text-sm focus:outline-none"
            >
              <option value="all">Semua Level</option>
              <option value="audit">audit</option>
              <option value="error">error</option>
              <option value="fatal">fatal</option>
            </select>

            <select
              value={envFilter}
              onChange={(e) => setEnvFilter(e.target.value)}
              className="flex-1 md:flex-none h-10 px-3 py-1.5 rounded-lg border border-border-primary bg-transparent text-text-primary text-sm focus:outline-none"
            >
              <option value="all">Semua Environment</option>
              <option value="development">development</option>
              <option value="staging">staging</option>
              <option value="production">production</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="bg-surface-primary border-border-primary text-text-primary">
        <CardContent className="p-0">
          {filteredLogs.length > 0 ? (
            <div className="divide-y divide-border-primary">
              {filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id
                const actor = log.context?.userId || log.context?.changedBy || 'system'
                const resource = log.context?.resourceType ? `${log.context.resourceType}:${log.context.resourceId}` : '-'

                return (
                  <div key={log.id} className="transition-colors hover:bg-surface-secondary/20">
                    {/* Log Row summary */}
                    <div
                      onClick={() => toggleExpand(log.id)}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <CodeLinear className="h-4 w-4 text-brand-primary mt-1 shrink-0" />
                        <div className="space-y-1">
                          <div className="font-bold text-text-primary flex items-center gap-2 flex-wrap">
                            {log.message}
                            <Badge className="bg-purple-500/10 text-purple-500 border-none uppercase text-[9px] font-bold">
                              {log.level}
                            </Badge>
                            <Badge className="bg-surface-tertiary text-text-secondary border-none text-[9px] uppercase font-bold">
                              {log.environment}
                            </Badge>
                          </div>
                          <p className="text-xs text-text-secondary">
                            Aktor: <span className="font-semibold text-text-primary">{actor}</span> • Resource: <span className="font-semibold text-text-primary">{resource}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-text-secondary self-end sm:self-center shrink-0">
                        <span className="flex items-center gap-1">
                          <CalendarLinear className="h-3.5 w-3.5" />
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                        {isExpanded ? <AltArrowUpLinear className="h-4 w-4" /> : <AltArrowDownLinear className="h-4 w-4" />}
                      </div>
                    </div>

                    {/* Expanded Detail drawer */}
                    {isExpanded && (
                      <div className="bg-surface-secondary/30 p-5 border-t border-b border-border-primary/50 text-xs space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Metadata */}
                          <div className="space-y-2">
                            <h4 className="font-bold flex items-center gap-1.5 text-text-secondary">
                              <InfoCircleLinear className="h-4 w-4 text-brand-primary" />
                              LOG METADATA
                            </h4>
                            <div className="space-y-1 p-3 rounded-lg border border-border-primary bg-surface-primary text-text-secondary">
                              <div><span className="font-semibold">Log ID:</span> {log.id}</div>
                              <div><span className="font-semibold">Service:</span> {log.service}</div>
                              <div><span className="font-semibold">Environment:</span> {log.environment}</div>
                              <div><span className="font-semibold">Timestamp:</span> {new Date(log.timestamp).toISOString()}</div>
                            </div>
                          </div>

                          {/* Context */}
                          <div className="space-y-2">
                            <h4 className="font-bold flex items-center gap-1.5 text-text-secondary">
                              <DatabaseLinear className="h-4 w-4 text-brand-primary" />
                              CONTEXT DETAILS
                            </h4>
                            <div className="p-3 rounded-lg border border-border-primary bg-surface-primary text-text-secondary overflow-x-auto">
                              <pre className="font-mono text-[10px] leading-relaxed">
                                {JSON.stringify(log.context, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </div>

                        {/* Error payload if exists */}
                        {log.error && (
                          <div className="space-y-2 border-t border-red-500/10 pt-4">
                            <h4 className="font-bold text-red-500 flex items-center gap-1.5">
                              <DangerTriangleLinear className="h-4 w-4" />
                              ERROR PAYLOAD
                            </h4>
                            <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-500 overflow-x-auto">
                              <pre className="font-mono text-[10px] leading-relaxed">
                                {JSON.stringify(log.error, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-16 text-text-secondary">
              Tidak ada log audit yang cocok dengan filter pencarian Anda.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
