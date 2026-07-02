import type { APIRoute } from 'astro'
import { query } from '@/lib/neon/client'
import { runBillingEffect } from '@/lib/api-helpers'
import { checkAndIncrementQuotaProgram } from '@/domain/billing/billing.programs'

function getKv(locals: any) {
  return locals?.runtime?.env?.CONVERSATIONS
}

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

// Helper to determine the key prefix based on B2B company context or personal user context
async function getPrefixAndKey(context: any, conversationId?: string): Promise<{ prefix: string; key: string | null; errorResponse?: Response }> {
  const { request, locals } = context
  const kv = getKv(locals)
  if (!kv) {
    return { prefix: '', key: null, errorResponse: json({ error: 'KV not available (dev mode)' }, 503) }
  }

  const url = new URL(request.url)
  const companyId = url.searchParams.get('companyId') || request.headers.get('x-company-id')
  const userId = locals.session?.userId

  if (companyId) {
    // 1. B2B Multi-tenant flow: Validate user belongs to company
    if (!userId) {
      return { prefix: '', key: null, errorResponse: json({ error: 'Unauthorized: Session required' }, 401) }
    }

    const membershipResult = await query(
      'SELECT id FROM public.company_memberships WHERE company_id = $1 AND user_id = $2 AND status = $3 LIMIT 1',
      [companyId, userId, 'active']
    )

    if (membershipResult.rows.length === 0) {
      return { prefix: '', key: null, errorResponse: json({ error: 'Forbidden: You are not an active member of this organization' }, 403) }
    }

    const prefix = `conv:org:${companyId}:`
    const key = conversationId ? `${prefix}${conversationId}` : null
    return { prefix, key }
  } else {
    // 2. B2C Personal flow: Isolate by user ID
    if (!userId) {
      // Dev mode or unauthenticated fallback (for testing/local development)
      const prefix = 'conv:personal:anonymous:'
      const key = conversationId ? `${prefix}${conversationId}` : null
      return { prefix, key }
    }

    const prefix = `conv:personal:${userId}:`
    const key = conversationId ? `${prefix}${conversationId}` : null
    return { prefix, key }
  }
}

// GET /api/conversations - List all conversations under current context (B2B or B2C)
export const GET: APIRoute = async (context) => {
  const kv = getKv(context.locals)
  if (!kv) return json({ conversations: [], error: 'KV not available (dev mode)' })

  try {
    const { prefix, errorResponse } = await getPrefixAndKey(context)
    if (errorResponse) return errorResponse

    const list = await kv.list({ prefix })
    const conversations: any[] = []

    for (const key of list.keys) {
      const raw = await kv.get(key.name)
      if (raw) {
        try {
          conversations.push(JSON.parse(raw))
        } catch {}
      }
    }

    // Sort by updatedAt descending
    conversations.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )

    return json({ conversations })
  } catch (e: any) {
    return json({ error: e.message }, 500)
  }
}

// POST /api/conversations - Create or update a conversation (B2B or B2C)
export const POST: APIRoute = async (context) => {
  const kv = getKv(context.locals)
  if (!kv) return json({ error: 'KV not available (dev mode)' }, 503)

  try {
    const body = await context.request.json()
    const { conversation } = body

    if (!conversation?.id) {
      return json({ error: 'conversation.id is required' }, 400)
    }

    const { key, errorResponse } = await getPrefixAndKey(context, conversation.id)
    if (errorResponse) return errorResponse
    if (!key) return json({ error: 'Invalid key construction' }, 400)

    // Check if the conversation is new to enforce billing quotas (prevent multiple counts)
    const exists = await kv.get(key)
    if (!exists) {
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

    await kv.put(key, JSON.stringify(conversation))
    return json(conversation, 201)
  } catch (e: any) {
    return json({ error: e.message }, 500)
  }
}

// DELETE /api/conversations - Delete all conversations in the current context
export const DELETE: APIRoute = async (context) => {
  const kv = getKv(context.locals)
  if (!kv) return json({ error: 'KV not available (dev mode)' }, 503)

  try {
    const { prefix, errorResponse } = await getPrefixAndKey(context)
    if (errorResponse) return errorResponse

    const list = await kv.list({ prefix })
    const deletions: Promise<void>[] = []

    for (const key of list.keys) {
      deletions.push(kv.delete(key.name))
    }

    await Promise.all(deletions)
    return json({ success: true, deleted: list.keys.length })
  } catch (e: any) {
    return json({ error: e.message }, 500)
  }
}

// OPTIONS - CORS preflight
export const OPTIONS: APIRoute = async () => {
  return new Response(null, { headers: corsHeaders() })
}
