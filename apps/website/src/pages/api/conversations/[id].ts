import type { APIRoute } from 'astro'
import { query } from '@/lib/neon/client'

function getKv(locals: any) {
  return locals?.runtime?.env?.CONVERSATIONS
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
async function getPrefixAndKey(context: any, conversationId: string): Promise<{ key: string | null; errorResponse?: Response }> {
  const { request, locals } = context
  const kv = getKv(locals)
  if (!kv) {
    return { key: null, errorResponse: json({ error: 'KV not available (dev mode)' }, 503) }
  }

  const url = new URL(request.url)
  const companyId = url.searchParams.get('companyId') || request.headers.get('x-company-id')
  const userId = locals.session?.userId

  if (companyId) {
    // 1. B2B Multi-tenant flow: Validate user belongs to company
    if (!userId) {
      return { key: null, errorResponse: json({ error: 'Unauthorized: Session required' }, 401) }
    }

    const membershipResult = await query(
      'SELECT id FROM public.company_memberships WHERE company_id = $1 AND user_id = $2 AND status = $3 LIMIT 1',
      [companyId, userId, 'active']
    )

    if (membershipResult.rows.length === 0) {
      return { key: null, errorResponse: json({ error: 'Forbidden: You are not an active member of this organization' }, 403) }
    }

    const prefix = `conv:org:${companyId}:`
    const key = `${prefix}${conversationId}`
    return { key }
  } else {
    // 2. B2C Personal flow: Isolate by user ID
    if (!userId) {
      // Dev mode or unauthenticated fallback
      const prefix = 'conv:personal:anonymous:'
      const key = `${prefix}${conversationId}`
      return { key }
    }

    const prefix = `conv:personal:${userId}:`
    const key = `${prefix}${conversationId}`
    return { key }
  }
}

// GET /api/conversations/[id]
export const GET: APIRoute = async (context) => {
  const { id } = context.params
  if (!id) return json({ error: 'ID is required' }, 400)

  const kv = getKv(context.locals)
  if (!kv) return json({ error: 'KV not available (dev mode)' }, 503)

  try {
    const { key, errorResponse } = await getPrefixAndKey(context, id)
    if (errorResponse) return errorResponse
    if (!key) return json({ error: 'Invalid key construction' }, 400)

    const raw = await kv.get(key)
    if (!raw) return json({ error: 'Conversation not found' }, 404)

    return json(JSON.parse(raw))
  } catch (e: any) {
    return json({ error: e.message }, 500)
  }
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { headers: corsHeaders() })
}
