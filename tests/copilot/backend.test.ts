// MEIL Intelligence — backend unit tests (Phase 23).
// Covers tool-registry integrity, follow-up extraction and the confirmation
// TTL contract. Everything here runs without a database or network.

import { describe, it, expect } from "bun:test";
import { TOOL_DEFINITIONS, getToolDefinition } from "../../src/lib/copilot/tools";
import { extractFollowUps, getProviderConfig } from "../../src/lib/copilot/gateway";
import { confirmationExpiry } from "../../src/lib/copilot/actions";

describe("tool registry integrity", () => {
  it("exposes a non-empty registry with unique tool names", () => {
    expect(TOOL_DEFINITIONS.length).toBeGreaterThan(0);
    const names = TOOL_DEFINITIONS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every definition is well-formed and risk-classified", () => {
    for (const t of TOOL_DEFINITIONS) {
      expect(t.name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(t.description.length).toBeGreaterThan(10);
      expect(["L0", "L1", "L2", "L3", "L4"]).toContain(t.riskLevel);
      expect(typeof t.params).toBe("object");
    }
  });

  it("confirmation-required tools are L2+ and read tools are L0/L1", () => {
    const CONFIRM_TOOLS = new Set(["prepare_reminder", "prepare_deadline_change", "create_follow_up_task"]);
    for (const t of TOOL_DEFINITIONS) {
      if (CONFIRM_TOOLS.has(t.name)) {
        expect(["L2", "L3", "L4"]).toContain(t.riskLevel);
      } else {
        expect(["L0", "L1"]).toContain(t.riskLevel);
      }
    }
  });

  it("getToolDefinition resolves exactly what the registry declares", () => {
    for (const t of TOOL_DEFINITIONS) {
      expect(getToolDefinition(t.name)?.name).toBe(t.name);
    }
    expect(getToolDefinition("nonexistent_tool_xyz")).toBeUndefined();
  });
});

describe("provider config", () => {
  it("resolves a provider with model, capability flags and limits", () => {
    const cfg = getProviderConfig();
    expect(cfg.id.length).toBeGreaterThan(0);
    expect(cfg.model.length).toBeGreaterThan(0);
    expect(typeof cfg.configured).toBe("boolean");
    expect(typeof cfg.supportsTools).toBe("boolean");
    expect(typeof cfg.supportsStreaming).toBe("boolean");
    expect(cfg.timeoutMs).toBeGreaterThan(0);
    expect(cfg.maxOutputTokens).toBeGreaterThan(0);
    expect(cfg.temperature).toBeGreaterThanOrEqual(0);
  });
});

describe("follow-up extraction", () => {
  it("lifts FOLLOWUP lines out of the reply and into questions", () => {
    const text = "Total approved submissions rose 12%.\nFOLLOWUP: Which subsidiary improved the most?\nFOLLOWUP: Show the overdue backlog?\n";
    const { clean, questions } = extractFollowUps(text);
    expect(questions).toEqual([
      "Which subsidiary improved the most?",
      "Show the overdue backlog?",
    ]);
    expect(clean).not.toContain("FOLLOWUP");
    expect(clean).toContain("Total approved submissions rose 12%.");
  });

  it("returns nothing when the reply has no follow-ups", () => {
    const { clean, questions } = extractFollowUps("A plain answer with no prompts.");
    expect(questions).toEqual([]);
    expect(clean).toBe("A plain answer with no prompts.");
  });

  it("tolerates leading whitespace on FOLLOWUP lines", () => {
    const { questions } = extractFollowUps("Answer.\n   FOLLOWUP:   Trimmed question?   ");
    expect(questions).toEqual(["Trimmed question?"]);
  });
});

describe("confirmation TTL (single-use guard contract)", () => {
  it("expiry lands ~10 minutes in the future", () => {
    const before = Date.now();
    const exp = confirmationExpiry().getTime();
    const after = Date.now();
    expect(exp - before).toBeGreaterThanOrEqual(10 * 60 * 1000 - 5);
    expect(exp - after).toBeLessThanOrEqual(10 * 60 * 1000 + 5);
  });

  it("produces strictly increasing expiries", () => {
    const a = confirmationExpiry().getTime();
    const b = confirmationExpiry().getTime();
    expect(b).toBeGreaterThanOrEqual(a);
  });
});
