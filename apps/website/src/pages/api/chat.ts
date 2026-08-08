import type { APIRoute } from 'astro';
import type { Message } from '../../../blocks/chat/hooks/useChat';
import {
  runAssistantTurn,
  createGatewayClient,
  WEB_SEARCH_TOOL,
  IMAGE_GENERATION_TOOL,
  webSearchExecutor,
  createImageGenerationExecutor,
} from '@/domain/assistant';
import type { GatewayMessage, ToolDefinition, TurnEvent } from '@/domain/assistant';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { messages, model, webSearch } = await request.json();

    const gatewayUrl = (import.meta.env.GATEWAY_URL || 'http://localhost:8787').replace(/\/+$/, '');

    const formattedMessages: GatewayMessage[] = messages.map((m: Message) => {
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

    const tools: ToolDefinition[] | undefined = webSearch ? [WEB_SEARCH_TOOL, IMAGE_GENERATION_TOOL] : undefined;
    const gatewayClient = createGatewayClient(gatewayUrl, 'haro-assistant-default');
    const toolExecutors = {
      web_search: webSearchExecutor,
      image_generation: createImageGenerationExecutor(import.meta.env.OPENROUTER_IMAGE_API_KEY || ''),
    };

    console.log(`[CHAT API] runAssistantTurn model=${model} messages=${messages.length} webSearch=${webSearch}`);

    const turnIterator = runAssistantTurn(
      { messages: formattedMessages, model, tools, maxTokens: 2000 },
      { gatewayClient, toolExecutors },
    );

    let firstResult: IteratorResult<TurnEvent>;
    try {
      firstResult = await turnIterator.next();
    } catch (error: any) {
      console.error('[CHAT API ERROR] Gateway call failed:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status ?? 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function emit(event: TurnEvent) {
          if (event.type === 'content') {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: event.text } }] })}\n\n`));
          } else if (event.type === 'error') {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: event.message })}\n\n`));
          }
          // 'tool_call' events are for server-side observability only — never forwarded to the client.
        }
        try {
          let result = firstResult;
          while (!result.done) {
            emit(result.value);
            result = await turnIterator.next();
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
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
