import { describe, it, expect } from 'vitest';
import { parseRequest, createResponse, createErrorResponse } from '../../src/mcp/protocol';
import { createInitializeResult } from '../../src/mcp/server';
import { getToolDefinitions } from '../../src/mcp/tools';
import { MCP_ERROR_CODES } from '../../src/types/mcp';

describe('MCP protocol', () => {
  it('parses valid request', () => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    });
    const req = parseRequest(body);
    expect(req.method).toBe('tools/list');
    expect(req.id).toBe(1);
  });

  it('throws on invalid JSON-RPC', () => {
    expect(() => parseRequest('{"foo": "bar"}')).toThrow();
    expect(() => parseRequest('not json')).toThrow();
  });

  it('creates proper response format', () => {
    const resp = createResponse(1, { tools: [] });
    expect(resp.jsonrpc).toBe('2.0');
    expect(resp.id).toBe(1);
    expect(resp.result).toEqual({ tools: [] });
  });

  it('creates proper error format', () => {
    const err = createErrorResponse(1, MCP_ERROR_CODES.MethodNotFound, 'Unknown method');
    expect(err.error).toBeDefined();
    expect(err.error!.code).toBe(MCP_ERROR_CODES.MethodNotFound);
    expect(err.error!.message).toBe('Unknown method');
  });
});

describe('MCP server', () => {
  it('creates initialize result', () => {
    const result = createInitializeResult();
    expect(result.protocolVersion).toBeDefined();
    expect(result.capabilities.tools).toBeDefined();
    expect(result.serverInfo.name).toBe('okf-mcp-server');
  });
});

describe('MCP tools', () => {
  it('returns tool definitions', () => {
    const tools = getToolDefinitions();
    expect(tools.length).toBeGreaterThan(0);
    const names = tools.map(t => t.name);
    expect(names).toContain('okf_search');
    expect(names).toContain('okf_get_doc');
    expect(names).toContain('okf_get_context');
    expect(names).toContain('okf_get_related');
    expect(names).toContain('okf_list_docs');
    expect(names).toContain('okf_sync_status');
  });

  it('each tool has valid schema', () => {
    const tools = getToolDefinitions();
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.description).toBeTruthy();
    }
  });
});
