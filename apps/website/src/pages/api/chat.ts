import type { APIRoute } from 'astro';
import type { Message } from '../../../blocks/chat/hooks/useChat';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { messages, model, webSearch, files } = await request.json();

    const gatewayUrl = (import.meta.env.GATEWAY_URL || 'http://localhost:8787').replace(/\/+$/, '');

    const formattedMessages = messages.map((m: Message) => {
      if (m.role === 'user' && m.attachments?.length) {
        const contentBlocks: any[] = [];
        if (m.content) contentBlocks.push({ type: 'text', text: m.content });
        for (const file of m.attachments) {
          if (file.type.startsWith('image/') && file.dataUrl) {
            contentBlocks.push({ type: 'image_url', image_url: { url: file.dataUrl, detail: 'auto' } });
          }
        }
        return { role: m.role, content: contentBlocks };
      }
      return { role: m.role, content: m.content };
    });

    const requestBody: Record<string, any> = {
      model,
      messages: formattedMessages,
      stream: true,
      max_tokens: 2000,
    };

    if (webSearch) {
      requestBody.tools = [
        {
          type: 'function',
          function: {
            name: 'web_search',
            description: 'Search the web for current information',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                recency_days: { type: 'number', description: 'Limit to past days. Optional.' },
              },
              required: ['query'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'image_generation',
            description: 'Generate an image from a text description',
            parameters: {
              type: 'object',
              properties: {
                prompt: { type: 'string', description: 'Text description of the image' },
                aspect_ratio: { type: 'string', enum: ['1:1', '16:9', '9:16', '4:3'] },
              },
              required: ['prompt'],
            },
          },
        },
      ];
      requestBody.tool_choice = 'auto';
    }

    const url = `${gatewayUrl}/v1/chat/completions`;

    console.log(`[CHAT API] Calling gateway at ${url} model=${model} messages=${messages.length} webSearch=${webSearch}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-haro-config-id': 'haro-assistant-default',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CHAT API ERROR] Gateway returned status ${response.status}:`, errorText);
      return new Response(JSON.stringify({ error: `Gateway API error: ${response.status} ${errorText}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });
  } catch (error: any) {
    console.error('[CHAT API ERROR] Catch block error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
