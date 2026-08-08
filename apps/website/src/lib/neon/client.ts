import { neon } from "@neondatabase/serverless"

const getSql = () => {
  const url = import.meta.env.NEON_DATABASE_URL
  if (!url) throw new Error("NEON_DATABASE_URL not set")
  return neon(url)
}

export interface QueryResult {
  rows: Record<string, unknown>[]
  rowCount: number
}

type QueryInput = TemplateStringsArray | string

export async function query(
  strings: QueryInput,
  ...params: unknown[]
): Promise<QueryResult> {
  const sql = getSql()
  const isTagged = typeof strings !== "string"
  if (isTagged) {
    const result = await sql(strings as TemplateStringsArray, ...params)
    return { rows: result as Record<string, unknown>[], rowCount: result.length }
  }
  const result = await sql(strings as string, ...params)
  return { rows: result as Record<string, unknown>[], rowCount: result.length }
}

interface NeonClient {
  query(sql: string, params?: unknown[]): Promise<QueryResult>
}

export async function transaction<T>(
  fn: (client: NeonClient) => Promise<T>,
): Promise<T> {
  const sql = getSql()
  const client: NeonClient = {
    async query(q: string, p?: unknown[]) {
      const result = await sql(q, p ?? [])
      return {
        rows: result as Record<string, unknown>[],
        rowCount: result.length,
      }
    },
  }
  return fn(client)
}
