import type { APIRoute } from 'astro'
import { query } from '@/lib/neon/client'

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

// GET /api/conversations/[id]
export const GET: APIRoute = async (context) => {
  const { id } = context.params
  if (!id) return json({ error: 'ID is required' }, 400)

  try {
    const { ownerKey, errorResponse } = await getOwnerKey(context)
    if (errorResponse) return errorResponse

    const result = await query('SELECT data FROM conversations WHERE id = $1 AND owner_key = $2', [id, ownerKey])
    if (result.rows.length === 0) return json({ error: 'Conversation not found' }, 404)

    return json(result.rows[0].data)
  } catch (e: any) {
    return json({ error: e.message }, 500)
  }
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { headers: corsHeaders() })
}
