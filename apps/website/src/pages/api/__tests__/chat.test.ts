import { describe, it, expect, vi, beforeEach } from "vitest"

const mockFetch = vi.fn()
global.fetch = mockFetch

function jsonResponse(body: unknown, init?: { status?: number }) {
  const status = init?.status ?? 200
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    body: new ReadableStream({
      start(controller: ReadableStreamDefaultController) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hello"}}]}\n\ndata: [DONE]\n\n'))
        controller.close()
      },
    }),
  } as any
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    import.meta.env.GATEWAY_URL = "http://localhost:8787"
  })

  it("calls the gateway URL, not a provider URL directly", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}))

    const { POST } = await import("../chat")
    const req = new Request("http://localhost:4321/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hello" }],
        model: "openrouter/auto",
      }),
    })
    await POST({ request: req } as any)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe("http://localhost:8787/v1/chat/completions")
    expect(init.headers).not.toHaveProperty("authorization")
    expect(init.headers).not.toHaveProperty("Authorization")
    expect(init.headers["x-haro-config-id"]).toBe("haro-assistant-default")
  })

  it("ignores apiKey and provider fields in request body", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}))

    const { POST } = await import("../chat")
    const req = new Request("http://localhost:4321/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "test" }],
        model: "openrouter/auto",
        provider: "openai",
        apiKey: "sk-should-be-ignored",
      }),
    })
    const res = await POST({ request: req } as any)

    expect(res.status).toBe(200)
    const [, init] = mockFetch.mock.calls[0]
    const sentBody = JSON.parse(init.body)
    expect(sentBody.model).toBe("openrouter/auto")
    expect(sentBody.stream).toBe(true)
    expect(sentBody).not.toHaveProperty("provider")
    expect(sentBody).not.toHaveProperty("apiKey")
  })

  it("preserves image attachments as content blocks", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}))

    const { POST } = await import("../chat")
    const req = new Request("http://localhost:4321/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: "describe this image",
            attachments: [
              { type: "image/png", dataUrl: "data:image/png;base64,iVBORw0KGgo=" },
            ],
          },
        ],
        model: "openrouter/auto",
      }),
    })
    const res = await POST({ request: req } as any)

    expect(res.status).toBe(200)
    const [, init] = mockFetch.mock.calls[0]
    const sentBody = JSON.parse(init.body)
    expect(sentBody.messages[0].content).toBeInstanceOf(Array)
    expect(sentBody.messages[0].content[0]).toMatchObject({ type: "text", text: "describe this image" })
    expect(sentBody.messages[0].content[1]).toMatchObject({
      type: "image_url",
      image_url: { url: "data:image/png;base64,iVBORw0KGgo=", detail: "auto" },
    })
  })

  it("returns 400 when gateway returns error", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(
      { error: "Bad Request" },
      { status: 400 },
    ))

    const { POST } = await import("../chat")
    const req = new Request("http://localhost:4321/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hello" }],
        model: "bad-model",
      }),
    })
    const res = await POST({ request: req } as any)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("Gateway API error")
  })

  it("proxies streaming response on success", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}))

    const { POST } = await import("../chat")
    const req = new Request("http://localhost:4321/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hello" }],
        model: "openrouter/auto",
      }),
    })
    const res = await POST({ request: req } as any)

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("text/event-stream")
    expect(res.headers.get("Cache-Control")).toBe("no-cache")
  })

  it("uses default gateway URL when env var is not set", async () => {
    delete import.meta.env.GATEWAY_URL
    mockFetch.mockResolvedValueOnce(jsonResponse({}))

    const { POST } = await import("../chat")
    const req = new Request("http://localhost:4321/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hello" }],
        model: "openrouter/auto",
      }),
    })
    await POST({ request: req } as any)

    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe("http://localhost:8787/v1/chat/completions")
  })

  it("strips trailing slashes from GATEWAY_URL", async () => {
    import.meta.env.GATEWAY_URL = "http://localhost:8787/"
    mockFetch.mockResolvedValueOnce(jsonResponse({}))

    const { POST } = await import("../chat")
    const req = new Request("http://localhost:4321/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hello" }],
        model: "openrouter/auto",
      }),
    })
    await POST({ request: req } as any)

    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe("http://localhost:8787/v1/chat/completions")
  })

  it("preserves webSearch tools in the request body", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}))

    const { POST } = await import("../chat")
    const req = new Request("http://localhost:4321/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "search something" }],
        model: "openrouter/auto",
        webSearch: true,
      }),
    })
    await POST({ request: req } as any)

    const [, init] = mockFetch.mock.calls[0]
    const sentBody = JSON.parse(init.body)
    expect(sentBody.tools).toBeDefined()
    expect(sentBody.tools).toBeInstanceOf(Array)
    expect(sentBody.tools[0].function.name).toBe("web_search")
    expect(sentBody.tool_choice).toBe("auto")
  })

  it("returns 500 on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"))

    const { POST } = await import("../chat")
    const req = new Request("http://localhost:4321/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hello" }],
        model: "openrouter/auto",
      }),
    })
    const res = await POST({ request: req } as any)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Network error")
  })

  it("executes web_search server-side and never leaks tool_calls to the client stream", async () => {
    mockFetch
      .mockImplementationOnce(async () => ({
        ok: true,
        body: new ReadableStream({
          start(controller: ReadableStreamDefaultController) {
            controller.enqueue(new TextEncoder().encode(
              'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"web_search","arguments":"{\\"query\\":\\"answer\\"}"}}]}}]}\n\n' +
              'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\ndata: [DONE]\n\n'
            ))
            controller.close()
          },
        }),
      }))
      .mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({ AbstractText: "42", AbstractURL: "https://example.com" }),
      }))
      .mockImplementationOnce(async () => ({
        ok: true,
        body: new ReadableStream({
          start(controller: ReadableStreamDefaultController) {
            controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"The answer is 42."}}]}\n\ndata: [DONE]\n\n'))
            controller.close()
          },
        }),
      }))

    const { POST } = await import("../chat")
    const req = new Request("http://localhost:4321/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "what is the answer?" }], model: "openrouter/auto", webSearch: true }),
    })
    const res = await POST({ request: req } as any)
    const text = await res.text()

    expect(text).not.toContain("tool_calls")
    expect(text).toContain("The answer is 42.")
  })
})
