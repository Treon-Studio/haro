import { describe, it, expect, vi, beforeEach } from "vitest"
import { createGatewayClient } from "../assistant.gateway-client"

const mockFetch = vi.fn()
global.fetch = mockFetch as any

function sseResponse(body: string, status = 200) {
  return {
    ok: status < 400,
    status,
    text: async () => body,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body))
        controller.close()
      },
    }),
  } as any
}

describe("createGatewayClient", () => {
  beforeEach(() => vi.clearAllMocks())

  it("posts to {gatewayUrl}/v1/chat/completions with x-haro-config-id", async () => {
    mockFetch.mockResolvedValueOnce(sseResponse('data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: [DONE]\n\n'))
    const client = createGatewayClient("http://localhost:8787", "haro-assistant-default")
    const chunks = []
    for await (const chunk of client({ model: "m", messages: [], stream: true })) chunks.push(chunk)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe("http://localhost:8787/v1/chat/completions")
    expect(init.headers["x-haro-config-id"]).toBe("haro-assistant-default")
    expect(chunks).toEqual([{ content: "hi" }])
  })

  it("parses tool_call deltas and finish_reason across chunks", async () => {
    mockFetch.mockResolvedValueOnce(sseResponse(
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"web_search"}}]}}]}\n\n' +
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"query\\":\\"x\\"}"}}]}}]}\n\n' +
      'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n' +
      'data: [DONE]\n\n'
    ))
    const client = createGatewayClient("http://localhost:8787", "cfg")
    const chunks = []
    for await (const chunk of client({ model: "m", messages: [], stream: true })) chunks.push(chunk)

    expect(chunks).toEqual([
      { toolCallDelta: { id: "call_1", name: "web_search", argsDelta: undefined } },
      { toolCallDelta: { id: undefined, name: undefined, argsDelta: '{"query":"x"}' } },
      { finishReason: "tool_calls" },
    ])
  })

  it("throws with the status attached when the gateway returns non-ok", async () => {
    mockFetch.mockResolvedValueOnce(sseResponse("Bad Request", 400))
    const client = createGatewayClient("http://localhost:8787", "cfg")
    const iterator = client({ model: "m", messages: [], stream: true })
    await expect(iterator.next()).rejects.toMatchObject({ status: 400 })
  })
})
