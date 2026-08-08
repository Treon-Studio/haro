import type { APIRoute } from 'astro'
import { query } from '@/lib/neon/client'
import { runBillingEffect } from '@/lib/api-helpers'
import { checkAndIncrementQuotaProgram } from '@/domain/billing/billing.programs'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-company-id',
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}

// Mirrors the KV prefix scheme this table replaces: 'org:<companyId>' | 'personal:<userId>' | 'personal:anonymous'
async function getOwnerKey(context: any): Promise<{ ownerKey: string; errorResponse?: Response }> {
  const { request, locals } = context
  const url = new URL(request.url)
  const companyId = url.searchParams.get('companyId') || request.headers.get('x-company-id')
  const userId = locals.session?.userId

  if (companyId) {
    if (!userId) {
      return { ownerKey: '', errorResponse: json({ error: 'Unauthorized: Session required' }, 401) }
    }
    const membershipResult = await query(
      'SELECT id FROM public.company_memberships WHERE company_id = $1 AND user_id = $2 AND status = $3 LIMIT 1',
      [companyId, userId, 'active'],
    )
    if (membershipResult.rows.length === 0) {
      return { ownerKey: '', errorResponse: json({ error: 'Forbidden: You are not an active member of this organization' }, 403) }
    }
    return { ownerKey: `org:${companyId}` }
  }

  if (!userId) {
    return { ownerKey: 'personal:anonymous' }
  }
  return { ownerKey: `personal:${userId}` }
}

// GET /api/conversations - List all conversations under current context (B2B or B2C)
export const GET: APIRoute = async (context) => {
  try {
    const { ownerKey, errorResponse } = await getOwnerKey(context)
    if (errorResponse) return errorResponse

    const result = await query('SELECT data FROM conversations WHERE owner_key = $1 ORDER BY updated_at DESC', [ownerKey])
    const conversations = result.rows.map((row) => row.data)

    return json({ conversations })
  } catch (e: any) {
    return json({ error: e.message }, 500)
  }
}

// POST /api/conversations - Create or update a conversation (B2B or B2C)
export const POST: APIRoute = async (context) => {
  try {
    const body = await context.request.json()
    const { conversation } = body

    if (!conversation?.id) {
      return json({ error: 'conversation.id is required' }, 400)
    }

    const { ownerKey, errorResponse } = await getOwnerKey(context)
    if (errorResponse) return errorResponse

    // Check if the conversation is new to enforce billing quotas (prevent multiple counts)
    const existing = await query('SELECT id FROM conversations WHERE id = $1 AND owner_key = $2', [conversation.id, ownerKey])
    if (existing.rows.length === 0) {
      const url = new URL(context.request.url)
      const companyId = url.searchParams.get('companyId') || context.request.headers.get('x-company-id')

      if (companyId) {
        const billingProgram = checkAndIncrementQuotaProgram(companyId)
        const isAllowed = await runBillingEffect(context, billingProgram)
        if (!isAllowed) {
          return json({ error: "Sesi kuota perusahaan Anda telah habis untuk bulan ini." }, 403)
        }
      }
    }

    await query(
      `INSERT INTO conversations (id, owner_key, data, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [conversation.id, ownerKey, JSON.stringify(conversation), conversation.createdAt ?? new Date().toISOString()],
    )

    return json(conversation, 201)
  } catch (e: any) {
    return json({ error: e.message }, 500)
  }
}

// DELETE /api/conversations - Delete all conversations in the current context
export const DELETE: APIRoute = async (context) => {
  try {
    const { ownerKey, errorResponse } = await getOwnerKey(context)
    if (errorResponse) return errorResponse

    const result = await query('DELETE FROM conversations WHERE owner_key = $1 RETURNING id', [ownerKey])

    return json({ success: true, deleted: result.rows.length })
  } catch (e: any) {
    return json({ error: e.message }, 500)
  }
}

// OPTIONS - CORS preflight
export const OPTIONS: APIRoute = async () => {
  return new Response(null, { headers: corsHeaders() })
}
