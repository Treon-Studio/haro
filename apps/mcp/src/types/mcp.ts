export type McpJsonRpcVersion = '2.0';

export type McpMethod =
  | 'initialize'
  | 'notifications/initialized'
  | 'tools/list'
  | 'tools/call'
  | 'resources/list'
  | 'resources/read'
  | 'prompts/list'
  | 'prompts/get'
  | 'logging/setLevel'
  | 'completion/complete'
  | 'ping';

export interface McpRequest {
  jsonrpc: McpJsonRpcVersion;
  id: string | number;
  method: McpMethod | string;
  params?: Record<string, unknown>;
}

export interface McpResponse {
  jsonrpc: McpJsonRpcVersion;
  id: string | number | null;
  result?: McpResult;
  error?: McpError;
}

export interface McpResult {
  _meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface McpError {
  code: number;
  message: string;
  data?: unknown;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, McpToolProperty>;
    required?: string[];
  };
}

export interface McpToolProperty {
  type: string;
  description: string;
  enum?: string[];
  default?: unknown;
  items?: {
    type: string;
    enum?: string[];
  };
  minimum?: number;
  maximum?: number;
}

export interface ServerCapabilities {
  tools?: Record<string, unknown>;
  resources?: Record<string, unknown>;
  prompts?: Record<string, unknown>;
  logging?: Record<string, unknown>;
}

export interface ServerInfo {
  name: string;
  version: string;
}

export interface InitializeResult {
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: ServerInfo;
}

export interface ToolCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  mimeType?: string;
  data?: string;
  uri?: string;
}

export interface ToolCallResult {
  content: ToolCallContent[];
  isError?: boolean;
}

export const MCP_ERROR_CODES = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  ToolError: -32000,
  RateLimit: -32001,
  AuthError: -32002,
} as const;
