import type {
  RunAssistantTurnInput,
  RunAssistantTurnDeps,
  TurnEvent,
  GatewayMessage,
} from './assistant.types'

const DEFAULT_MAX_TURNS = 5

export async function* runAssistantTurn(
  input: RunAssistantTurnInput,
  deps: RunAssistantTurnDeps,
): AsyncGenerator<TurnEvent> {
  const maxTurns = deps.maxTurns ?? DEFAULT_MAX_TURNS
  let messages: GatewayMessage[] = [...input.messages]

  for (let turn = 0; turn < maxTurns; turn++) {
    let toolCallId = ''
    let toolCallName = ''
    let toolCallArgsRaw = ''
    let sawToolCall = false

    for await (const chunk of deps.gatewayClient({
      model: input.model,
      messages,
      tools: input.tools,
      tool_choice: input.tools ? 'auto' : undefined,
      stream: true,
      max_tokens: input.maxTokens,
    })) {
      if (chunk.content) {
        yield { type: 'content', text: chunk.content }
      }
      if (chunk.toolCallDelta) {
        if (chunk.toolCallDelta.id) toolCallId = chunk.toolCallDelta.id
        if (chunk.toolCallDelta.name) toolCallName = chunk.toolCallDelta.name
        if (chunk.toolCallDelta.argsDelta) toolCallArgsRaw += chunk.toolCallDelta.argsDelta
      }
      if (chunk.finishReason === 'tool_calls' && toolCallName) {
        sawToolCall = true
      }
    }

    if (!sawToolCall) {
      yield { type: 'done' }
      return
    }

    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(toolCallArgsRaw || '{}')
    } catch {
      args = {}
    }

    yield { type: 'tool_call', name: toolCallName, args }

    const executor = deps.toolExecutors[toolCallName]
    let resultText: string
    if (!executor) {
      resultText = JSON.stringify({ error: `Unknown tool: ${toolCallName}` })
    } else {
      try {
        resultText = await executor(args)
      } catch (e) {
        resultText = JSON.stringify({ error: `Tool ${toolCallName} failed: ${e instanceof Error ? e.message : String(e)}` })
      }
    }

    messages = [
      ...messages,
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: toolCallId, type: 'function', function: { name: toolCallName, arguments: toolCallArgsRaw } }],
      },
      { role: 'tool', content: resultText, tool_call_id: toolCallId },
    ]
  }

  yield { type: 'error', message: `Max tool-call turns (${maxTurns}) exceeded` } as TurnEvent
}
