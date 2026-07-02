export type PiiField =
  | "email"
  | "phone"
  | "ssn"
  | "creditCard"
  | "taxId"
  | "fullName"
  | "address"
  | "dob"
  | "ipAddress"
  | "authToken"
  | "sessionToken"
  | "password"
  | "apiKey"

const PII_FIELD_NAMES = new Set([
  "email",
  "phone",
  "ssn",
  "creditcard",
  "taxid",
  "fullname",
  "address",
  "dob",
  "ipaddress",
  "authtoken",
  "sessiontoken",
  "password",
  "apikey",
])

const REDACTED = "[REDACTED]"

function isPiiField(key: string): boolean {
  const normalized = key.replace(/[_-]/g, "").toLowerCase()
  return PII_FIELD_NAMES.has(normalized)
}

function redactValue(value: unknown): unknown {
  if (value === null || value === undefined) return REDACTED
  if (Array.isArray(value)) return value.map(redactValue)
  if (typeof value === "object" && !(value instanceof Date)) {
    return redactFields(value as Record<string, unknown>)
  }
  return REDACTED
}

const CONTENT_PATTERNS: { regex: RegExp; replacement: string }[] = [
  { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: REDACTED },
  { regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: REDACTED },
  { regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: REDACTED },
  { regex: /\bsk-[A-Za-z0-9]{20,}\b/g, replacement: REDACTED },
  { regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: REDACTED },
  { regex: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g, replacement: REDACTED },
  { regex: /(?<!\w)::1(?!\w)/g, replacement: REDACTED },
  { regex: /\b\d{3}-\d{3}-\d{4}\b/g, replacement: REDACTED },
  { regex: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, replacement: REDACTED },
  { regex: /\bBearer\s+[A-Za-z0-9_-]{20,}\b/gi, replacement: "Bearer [REDACTED]" },
]

export function redactContent(message: string): string {
  let result = message
  for (const pattern of CONTENT_PATTERNS) {
    result = result.replace(pattern.regex, pattern.replacement)
  }
  return result
}

export function redactFields(record: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    if (isPiiField(key)) {
      result[key] = redactValue(value)
    } else if (value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      result[key] = redactFields(value as Record<string, unknown>)
    } else if (Array.isArray(value)) {
      result[key] = value.map((item: unknown) => {
        if (item !== null && typeof item === "object") return redactFields(item as Record<string, unknown>)
        return item
      })
    } else {
      result[key] = value
    }
  }
  return result
}
