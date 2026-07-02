import type { McpRequest, McpResponse, McpResult } from '../types/mcp';
import { MCP_ERROR_CODES } from '../types/mcp';

export function parseRequest(body: string): McpRequest {
  try {
    const parsed = JSON.parse(body);
    if (!parsed.jsonrpc || parsed.jsonrpc !== '2.0') {
      throw new Error('Invalid JSON-RPC version');
    }
    if (!parsed.method) {
      throw new Error('Missing method');
    }
    return parsed as McpRequest;
  } catch (err) {
    throw new McpProtocolError(MCP_ERROR_CODES.ParseError, `Parse error: ${err instanceof Error ? err.message : 'invalid JSON'}`);
  }
}

export function createResponse(id: string | number | null, result?: McpResult): McpResponse {
  return {
    jsonrpc: '2.0',
    id,
    result: result || {},
  };
}

export function createErrorResponse(id: string | number | null, code: number, message: string, data?: unknown): McpResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, data },
  };
}

export function createEventStreamResponse(): Response {
  return new Response(null, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

export function formatSseMessage(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export class McpProtocolError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
    this.name = 'McpProtocolError';
  }
}
