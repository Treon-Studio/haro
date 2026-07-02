import type { ServerCapabilities, ServerInfo, InitializeResult, McpToolDefinition } from '../types/mcp';
import type { McpError } from '../types/mcp';

export const SERVER_INFO: ServerInfo = {
  name: 'okf-mcp-server',
  version: '0.1.0',
};

export const PROTOCOL_VERSION = '2025-03-26';

export function getCapabilities(): ServerCapabilities {
  return {
    tools: {},
    resources: {},
  };
}

export function createInitializeResult(): InitializeResult {
  return {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: getCapabilities(),
    serverInfo: SERVER_INFO,
  };
}

export function isInitialized(clientCapabilities: Record<string, unknown> | undefined): boolean {
  return clientCapabilities !== undefined;
}
