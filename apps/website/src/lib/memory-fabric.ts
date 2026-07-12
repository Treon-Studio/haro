const PROXY_BASE = import.meta.env.MEMORY_FABRIC_URL
  ? `${import.meta.env.MEMORY_FABRIC_URL.replace(/\/$/, "")}`
  : "https://haro-proxy.treonstudio.com"

const MANAGEMENT_API_KEY = import.meta.env.MANAGEMENT_API_KEY || ""

export async function callMemoryTool(tool: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const res = await fetch(`${PROXY_BASE}/api/tool`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(MANAGEMENT_API_KEY ? { Authorization: `Bearer ${MANAGEMENT_API_KEY}` } : {}),
    },
    body: JSON.stringify({ tool, args }),
  })
  return res.json()
}

export async function listMemories(tenant: string, search?: string, limit = 20, offset = 0) {
  return callMemoryTool("memory_search", { tenant, query: search || "", limit, offset })
}

export async function deleteMemory(tenant: string, id: string) {
  return callMemoryTool("memory_delete", { tenant, memory_id: id })
}

export async function listGbrainPages(tenant: string) {
  return callMemoryTool("gbrain_list", { tenant })
}

export async function listVaultFiles(tenant: string, path = "") {
  return callMemoryTool("vault_list", { tenant, path })
}

export async function vaultRead(tenant: string, path: string) {
  return callMemoryTool("vault_read", { tenant, path })
}
