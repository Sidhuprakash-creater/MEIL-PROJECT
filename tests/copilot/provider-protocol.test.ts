// MEIL Intelligence — provider protocol tests (Gemini function-calling contract).
//
// These lock the two protocol fixes verified live against the provider:
//  1) assistant turns must carry their functionCall parts (otherwise the model
//     repeats the same calls),
//  2) Gemini 3 thought signatures travel as a SIBLING of functionCall inside
//     the same part — nesting them inside functionCall is rejected with
//     "Unknown name thoughtSignature".

import { describe, it, expect } from "bun:test";
import { providerErrorCode, providerErrorMessage } from "../../src/lib/copilot/gateway";

/**
 * The provider request body builder is internal to the gateway, so this test
 * mirrors its contract: a model turn with tool calls becomes a "model" content
 * entry whose parts are functionCall parts (plus an optional text part), and
 * consecutive tool results merge into one "user" entry with many
 * functionResponse parts.
 */
function buildContents(
  messages: {
    role: "user" | "assistant" | "tool";
    text?: string;
    toolName?: string;
    toolResult?: string;
    toolCalls?: { name: string; args: Record<string, unknown>; thoughtSignature?: string }[];
  }[],
) {
  const contents: Record<string, unknown>[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      contents.push({ role: "user", parts: [{ text: m.text ?? "" }] });
    } else if (m.role === "assistant") {
      const parts: Record<string, unknown>[] = [];
      if (m.text && m.text.trim()) parts.push({ text: m.text });
      for (const call of m.toolCalls ?? []) {
        parts.push({
          functionCall: { name: call.name, args: call.args ?? {} },
          ...(call.thoughtSignature ? { thoughtSignature: call.thoughtSignature } : {}),
        });
      }
      if (!parts.length) continue;
      contents.push({ role: "model", parts });
    } else {
      const part = { functionResponse: { name: m.toolName ?? "tool", response: { result: m.toolResult ?? "" } } };
      const prev = contents[contents.length - 1];
      if (prev && prev.role === "user" && Array.isArray(prev.parts) && prev.parts.every((p: any) => p?.functionResponse)) {
        (prev.parts as unknown[]).push(part);
      } else {
        contents.push({ role: "user", parts: [part] });
      }
    }
  }
  return contents;
}

describe("gemini function-calling protocol", () => {
  it("keeps functionCall parts on the assistant turn", () => {
    const contents = buildContents([
      { role: "user", text: "How many subsidiaries?" },
      { role: "assistant", toolCalls: [{ name: "get_subsidiaries", args: { status: "ACTIVE" } }] },
      { role: "tool", toolName: "get_subsidiaries", toolResult: "7 subsidiaries" },
    ]);

    expect(contents.length).toBe(3);
    expect(contents[1].role).toBe("model");
    const parts = contents[1].parts as Record<string, unknown>[];
    expect(parts.length).toBe(1);
    expect((parts[0].functionCall as { name: string }).name).toBe("get_subsidiaries");
    expect(parts[0].thoughtSignature).toBeUndefined();
  });

  it("places the thought signature as a sibling of functionCall", () => {
    const contents = buildContents([
      { role: "assistant", toolCalls: [{ name: "x", args: {}, thoughtSignature: "sig-123" }] },
    ]);
    const part = (contents[0].parts as Record<string, unknown>[])[0];
    expect(part.thoughtSignature).toBe("sig-123");
    expect((part.functionCall as Record<string, unknown>).thoughtSignature).toBeUndefined();
  });

  it("merges consecutive tool results into one user turn", () => {
    const contents = buildContents([
      { role: "assistant", toolCalls: [{ name: "a", args: {} }, { name: "b", args: {} }] },
      { role: "tool", toolName: "a", toolResult: "1" },
      { role: "tool", toolName: "b", toolResult: "2" },
    ]);
    expect(contents.length).toBe(2);
    const responseParts = contents[1].parts as Record<string, unknown>[];
    expect(responseParts.length).toBe(2);
    expect((responseParts[0].functionResponse as { name: string }).name).toBe("a");
    expect((responseParts[1].functionResponse as { name: string }).name).toBe("b");
  });

  it("keeps assistant narrative text alongside its tool calls", () => {
    const contents = buildContents([
      { role: "assistant", text: "Checking now.", toolCalls: [{ name: "a", args: {} }] },
    ]);
    const parts = contents[0].parts as Record<string, unknown>[];
    expect(parts[0].text).toBe("Checking now.");
    expect(parts[1].functionCall).toBeTruthy();
  });
});

describe("provider error mapping", () => {
  it("maps rate limits to an actionable, non-scary message", () => {
    expect(providerErrorCode(429)).toBe("PROVIDER_RATE_LIMITED");
    expect(providerErrorMessage(429, "You exceeded your current quota")).toContain("rate limit");
  });

  it("maps an expired/invalid credential", () => {
    expect(providerErrorCode(401)).toBe("PROVIDER_UNAUTHENTICATED");
    expect(providerErrorMessage(401, "")).toContain("GEMINI_API_KEY");
  });

  it("maps a retired model to a configuration hint", () => {
    expect(providerErrorCode(404)).toBe("PROVIDER_MODEL_UNAVAILABLE");
    expect(providerErrorMessage(404, "model is no longer available")).toContain("GEMINI_MODEL");
  });

  it("passes unknown failures through unchanged", () => {
    expect(providerErrorCode(500)).toBe("PROVIDER_ERROR");
    expect(providerErrorMessage(500, "boom")).toBe("boom");
  });
});
