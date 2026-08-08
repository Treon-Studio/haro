const PROXY_BASE = import.meta.env.MEMORY_FABRIC_URL
  ? `${import.meta.env.MEMORY_FABRIC_URL.replace(/\/$/, "")}/api/tenants`
  : "https://haro-proxy.treonstudio.com/api/tenants"

async function fetchTenantAPI(path: string, options?: RequestInit) {
  const apiKey = import.meta.env.MANAGEMENT_API_KEY
  const res = await fetch(`${PROXY_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...options?.headers,
    },
  })
  return res.json()
}

export async function listTenants(params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : ""
  return fetchTenantAPI(qs)
}

export async function getTenant(slug: string) {
  return fetchTenantAPI(`/${slug}`)
}

export async function suspendTenant(slug: string, reason: string) {
  return fetchTenantAPI(`/${slug}/suspend`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
}

export async function reactivateTenant(slug: string, reason: string) {
  return fetchTenantAPI(`/${slug}/reactivate`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
}

export async function scheduleDeleteTenant(slug: string, reason: string) {
  return fetchTenantAPI(`/${slug}/schedule-delete`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
}

export async function getTenantStats(slug: string) {
  return fetchTenantAPI(`/${slug}/stats`)
}
