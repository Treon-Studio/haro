export type TraceContext = {
  readonly version: string
  readonly traceId: string
  readonly spanId: string
  readonly traceFlags: string
}

function hex(length: number): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, length)
}

export function generateTraceparent(traceId?: string, spanId?: string): string {
  const tid = traceId ?? hex(32)
  const sid = spanId ?? hex(16)
  return `00-${tid}-${sid}-01`
}

export function parseTraceparent(header: string): TraceContext | null {
  if (!header) return null

  const parts = header.split("-")
  if (parts.length !== 4) return null

  const [version, traceId, spanId, traceFlags] = parts
  if (version !== "00") return null
  if (!/^[0-9a-f]{32}$/.test(traceId)) return null
  if (!/^[0-9a-f]{16}$/.test(spanId)) return null
  if (!/^[0-9a-f]{2}$/.test(traceFlags)) return null

  return { version, traceId, spanId, traceFlags }
}
