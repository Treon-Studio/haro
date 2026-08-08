import { mintServiceToken } from "./auth/service-token"

const PROXY_BASE = import.meta.env.MEMORY_FABRIC_URL
  ? `${import.meta.env.MEMORY_FABRIC_URL.replace(/\/$/, "")}`
  : "https://haro-proxy.treonstudio.com"

export async function callMemoryTool(tenantSlug: string, tool: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const token = await mintServiceToken(tenantSlug)
  const res = await fetch(`${PROXY_BASE}/api/tool`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tool, args: { ...args, tenant: tenantSlug } }),
  })
  return res.json()
}

export async function listMemories(tenant: string, search?: string, limit = 20, offset = 0) {
  return callMemoryTool(tenant, "memory_search", { tenant, query: search || "", limit, offset })
}

export async function deleteMemory(tenant: string, id: string) {
  return callMemoryTool(tenant, "memory_delete", { tenant, memory_id: id })
}

export async function listGbrainPages(tenant: string) {
  return callMemoryTool(tenant, "gbrain_list", { tenant })
}

export async function listVaultFiles(tenant: string, path = "") {
  return callMemoryTool(tenant, "vault_list", { tenant, path })
}

export async function vaultRead(tenant: string, path: string) {
  return callMemoryTool(tenant, "vault_read", { tenant, path })
}
