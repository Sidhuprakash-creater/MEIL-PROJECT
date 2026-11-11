// MEIL Intelligence — Groq (OpenAI-compatible) provider tests.
//
// Locks the Groq specifics verified live against api.groq.com:
//  • chat-completions request shape (system message, {type:"function"} tools,
//    assistant tool_calls, {role:"tool", tool_call_id} results),
//  • stream dialect: delta.content for text, delta.tool_calls fragments whose
//    JSON arguments may be split across chunks,
//  • gpt-oss reasoning arrives in delta.reasoning and must never surface.

import { describe, it, expect } from "bun:test";
import {
  buildGroqRequest,
  createOpenAIStreamParser,
  resolveProviderId,
  getProviderConfig,
} from "../../src/lib/copilot/gateway";
import type { ToolDefinition } from "../../src/lib/copilot/types";

const tool: ToolDefinition = {
  name: "get_subsidiaries",
  description: "List subsidiaries.",
  riskLevel: "L0",
  params: {
    status: { type: "enum", enum: ["ACTIVE", "INACTIVE"], description: "Status filter", optional: true },
    limit: { type: "number", optional: true },
  },
};

const cfg = {
  id: "groq" as const,
  model: "openai/gpt-oss-120b",
  apiKey: "gsk_test",
  configured: true,
  supportsTools: true,
  supportsStreaming: true,
  timeoutMs: 90_000,
  maxOutputTokens: 4096,
  temperature: 0.4,
};

describe("groq request shape", () => {
  it("targets the chat-completions endpoint with a bearer token", () => {
    const req = buildGroqRequest([{ role: "user", text: "hi" }], [tool], "SYSTEM", cfg);
    expect(req.url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(req.headers.Authorization).toBe("Bearer gsk_test");
    expect(req.body.stream).toBe(true);
  });

  it("puts the system prompt first and maps user turns", () => {
    const req = buildGroqRequest([{ role: "user", text: "question" }], [tool], "SYSTEM", cfg);
    const messages = req.body.messages as { role: string; content: string }[];
    expect(messages[0]).toEqual({ role: "system", content: "SYSTEM" });
    expect(messages[1]).toEqual({ role: "user", content: "question" });
  });

  it("declares tools in OpenAI function form with JSON-Schema types", () => {
    const req = buildGroqRequest([], [tool], "SYSTEM", cfg);
    const tools = req.body.tools as { type: string; function: { name: string; parameters: { properties: Record<string, { type: string }> } } }[];
    expect(tools[0].type).toBe("function");
    expect(tools[0].function.name).toBe("get_subsidiaries");
    expect(tools[0].function.parameters.properties.status.type).toBe("string");
    expect(tools[0].function.parameters.properties.limit.type).toBe("number");
    expect((req.body.tool_choice as string)).toBe("auto");
  });

  it("echoes assistant tool calls and links tool results by tool_call_id", () => {
    const req = buildGroqRequest(
      [
        { role: "assistant", toolCalls: [{ id: "fc_1", name: "get_subsidiaries", args: { status: "ACTIVE" } }] },
        { role: "tool", toolName: "get_subsidiaries", toolCallId: "fc_1", toolResult: "7 subsidiaries" },
      ],
      [tool],
      "SYSTEM",
      cfg,
    );
    const messages = req.body.messages as any[];
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].tool_calls[0].id).toBe("fc_1");
    expect(messages[1].tool_calls[0].type).toBe("function");
    expect(JSON.parse(messages[1].tool_calls[0].function.arguments)).toEqual({ status: "ACTIVE" });
    expect(messages[2]).toMatchObject({ role: "tool", tool_call_id: "fc_1", content: "7 subsidiaries" });
  });

  it("sets reasoning_effort for gpt-oss models (they otherwise exhaust the token budget)", () => {
    const req = buildGroqRequest([], [tool], "SYSTEM", cfg);
    expect(req.body.reasoning_effort).toBe("low");
  });

  it("omits reasoning_effort for non-reasoning models", () => {
    const req = buildGroqRequest([], [tool], "SYSTEM", { ...cfg, model: "llama-3.3-70b-versatile" });
    expect(req.body.reasoning_effort).toBeUndefined();
  });
});

describe("groq stream dialect", () => {
  const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;

  it("streams text deltas", () => {
    const p = createOpenAIStreamParser();
    const out = p.push(sse({ choices: [{ delta: { content: "Hello" } }] }));
    expect(out).toEqual([{ kind: "text", text: "Hello" }]);
  });

  it("never surfaces internal reasoning", () => {
    const p = createOpenAIStreamParser();
    const out = p.push(sse({ choices: [{ delta: { reasoning: "internal thought", channel: "analysis" } }] }));
    expect(out).toEqual([]);
  });

  it("assembles tool calls whose arguments are split across chunks", () => {
    const p = createOpenAIStreamParser();
    p.push(sse({ choices: [{ delta: { tool_calls: [{ index: 0, id: "fc_1", type: "function", function: { name: "get_subsidiaries", arguments: '{"status"' } }] } }] }));
    p.push(sse({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: ':"ACTIVE"}' } }] } }] }));
    const out = p.flush();
    expect(out.length).toBe(1);
    if (out[0].kind === "tool_call") {
      expect(out[0].call.name).toBe("get_subsidiaries");
      expect(out[0].call.id).toBe("fc_1");
      expect(out[0].call.args).toEqual({ status: "ACTIVE" });
    }
  });

  it("keeps parallel tool calls apart by index", () => {
    const p = createOpenAIStreamParser();
    p.push(sse({ choices: [{ delta: { tool_calls: [{ index: 0, id: "a", function: { name: "one", arguments: "{}" } }] } }] }));
    p.push(sse({ choices: [{ delta: { tool_calls: [{ index: 1, id: "b", function: { name: "two", arguments: "{}" } }] } }] }));
    const out = p.flush();
    expect(out.map((c) => (c.kind === "tool_call" ? c.call.name : ""))).toEqual(["one", "two"]);
  });

  it("ignores the [DONE] sentinel", () => {
    const p = createOpenAIStreamParser();
    expect(p.push("data: [DONE]\n\n")).toEqual([]);
  });

  it("survives malformed frames", () => {
    const p = createOpenAIStreamParser();
    expect(() => p.push("data: {oops\n\n")).not.toThrow();
  });
});

describe("provider selection", () => {
  it("prefers the explicitly configured provider", () => {
    const prev = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = "groq";
    expect(resolveProviderId()).toBe("groq");
    process.env.AI_PROVIDER = "gemini";
    expect(resolveProviderId()).toBe("gemini");
    if (prev === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = prev;
  });

  it("falls back to a configured credential", () => {
    const prev = process.env.AI_PROVIDER;
    delete process.env.AI_PROVIDER;
    const prevGroq = process.env.GROQ_API_KEY;
    process.env.GROQ_API_KEY = "gsk_x";
    expect(resolveProviderId()).toBe("groq");
    if (prevGroq === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = prevGroq;
    if (prev === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = prev;
  });

  it("reports the resolved model and configured state", () => {
    const prev = process.env.AI_PROVIDER;
    const prevKey = process.env.GROQ_API_KEY;
    process.env.AI_PROVIDER = "groq";
    process.env.GROQ_API_KEY = "gsk_x";
    const c = getProviderConfig();
    expect(c.id).toBe("groq");
    expect(c.configured).toBe(true);
    expect(c.model.length).toBeGreaterThan(0);
    if (prev === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = prev;
    if (prevKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = prevKey;
  });
});
