import type { GatewayClient, GatewayRequestBody, GatewayStreamChunk } from './assistant.types'

export function createGatewayClient(gatewayUrl: string, configId: string): GatewayClient {
  const url = `${gatewayUrl.replace(/\/+$/, '')}/v1/chat/completions`

  return async function* gatewayClient(body: GatewayRequestBody): AsyncGenerator<GatewayStreamChunk> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-haro-config-id': configId,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      const err = new Error(`Gateway API error: ${response.status} ${errorText}`) as Error & { status?: number }
      err.status = response.status
      throw err
    }
    if (!response.body) throw new Error('No response body from gateway')

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let done = false
    let buffer = ''

    while (!done) {
      const { value, done: readerDone } = await reader.read()
      done = readerDone
      if (!value) continue
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.trim() === '') continue
        if (!line.startsWith('data: ')) continue
        const dataStr = line.slice(6).trim()
        if (dataStr === '[DONE]') return

        let data: any
        try {
          data = JSON.parse(dataStr)
        } catch {
          continue
        }

        const delta = data.choices?.[0]?.delta
        const chunk: GatewayStreamChunk = {}

        if (delta?.content) chunk.content = delta.content

        const toolCalls = delta?.tool_calls
        if (toolCalls && toolCalls.length > 0) {
          const tc = toolCalls.find((t: any) => t.index === undefined || t.index === 0)
          if (tc) {
            chunk.toolCallDelta = {
              id: tc.id,
              name: tc.function?.name,
              argsDelta: tc.function?.arguments,
            }
          }
        }

        const finishReason = data.choices?.[0]?.finish_reason
        if (finishReason) chunk.finishReason = finishReason

        if (chunk.content || chunk.toolCallDelta || chunk.finishReason) yield chunk
      }
    }
  }
}
