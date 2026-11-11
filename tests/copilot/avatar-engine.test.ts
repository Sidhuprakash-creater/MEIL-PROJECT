// MEIL Intelligence — avatar engine tests (Phase 23).
// Verifies the capsule geometry, engine purity, morph continuity, blink
// determinism and reduced-motion frame against the bloub-derived contract.

import { describe, it, expect } from "bun:test";
import {
  capsuleRadius, sampleAvatar, expressionForState, DEFAULT_EXPRESSION,
  PROFILE_SAMPLES, MORPH_DURATION, type MorphState,
} from "../../src/components/copilot/avatar/engine";

const EPS = 1e-9;
const states = ["idle", "excited", "thinking", "searching", "generating", "success", "error", "waiting"] as const;

describe("capsule geometry", () => {
  it("tip radius equals a + R (ray through the cap centre)", () => {
    expect(capsuleRadius(0, 0.62, 0.55)).toBeCloseTo(0.62 + 0.55, 9);
    expect(capsuleRadius(Math.PI, 0.62, 0.55)).toBeCloseTo(0.62 + 0.55, 9);
  });

  it("side radius equals R (ray perpendicular to the long axis)", () => {
    expect(capsuleRadius(Math.PI / 2, 0.62, 0.55)).toBeCloseTo(0.55, 9);
    expect(capsuleRadius(-Math.PI / 2, 1.2, 0.4)).toBeCloseTo(0.4, 9);
  });

  it("never falls below R and never exceeds a + R", () => {
    const a = 0.62, R = 0.55;
    for (let i = 0; i < 360; i++) {
      const r = capsuleRadius((i / 360) * Math.PI * 2, a, R);
      expect(r >= R - EPS).toBe(true);
      expect(r <= a + R + EPS).toBe(true);
    }
  });

  it("is continuous around the profile", () => {
    const a = 0.62, R = 0.55;
    let prev = capsuleRadius(0, a, R);
    for (let i = 1; i <= 720; i++) {
      const r = capsuleRadius((i / 720) * Math.PI * 2, a, R);
      expect(Math.abs(r - prev)).toBeLessThan(0.01);
      prev = r;
    }
  });
});

describe("engine purity", () => {
  it("same input t → identical output (no hidden randomness in the profile)", () => {
    for (const state of states) {
      const f1 = sampleAvatar({ state, t: 3.21 });
      const f2 = sampleAvatar({ state, t: 3.21 });
      expect(JSON.stringify(f1.profile)).toBe(JSON.stringify(f2.profile));
      expect(JSON.stringify(f1.bodyPath)).toBe(JSON.stringify(f2.bodyPath));
      expect(JSON.stringify(f1.pose)).toBe(JSON.stringify(f2.pose));
    }
  });

  it("profile has exactly 64 samples with no NaN or non-positive radii", () => {
    for (const state of states) {
      const f = sampleAvatar({ state, t: 1.5 });
      expect(f.profile.length).toBe(PROFILE_SAMPLES);
      for (const r of f.profile) {
        expect(Number.isFinite(r)).toBe(true);
        expect(r).toBeGreaterThan(0);
      }
    }
  });

  it("body path is a closed curve", () => {
    const f = sampleAvatar({ state: "excited", t: 2 });
    expect(f.bodyPath.startsWith("M ")).toBe(true);
    expect(f.bodyPath.endsWith(" Z")).toBe(true);
  });
});

describe("morph continuity (bloub rule)", () => {
  it("a morph at its start frame reproduces the frozen pose", () => {
    const from = sampleAvatar({ state: "idle", t: 10 });
    const morph: MorphState = { from: "idle", fromPose: from.pose, to: "thinking", startedAt: 10 };
    const started = sampleAvatar({ state: "thinking", t: 10.0001, morph });
    for (const key of Object.keys(from.pose) as (keyof typeof from.pose)[]) {
      expect(Math.abs((started.pose[key] as number) - (from.pose[key] as number))).toBeLessThan(0.02);
    }
  });

  it("morph completes after MORPH_DURATION and clears bookkeeping", () => {
    const from = sampleAvatar({ state: "idle", t: 10 });
    const morph: MorphState = { from: "idle", fromPose: from.pose, to: "thinking", startedAt: 10 };
    const done = sampleAvatar({ state: "thinking", t: 10 + MORPH_DURATION + 0.01, morph });
    expect(done.nextMorph).toBeNull();
    const target = sampleAvatar({ state: "thinking", t: 10 + MORPH_DURATION + 0.01 });
    expect(Math.abs(done.pose.a - target.pose.a)).toBeLessThan(EPS);
  });

  it("a state change mid-morph re-freezes from the composite on screen", () => {
    const from = sampleAvatar({ state: "idle", t: 10 });
    const morph: MorphState = { from: "idle", fromPose: from.pose, to: "thinking", startedAt: 10 };
    const mid = sampleAvatar({ state: "thinking", t: 10.25, morph });
    expect(mid.nextMorph).not.toBeNull();
    const mid2 = sampleAvatar({ state: "success", t: 10.3, morph: mid.nextMorph });
    // the new morph must originate from the interrupted target, not idle
    expect(mid2.nextMorph?.from).toBe("thinking");
  });
});

describe("blinks and expressions", () => {
  it("blink sampling is deterministic for the same t", () => {
    const f1 = sampleAvatar({ state: "idle", t: 7.77 });
    const f2 = sampleAvatar({ state: "idle", t: 7.77 });
    expect(f1.eyes[0].ry).toBe(f2.eyes[0].ry);
    expect(f1.eyes[1].ry).toBe(f2.eyes[1].ry);
  });

  it("eyes stay inside the silhouette for every sampled state", () => {
    for (const state of states) {
      const f = sampleAvatar({ state, t: 4.2 });
      for (const eye of f.eyes) {
        expect(Math.abs(eye.cx)).toBeLessThan(0.7);
        expect(Number.isFinite(eye.cy)).toBe(true);
        expect(eye.ry).toBeGreaterThan(0);
      }
    }
  });

  it("default expression is EXCITED (product requirement)", () => {
    expect(DEFAULT_EXPRESSION).toBe("excited");
    const expr = expressionForState("idle");
    expect(["excited", "neutral", "focused", "concerned", "success", "error", "closed"]).toContain(expr);
  });
});

describe("reduced motion", () => {
  it("returns one fixed calm frame regardless of state or time", () => {
    const a = sampleAvatar({ state: "thinking", t: 1, reducedMotion: true });
    const b = sampleAvatar({ state: "error", t: 99, reducedMotion: true });
    expect(a.bodyPath).toBe(b.bodyPath);
    expect(a.nextMorph).toBeNull();
  });
});
