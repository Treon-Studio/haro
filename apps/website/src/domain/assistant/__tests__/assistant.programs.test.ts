import { describe, it, expect, vi } from "vitest"
import { runAssistantTurn } from "../assistant.programs"
import type { GatewayClient, TurnEvent } from "../assistant.types"

async function collect(events: AsyncGenerator<TurnEvent>): Promise<TurnEvent[]> {
  const out: TurnEvent[] = []
  for await (const e of events) out.push(e)
  return out
}

describe("runAssistantTurn", () => {
  it("yields content and a final done event when there is no tool call", async () => {
    const gatewayClient: GatewayClient = async function* () {
      yield { content: "hello " }
      yield { content: "world" }
    }
    const events = await collect(runAssistantTurn(
      { messages: [{ role: "user", content: "hi" }], model: "m" },
      { gatewayClient, toolExecutors: {} },
    ))
    expect(events).toEqual([
      { type: "content", text: "hello " },
      { type: "content", text: "world" },
      { type: "done" },
    ])
  })

  it("executes a tool call, feeds the result back, and yields the follow-up content", async () => {
    let callCount = 0
    const gatewayClient: GatewayClient = async function* (body) {
      callCount++
      if (callCount === 1) {
        yield { toolCallDelta: { id: "call_1", name: "web_search", argsDelta: '{"query":"weather"}' } }
        yield { finishReason: "tool_calls" }
      } else {
        expect(body.messages.at(-1)).toMatchObject({ role: "tool", tool_call_id: "call_1", content: "sunny" })
        yield { content: "It's sunny." }
      }
    }
    const toolExecutors = { web_search: vi.fn(async (args: Record<string, unknown>) => {
      expect(args).toEqual({ query: "weather" })
      return "sunny"
    }) }

    const events = await collect(runAssistantTurn(
      { messages: [{ role: "user", content: "weather?" }], model: "m", tools: [] },
      { gatewayClient, toolExecutors },
    ))

    expect(events).toEqual([
      { type: "tool_call", name: "web_search", args: { query: "weather" } },
      { type: "content", text: "It's sunny." },
      { type: "done" },
    ])
    expect(toolExecutors.web_search).toHaveBeenCalledTimes(1)
    expect(callCount).toBe(2)
  })

  it("yields an error and stops after maxTurns tool-call round trips", async () => {
    const gatewayClient: GatewayClient = async function* () {
      yield { toolCallDelta: { id: "call_1", name: "loop_tool", argsDelta: "{}" } }
      yield { finishReason: "tool_calls" }
    }
    const toolExecutors = { loop_tool: vi.fn(async () => "again") }

    const events = await collect(runAssistantTurn(
      { messages: [], model: "m" },
      { gatewayClient, toolExecutors, maxTurns: 2 },
    ))

    expect(events.at(-1)).toEqual({ type: "error", message: "Max tool-call turns (2) exceeded" })
    expect(toolExecutors.loop_tool).toHaveBeenCalledTimes(2)
  })

  it("reports an unknown tool as a tool-result error without throwing", async () => {
    const gatewayClient: GatewayClient = async function* (body) {
      if (!body.messages.some((m) => m.role === "tool")) {
        yield { toolCallDelta: { id: "call_1", name: "nonexistent_tool", argsDelta: "{}" } }
        yield { finishReason: "tool_calls" }
      } else {
        yield { content: "ok" }
      }
    }
    const events = await collect(runAssistantTurn(
      { messages: [], model: "m" },
      { gatewayClient, toolExecutors: {} },
    ))
    expect(events[0]).toEqual({ type: "tool_call", name: "nonexistent_tool", args: {} })
    expect(events.at(-1)).toEqual({ type: "done" })
  })
})
