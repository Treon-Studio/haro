import type { APIRoute } from 'astro';
import { query } from '@/lib/neon/client';

export const GET: APIRoute = async () => {
  try {
    const { rows } = await query(
      'SELECT id, name, role, avatar_url, bio, sort_order FROM public.team_members ORDER BY sort_order ASC',
      [],
    );
    return new Response(JSON.stringify({ success: true, data: rows }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
