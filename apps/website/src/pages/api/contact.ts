import type { APIRoute } from 'astro';
import { query } from '@/lib/neon/client';

export const POST: APIRoute = async (context) => {
  try {
    const body = await context.request.json();
    const { name, email, subject, message } = body;

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: 'Name, email, and message are required' }), { status: 400 });
    }

    await query(
      'INSERT INTO public.contact_messages (name, email, subject, message, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [name, email, subject || null, message],
    );

    return new Response(JSON.stringify({ success: true }), { status: 201 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
