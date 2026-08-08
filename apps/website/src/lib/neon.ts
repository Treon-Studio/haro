import { query } from "@/lib/neon/client"

export interface Memory {
  id: string
  user_id: string
  agent_id: string
  messages: unknown
  metadata: unknown
  created_at: string
  updated_at: string
}

export interface GbrainPage {
  id: string
  slug: string
  title: string
  type: string
  body: string
  tenant: string
  created_at: string
  updated_at: string
}

export interface VaultFile {
  id: string
  path: string
  tenant: string
  size: number
  updated_at: string
}

export async function ensureTables(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS memories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      messages JSONB DEFAULT '[]',
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS gbrain_pages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'page',
      body TEXT DEFAULT '',
      tenant TEXT NOT NULL DEFAULT 'default',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS vault_files (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      path TEXT NOT NULL,
      tenant TEXT NOT NULL DEFAULT 'default',
      size BIGINT DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

export async function listMemories(search?: string, limit = 20, offset = 0): Promise<{ rows: Memory[]; total: number }> {
  let where = ""
  const params: unknown[] = []
  if (search) {
    where = "WHERE messages::text ILIKE $1"
    params.push(`%${search}%`)
  }
  const countResult = await query(`SELECT COUNT(*) as total FROM memories ${where}`, params)
  const total = Number(countResult.rows[0].total)
  const limitIdx = params.length + 1
  const offsetIdx = params.length + 2
  const dataResult = await query(
    `SELECT * FROM memories ${where} ORDER BY created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...params, limit, offset],
  )
  return { rows: dataResult.rows as Memory[], total }
}

export async function deleteMemory(id: string): Promise<void> {
  await query("DELETE FROM memories WHERE id = $1", [id])
}

export async function listGbrainPages(): Promise<GbrainPage[]> {
  const result = await query("SELECT * FROM gbrain_pages ORDER BY created_at DESC")
  return result.rows as GbrainPage[]
}

export async function listVaultFiles(): Promise<VaultFile[]> {
  const result = await query("SELECT * FROM vault_files ORDER BY updated_at DESC")
  return result.rows as VaultFile[]
}
