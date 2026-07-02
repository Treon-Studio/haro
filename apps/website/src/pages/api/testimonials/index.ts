import type { APIRoute } from 'astro';
import { query } from '@/lib/neon/client';

export const GET: APIRoute = async () => {
  try {
    const { rows } = await query(
      'SELECT id, author_name, author_title, author_avatar, content, sort_order FROM public.testimonials ORDER BY sort_order ASC',
      [],
    );
    return new Response(JSON.stringify({ success: true, data: rows }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
