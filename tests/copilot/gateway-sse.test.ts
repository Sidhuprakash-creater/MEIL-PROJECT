// MEIL Intelligence — provider SSE parsing tests (Phase 23/25 regression).
//
// Regression origin: the live Gemini endpoint terminated SSE frames with
// CRLF ("\r\n\r\n"). The original parser split on a literal "\n\n", so every
// frame was discarded and the gateway reported "the provider returned an
// empty response" despite HTTP 200 responses. These tests lock the fix.

import { describe, it, expect } from "bun:test";
import { createSseFrameParser } from "../../src/lib/copilot/gateway";

function frame(obj: unknown, sep = "\r\n\r\n"): string {
  return `data: ${JSON.stringify(obj)}\n\n`.replace("\n\n", sep);
}

const textFrame = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] });
const callFrame = (name: string, args: Record<string, unknown> = {}, id?: string) => ({
  candidates: [{ content: { parts: [{ functionCall: { name, args, ...(id ? { id } : {}) } }] } }],
});

describe("provider SSE frame parsing", () => {
  it("parses CRLF-terminated frames (the live endpoint's format)", () => {
    const p = createSseFrameParser();
    const out = p.push(frame(callFrame("get_submissions", { status: "SUBMITTED" }), "\r\n\r\n"));
    expect(out.length).toBe(1);
    expect(out[0].kind).toBe("tool_call");
    if (out[0].kind === "tool_call") {
      expect(out[0].call.name).toBe("get_submissions");
      expect(out[0].call.args.status).toBe("SUBMITTED");
    }
  });

  it("parses LF-terminated frames", () => {
    const p = createSseFrameParser();
    const out = p.push(frame(textFrame("hello"), "\n\n"));
    expect(out.length).toBe(1);
    expect(out[0]).toEqual({ kind: "text", text: "hello" });
  });

  it("parses several frames in one chunk", () => {
    const p = createSseFrameParser();
    const out = p.push(
      frame(textFrame("part one"), "\r\n\r\n") + frame(textFrame("part two"), "\r\n\r\n")
    );
    expect(out.map((c) => (c.kind === "text" ? c.text : "")).join("")).toBe("part onepart two");
  });

  it("reassembles a frame split across chunk boundaries", () => {
    const p = createSseFrameParser();
    const whole = frame(callFrame("get_group_performance"), "\r\n\r\n");
    const cut = Math.floor(whole.length / 2);
    expect(p.push(whole.slice(0, cut))).toEqual([]);
    const out = p.push(whole.slice(cut));
    expect(out.length).toBe(1);
    expect(out[0].kind).toBe("tool_call");
  });

  it("flush() yields a trailing frame that has no separator", () => {
    const p = createSseFrameParser();
    expect(p.push(frame(textFrame("last"), "\r\n\r\n").trimEnd())).toEqual([]);
    const out = p.flush();
    expect(out.length).toBe(1);
    expect(out[0]).toEqual({ kind: "text", text: "last" });
  });

  it("keeps the provider's own function-call id when present", () => {
    const p = createSseFrameParser();
    const out = p.push(frame(callFrame("x", {}, "call_12345"), "\r\n\r\n"));
    if (out[0].kind === "tool_call") expect(out[0].call.id).toBe("call_12345");
  });

  it("ignores thought parts and [DONE] sentinels", () => {
    const p = createSseFrameParser();
    const thought = frame({ candidates: [{ content: { parts: [{ text: "internal", thought: true }] } }] }, "\r\n\r\n");
    expect(p.push(thought)).toEqual([]);
    expect(p.push("data: [DONE]\r\n\r\n")).toEqual([]);
  });

  it("skips malformed JSON frames instead of throwing", () => {
    const p = createSseFrameParser();
    expect(() => p.push("data: {not json}\r\n\r\n")).not.toThrow();
    expect(p.push(frame(textFrame("ok"), "\r\n\r\n")).length).toBe(1);
  });
});
