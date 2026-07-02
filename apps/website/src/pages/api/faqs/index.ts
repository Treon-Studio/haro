import type { APIRoute } from 'astro';
import { query } from '@/lib/neon/client';

export const GET: APIRoute = async () => {
  try {
    const { rows } = await query(
      'SELECT id, question, answer, category, sort_order, created_at FROM public.faqs ORDER BY sort_order ASC, created_at DESC',
      [],
    );
    return new Response(JSON.stringify({ success: true, data: rows }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
