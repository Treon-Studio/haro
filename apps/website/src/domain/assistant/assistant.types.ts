export interface GatewayMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | Array<Record<string, unknown>>
  tool_call_id?: string
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface GatewayRequestBody {
  model: string
  messages: GatewayMessage[]
  tools?: ToolDefinition[]
  tool_choice?: 'auto'
  stream: true
  max_tokens?: number
}

export interface GatewayStreamChunk {
  content?: string
  toolCallDelta?: { id?: string; name?: string; argsDelta?: string }
  finishReason?: string
}

export type GatewayClient = (body: GatewayRequestBody) => AsyncGenerator<GatewayStreamChunk>

export type ToolExecutor = (args: Record<string, unknown>) => Promise<string>

export type TurnEvent =
  | { type: 'content'; text: string }
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }
  | { type: 'done' }
  | { type: 'error'; message: string }

export interface RunAssistantTurnInput {
  messages: GatewayMessage[]
  model: string
  tools?: ToolDefinition[]
  maxTokens?: number
}

export interface RunAssistantTurnDeps {
  gatewayClient: GatewayClient
  toolExecutors: Record<string, ToolExecutor>
  maxTurns?: number
}
