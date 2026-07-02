import type { APIRoute } from 'astro';
import { PROVIDERS } from '../../../blocks/chat/config/providers';
import type { Message } from '../../../blocks/chat/hooks/useChat';

const COMPATIBILITY: Record<string, string> = {
  openai: 'openai',
  deepseek: 'openai',
  openrouter: 'openai', // OpenRouter uses OpenAI-compatible API
  anthropic: 'anthropic',
  google: 'openai',
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { messages, model, webSearch, files, provider: providerId = 'openrouter', apiKey: clientApiKey } = await request.json();

    const provider = PROVIDERS[providerId];
    if (!provider) {
      return new Response(JSON.stringify({ error: `Unknown provider: ${providerId}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = (clientApiKey && !clientApiKey.startsWith('your_'))
      ? clientApiKey
      : import.meta.env[provider.apiKeyEnv] || (locals as any)?.runtime?.env?.[provider.apiKeyEnv];

    if (!apiKey || apiKey.startsWith('your_')) {
      console.error(`[CHAT API ERROR] Provider API Key missing or placeholder: ${provider.apiKeyEnv}`, { clientApiKey: clientApiKey ? '[SET]' : '[EMPTY]' });
      return new Response(JSON.stringify({ error: `No valid API key for ${provider.name}. Set it in Settings → Providers or via the ${provider.apiKeyEnv} environment variable.` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[CHAT API] Request: provider=${provider.id} model=${model} messages=${messages.length} webSearch=${webSearch}`);

    const compatibility = COMPATIBILITY[providerId] || 'openai';

    // ── OpenAI-compatible format (OpenRouter, DeepSeek, OpenAI, Google) ──
    if (compatibility === 'openai') {
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
        max_tokens: 2000 // Limit tokens to prevent 402 out-of-budget credits on OpenRouter free tier
      };

      if (webSearch && provider.supportsTools) {
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

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
      if (provider.headers) Object.assign(headers, provider.headers);

      const url = provider.baseUrl.startsWith('http')
        ? `${provider.baseUrl}/chat/completions`
        : `https://${provider.baseUrl}/chat/completions`;

      console.log(`[CHAT API] Calling ${url}...`);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[CHAT API ERROR] ${provider.name} returned status ${response.status}:`, errorText);
        return new Response(JSON.stringify({ error: `${provider.name} API error: ${response.status} ${errorText}` }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(response.body, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
      });
    }

    // ── Anthropic format ──
    if (compatibility === 'anthropic') {
      return new Response(JSON.stringify({ error: 'Anthropic streaming not yet supported in this endpoint.' }), {
        status: 501,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Unsupported provider format: ${compatibility}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[CHAT API ERROR] Catch block error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
