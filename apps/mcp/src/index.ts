import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { GraphDurableObject } from './do/graph-do';
import { SessionDurableObject } from './do/session-do';
import { KvStore } from './kv/store';
import { DocService } from './services/doc-service';
import { SearchService } from './services/search-service';
import { GraphService } from './services/graph-service';
import { SyncService } from './services/sync-service';
import { WebhookHandler } from './github/webhook';
import { parseRequest, createResponse, createErrorResponse } from './mcp/protocol';
import { createInitializeResult } from './mcp/server';
import { getToolDefinitions, executeTool, type ToolServices } from './mcp/tools';
import { MCP_ERROR_CODES } from './types/mcp';
import type { SyncConfig, ChangedFile } from './types/github';
import type { ToolCallResult } from './types/mcp';
import { MemoryFabricService } from './services/memory-fabric-service';
import { mintServiceToken } from './lib/service-token';

export interface Env {
  OKF_KV: KVNamespace;
  GRAPH_DO: DurableObjectNamespace;
  SESSION_DO: DurableObjectNamespace;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  DOCS_PATH: string;
  MAX_CONTEXT_TOKENS: string;
  MAX_GRAPH_DEPTH: string;
  GITHUB_TOKEN?: string;
  WEBHOOK_SECRET?: string;
  SYNC_TOKEN?: string;
  MCP_API_KEY?: string;
  MEMORY_FABRIC_URL?: string;
  SERVICE_JWT_SECRET?: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

function buildServices(c: { env: Env }): ToolServices {
  const store = new KvStore(c.env.OKF_KV);
  const docService = new DocService(store);
  const searchService = new SearchService(store);
  const graphService = new GraphService(store, c.env.GRAPH_DO);
  const syncConfig: SyncConfig = {
    owner: c.env.GITHUB_OWNER,
    repo: c.env.GITHUB_REPO,
    branch: c.env.GITHUB_BRANCH || 'main',
    docsPath: c.env.DOCS_PATH || 'docs',
    token: c.env.GITHUB_TOKEN || '',
  };
  const syncService = new SyncService(store, syncConfig);
  const secret = c.env.SERVICE_JWT_SECRET;
  const memoryFabric = c.env.MEMORY_FABRIC_URL
    ? new MemoryFabricService({
        baseUrl: c.env.MEMORY_FABRIC_URL,
        mintToken: secret ? (tenantSlug) => mintServiceToken(tenantSlug, secret) : undefined,
      })
    : undefined;
  return { docService, searchService, graphService, syncService, memoryFabric };
}

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/sse', async (c) => {
  const apiKey = c.env.MCP_API_KEY;
  if (apiKey) {
    const auth = c.req.header('Authorization') || c.req.header('x-api-key') || '';
    if (auth !== `Bearer ${apiKey}` && auth !== apiKey) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ jsonrpc: '2.0', method: 'endpoint', params: { uri: '/mcp' } })}\n\n`));
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
});

app.post('/mcp', async (c) => {
  const apiKey = c.env.MCP_API_KEY;
  if (apiKey) {
    const auth = c.req.header('Authorization') || c.req.header('x-api-key') || '';
    if (auth !== `Bearer ${apiKey}` && auth !== apiKey) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
  }

  try {
    const body = await c.req.text();
    const request = parseRequest(body);
    const services = buildServices(c);

    return await handleMcpRequest(request, services, c);
  } catch (err) {
    return c.json(createErrorResponse(null, MCP_ERROR_CODES.ParseError, err instanceof Error ? err.message : 'Parse error'));
  }
});

app.post('/sync', async (c) => {
  const syncToken = c.env.SYNC_TOKEN;
  if (syncToken) {
    const auth = c.req.header('Authorization') || '';
    if (auth !== `Bearer ${syncToken}`) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
  }

  const services = buildServices(c);
  const result = await services.syncService.fullSync();
  return c.json(result);
});

app.post('/webhook', async (c) => {
  const webhookSecret = c.env.WEBHOOK_SECRET;
  if (webhookSecret) {
    const handler = new WebhookHandler(webhookSecret);
    const isValid = await handler.verify(c.req.raw);
    if (!isValid) {
      return c.json({ error: 'Invalid signature' }, 401);
    }
  }

  const body = await c.req.text();
  const payload = JSON.parse(body);

  const changedFiles: ChangedFile[] = [];
  for (const commit of payload.commits || []) {
    for (const file of [...(commit.added || []), ...(commit.modified || [])]) {
      if (file.endsWith('.md')) changedFiles.push({ path: file, status: 'modified' });
    }
    for (const file of commit.removed || []) {
      if (file.endsWith('.md')) changedFiles.push({ path: file, status: 'removed' });
    }
  }

  if (changedFiles.length > 0) {
    const services = buildServices(c);
    const result = await services.syncService.incrementalSync(changedFiles);
    return c.json(result);
  }

  return c.json({ updated: 0, deleted: 0, syncedAt: new Date().toISOString() });
});

app.all('*', (c) => {
  return c.json({ error: 'Not Found' }, 404);
});

async function handleMcpRequest(
  request: ReturnType<typeof parseRequest>,
  services: ReturnType<typeof buildServices>,
  c: any,
): Promise<Response> {
  const { id, method, params } = request;
  const rid = id ?? null;

  switch (method) {
    case 'initialize':
      return c.json(createResponse(rid, createInitializeResult() as any));

    case 'notifications/initialized':
      return c.json(createResponse(rid));

    case 'tools/list': {
      const tools = getToolDefinitions();
      return c.json(createResponse(rid, { tools } as any));
    }

    case 'tools/call': {
      const toolName = params?.name as string;
      const toolArgs = (params?.arguments || {}) as Record<string, unknown>;

      if (!toolName) {
        return c.json(createErrorResponse(rid, MCP_ERROR_CODES.InvalidParams, 'Missing tool name'));
      }

      const result: ToolCallResult = await executeTool(toolName, toolArgs, services);
      return c.json(createResponse(rid, result as any));
    }

    case 'ping':
      return c.json(createResponse(rid));

    default:
      return c.json(createErrorResponse(rid, MCP_ERROR_CODES.MethodNotFound, `Unknown method: ${method}`));
  }
}

export { GraphDurableObject, SessionDurableObject };

export default app;
