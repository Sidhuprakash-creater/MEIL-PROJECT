// MEIL Intelligence — capsule avatar animation engine.
//
// Engineering techniques adapted from the MIT-licensed `bloub` repository
// (https://github.com/jeremy-prt/bloub — studied as the Phase 3 reference):
//   • `sample(t)` is a PURE function of time — no framework, no clock, no
//     internal state that depends on real time. That makes the animation
//     deterministic, testable, and safely pausable.
//   • Silhouettes are radial profiles sampled at a fixed angular count, so any
//     pose interpolates linearly in radius space (no path-morphing library).
//   • Exponential ease-outs only — the body never overshoots or springs.
//   • Elements sitting "on" the body (the eyes) are fitted to the profile's
//     real radius at their angle (`radiusAtAngle`), so they stay inside the
//     silhouette during every morph.
//   • Gaze: the outside look is mixed by the engine, and automatic wander is
//     added AFTER the mix, so drift never fights pointer tracking.
//   • Blinks come from a pre-drawn deterministic schedule (stateless).
//
// The visual identity is original to MEIL: an elongated CAPSULE body (never a
// plain circle by default) with a sky-blue → liquid-purple illumination, and
// an EXCITED resting expression.

import type { AvatarState } from "@/lib/copilot/types";

export type { AvatarState };

/* ── geometry constants ─────────────────────────────────────────────────────── */

export const PROFILE_SAMPLES = 64;

/** Capsule polar radius for half-length `a` and radius `R` at angle θ. */
export function capsuleRadius(theta: number, a: number, R: number): number {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const absS = Math.abs(s);
  if (absS < 1e-4) return a + R; // ray points straight at a cap
  const tSide = R / absS;
  if (Math.abs(tSide * c) <= a) return tSide;
  return a * Math.abs(c) + Math.sqrt(Math.max(R * R - a * a * s * s, 0));
}

/** Polar radius of an arbitrary parametric profile (used to fit the eyes). */
function radiusAtAngle(profile: number[], theta: number): number {
  const idx = ((Math.round((theta / (Math.PI * 2)) * PROFILE_SAMPLES) % PROFILE_SAMPLES) + PROFILE_SAMPLES) % PROFILE_SAMPLES;
  return profile[idx];
}

/** Exponential ease-out (measured family in bloub; never overshoots). */
function easeOutQuint(x: number): number {
  return 1 - Math.pow(1 - x, 5);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/* ── poses ──────────────────────────────────────────────────────────────────── */

export interface Pose {
  /** Capsule half-length (unit space; rendered body ≈ 2*(a+R) wide). */
  a: number;
  /** Capsule radius. */
  R: number;
  /** Vertical squash factor (1 = round; <1 flatter). */
  squash: number;
  /** Body glow intensity 0..1. */
  glow: number;
  /** Orbiting scan ring visibility 0..1 (searching state). */
  ring: number;
  /** Ring angle offset (radians). */
  ringAngle: number;
  /** Eye openness multiplier (0 = closed lines, 1 = full). */
  eyeOpen: number;
  /** Eye size multiplier. */
  eyeScale: number;
  /** Resting gaze base (engine adds wander after mixing). */
  gazeX: number;
  gazeY: number;
  /** Face brightness (offline dims the face). */
  faceAlpha: number;
  /** Body tilt in radians (subtle lean). */
  tilt: number;
}

const BASE: Pose = {
  a: 0.62,
  R: 0.55,
  squash: 1,
  glow: 0.25,
  ring: 0,
  ringAngle: 0,
  eyeOpen: 1,
  eyeScale: 1,
  gazeX: 0,
  gazeY: 0,
  faceAlpha: 1,
  tilt: 0,
};

/** Modulate the base pose for a state at local time t (seconds). */
function poseFor(state: AvatarState, t: number): Pose {
  const p: Pose = { ...BASE };
  // Deterministic wobble primitives — sums of sines with distinct frequencies
  // so the motion never looks looped, but stays a pure function of t.
  const breathe = Math.sin(t * 1.05) * 0.5 + Math.sin(t * 0.53 + 1.7) * 0.5; // -1..1
  switch (state) {
    case "idle":
    case "waiting": {
      p.R *= 1 + breathe * 0.022;
      p.a *= 1 - breathe * 0.012;
      p.glow = 0.2 + 0.06 * (0.5 + 0.5 * Math.sin(t * 0.7));
      break;
    }
    case "excited": {
      // Bright, lively: quick light bounce, elevated gaze, energetic glow.
      const bounce = Math.abs(Math.sin(t * 2.4));
      p.R *= 1 + bounce * 0.035;
      p.a *= 1 + bounce * 0.012;
      p.glow = 0.55 + 0.2 * bounce;
      p.eyeScale = 1.12;
      p.gazeY = -0.12;
      break;
    }
    case "listening": {
      p.R *= 1 + breathe * 0.01;
      p.eyeScale = 1.05;
      p.eyeOpen = 1;
      p.gazeY = 0.05;
      p.glow = 0.35;
      break;
    }
    case "thinking": {
      // Slow, controlled elongation; eyes up-right in thought.
      const slow = Math.sin(t * 0.8);
      p.a *= 1 + 0.16 * (0.5 + 0.5 * slow);
      p.R *= 1 - 0.05 * (0.5 + 0.5 * slow);
      p.gazeX = 0.35;
      p.gazeY = -0.4;
      p.glow = 0.3;
      break;
    }
    case "searching": {
      const orbit = t * 2.2;
      p.ring = 1;
      p.ringAngle = orbit;
      p.gazeX = Math.cos(orbit * 0.5) * 0.5;
      p.gazeY = Math.sin(orbit * 0.35) * 0.2;
      p.glow = 0.45;
      break;
    }
    case "retrieving": {
      const dart = Math.sin(t * 3.1) * 0.5;
      p.gazeX = dart * 0.6;
      p.gazeY = 0.25;
      p.R *= 1 + Math.sin(t * 2.2) * 0.02;
      p.glow = 0.4;
      break;
    }
    case "analyzing": {
      // Rhythmic controlled morphs.
      const pulse = Math.sin(t * 1.6);
      p.a *= 1 + 0.09 * pulse;
      p.R *= 1 - 0.04 * pulse;
      p.gazeX = 0.15 + 0.2 * Math.sin(t * 0.9);
      p.gazeY = 0.12;
      p.glow = 0.38;
      break;
    }
    case "generating": {
      const lively = Math.sin(t * 1.9) * 0.5 + 0.5;
      p.R *= 1 + lively * 0.028;
      p.glow = 0.5 + lively * 0.12;
      p.eyeScale = 1.08;
      p.gazeY = -0.06;
      break;
    }
    case "success": {
      const pop = Math.max(0, Math.sin(t * 3.4));
      p.R *= 1 + pop * 0.05;
      p.glow = 0.75;
      p.eyeScale = 1.18;
      p.gazeY = -0.1;
      break;
    }
    case "warning": {
      p.a *= 0.94;
      p.R *= 0.97;
      p.eyeScale = 0.94;
      p.eyeOpen = 0.82;
      p.glow = 0.3;
      p.gazeY = 0.18;
      break;
    }
    case "error": {
      p.a *= 0.9;
      p.eyeScale = 0.9;
      p.eyeOpen = 0.55;
      p.gazeY = 0.3;
      p.glow = 0.22;
      break;
    }
    case "confirmation": {
      p.eyeScale = 1.02;
      p.gazeY = -0.04;
      p.glow = 0.42;
      break;
    }
    case "cancelled": {
      p.R *= 1 + breathe * 0.015;
      p.eyeOpen = 0.85;
      p.glow = 0.2;
      break;
    }
    case "offline": {
      p.eyeOpen = 0;
      p.faceAlpha = 0.35;
      p.glow = 0.05;
      break;
    }
    default: {
      p.R *= 1 + breathe * 0.02;
    }
  }
  return p;
}

/* ── expressions (eye geometry, independent of state) ───────────────────────── */

export type ExpressionId = "excited" | "neutral" | "focused" | "concerned" | "success" | "error" | "closed";

export interface EyeGeom {
  rx: number;
  ry: number;
  rot: number; // radians; mirrored for the two eyes
  pupil: number; // pupil scale 0..1
}

const EXPRESSIONS: Record<ExpressionId, EyeGeom> = {
  excited: { rx: 0.085, ry: 0.125, rot: -0.12, pupil: 0.62 },
  neutral: { rx: 0.08, ry: 0.105, rot: 0, pupil: 0.58 },
  focused: { rx: 0.075, ry: 0.115, rot: 0.1, pupil: 0.66 },
  concerned: { rx: 0.08, ry: 0.09, rot: 0.22, pupil: 0.5 },
  success: { rx: 0.08, ry: 0.13, rot: -0.08, pupil: 0.55 },
  error: { rx: 0.07, ry: 0.06, rot: 0.18, pupil: 0.42 },
  closed: { rx: 0.08, ry: 0.012, rot: 0, pupil: 0 },
};

export const DEFAULT_EXPRESSION: ExpressionId = "excited";

/** Expression implied by the activity state (contextual faces). */
export function expressionForState(state: AvatarState): ExpressionId {
  switch (state) {
    case "excited":
    case "generating":
      return "excited";
    case "listening":
    case "confirmation":
      return "focused";
    case "thinking":
    case "searching":
    case "retrieving":
    case "analyzing":
      return "focused";
    case "warning":
      return "concerned";
    case "error":
      return "error";
    case "success":
      return "success";
    case "offline":
      return "closed";
    default:
      return DEFAULT_EXPRESSION;
  }
}

/* ── deterministic gaze wander & blink schedule ─────────────────────────────── */

/** Smooth autonomous gaze drift (sum of incommensurable sines). */
function wander(t: number): { x: number; y: number } {
  return {
    x: (Math.sin(t * 0.31) + Math.sin(t * 0.13 + 2.1) * 0.6) * 0.16,
    y: (Math.sin(t * 0.23 + 1.1) + Math.sin(t * 0.09 + 4.2) * 0.6) * 0.12,
  };
}

/** Pre-drawn blink schedule: deterministic times modulo 9s (bloub pattern). */
const BLINK_SCHEDULE = [1.4, 4.9, 8.1];
const BLINK_PERIOD = 9;
const BLINK_DURATION = 0.24;

function blinkFactor(t: number): number {
  const local = t % BLINK_PERIOD;
  for (const b of BLINK_SCHEDULE) {
    const dt = local - b;
    if (dt >= 0 && dt < BLINK_DURATION) {
      // close then reopen, smooth both ways
      const half = BLINK_DURATION / 2;
      const f = 1 - smoothstep(Math.abs(dt - half) / half);
      return 1 - f;
    }
  }
  return 1;
}

/* ── transitions ────────────────────────────────────────────────────────────── */

export const MORPH_DURATION = 0.5;

export interface MorphState {
  from: AvatarState;
  fromPose: Pose; // frozen composite pose at switch time (bloub continuity rule)
  to: AvatarState;
  startedAt: number; // engine-time seconds
}

export interface EngineInput {
  state: AvatarState;
  expression?: ExpressionId;
  /** External gaze target in [-1,1], already mixed by the caller. */
  look?: { x: number; y: number } | null;
  lookMix?: number; // 0..1 how much the external look commands the direction
  /** Frozen morph bookkeeping (caller keeps it across frames). */
  morph?: MorphState | null;
  /** Current engine time in seconds. */
  t: number;
  /** Reduced motion: return a fixed calm frame. */
  reducedMotion?: boolean;
}

export interface SampledAvatar {
  /** SVG path (unit space, centered at 0,0; roughly fits [-1,1]). */
  bodyPath: string;
  profile: number[];
  pose: Pose;
  eyes: {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    rot: number;
    pupil: { cx: number; cy: number; r: number };
    highlight: { cx: number; cy: number; r: number };
  }[];
  ring: { visible: boolean; angle: number };
  glow: number;
  faceAlpha: number;
  nextMorph: MorphState | null;
}

function blendPose(from: Pose, to: Pose, k: number): Pose {
  const out = {} as Pose;
  for (const key of Object.keys(from) as (keyof Pose)[]) {
    out[key] = from[key] + (to[key] - from[key]) * k;
  }
  return out;
}

function profileOf(p: Pose): number[] {
  const profile: number[] = new Array(PROFILE_SAMPLES);
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    const theta = (i / PROFILE_SAMPLES) * Math.PI * 2;
    let r = capsuleRadius(theta, p.a, p.R);
    // Vertical squash: scale the y component, recompute effective radius.
    if (p.squash !== 1) {
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta) * p.squash;
      r = Math.hypot(x, y);
    }
    profile[i] = r;
  }
  return profile;
}

function profileToPath(profile: number[], squash: number): string {
  const pts: [number, number][] = profile.map((r, i) => {
    const theta = (i / PROFILE_SAMPLES) * Math.PI * 2;
    return [r * Math.cos(theta), r * Math.sin(theta) * squash];
  });
  // Midpoint-quadratic smoothing: smooth closed curve from 64 samples.
  let d = "";
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % PROFILE_SAMPLES];
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    if (i === 0) d += `M ${mx.toFixed(4)} ${my.toFixed(4)}`;
    else d += ` Q ${x2.toFixed(4)} ${y2.toFixed(4)} ${((x2 + pts[(i + 1) % PROFILE_SAMPLES][0]) / 2).toFixed(4)} ${((y2 + pts[(i + 1) % PROFILE_SAMPLES][1]) / 2).toFixed(4)}`;
  }
  d += " Z";
  return d;
}

/** Build the frame. Returns the composite pose + next morph bookkeeping. */
export function sampleAvatar(input: EngineInput): SampledAvatar {
  const { state, t, reducedMotion } = input;
  const expression = input.expression ?? expressionForState(state);

  if (reducedMotion) {
    // A single calm, fixed frame — no animation loop needed at all.
    const pose = poseFor("idle", 0);
    return finishFrame(pose, pose, expression, { x: 0, y: 0 }, pose.gazeX, pose.gazeY, 1, pose, null);
  }

  // Morph blending from the frozen composite pose (continuity rule): a state
  // change landing inside an in-progress morph blends from the frame actually
  // on screen, never from the outgoing state's full pose.
  let pose: Pose;
  let nextMorph: MorphState | null = input.morph ?? null;
  if (nextMorph && nextMorph.to !== state) {
    const frozen = currentComposite(nextMorph, t);
    nextMorph = { from: nextMorph.to, fromPose: frozen, to: state, startedAt: t };
  }
  if (nextMorph) {
    const k = easeOutQuint(clamp((t - nextMorph.startedAt) / MORPH_DURATION, 0, 1));
    pose = blendPose(nextMorph.fromPose, poseFor(nextMorph.to, t), k);
    if (k >= 1) nextMorph = null;
  } else {
    pose = poseFor(state, t);
  }

  // Gaze: mix external look, then ADD wander after the mix (bloub rule —
  // otherwise drift cancels the pointer target and the bot "hunts").
  const mix = clamp(input.lookMix ?? 0, 0, 1);
  const w = wander(t);
  const baseGx = pose.gazeX * (1 - mix) + (input.look?.x ?? 0) * mix;
  const baseGy = pose.gazeY * (1 - mix) + (input.look?.y ?? 0) * mix;
  const gx = clamp(baseGx + w.x * (1 - mix * 0.7), -1, 1);
  const gy = clamp(baseGy + w.y * (1 - mix * 0.7), -1, 1);

  const blink = blinkFactor(t) * pose.eyeOpen;

  return finishFrame(pose, pose, expression, { x: gx, y: gy }, pose.gazeX, pose.gazeY, blink, pose, nextMorph);
}

function currentComposite(morph: MorphState, t: number): Pose {
  const k = easeOutQuint(clamp((t - morph.startedAt) / MORPH_DURATION, 0, 1));
  return blendPose(morph.fromPose, poseFor(morph.to, t), k);
}

/* ── frame assembly: eyes fitted to the real profile radius ─────────────────── */

function finishFrame(
  pose: Pose,
  _displayPose: Pose,
  expression: ExpressionId,
  gaze: { x: number; y: number },
  _baseGx: number,
  _baseGy: number,
  blink: number,
  _p: Pose,
  nextMorph: MorphState | null
): SampledAvatar {
  const profile = profileOf(pose);
  const geom = EXPRESSIONS[expression] ?? EXPRESSIONS[DEFAULT_EXPRESSION];
  const ry = geom.ry * pose.eyeScale * blink;
  const rx = geom.rx * pose.eyeScale;

  // Eye anchors: upper half of the capsule, spaced around the vertical axis.
  // Fitted to the profile's real radius at the eye angle so the eyes stay
  // inside the silhouette through every morph (bloub radiusAtAngle rule).
  const eyeAngleL = Math.PI * 1.18; // upper-left region
  const eyeAngleR = Math.PI * 1.82; // upper-right region
  const rL = radiusAtAngle(profile, eyeAngleL);
  const rR = radiusAtAngle(profile, eyeAngleR);
  const anchorFactor = 0.52;
  const distL = Math.min(0.62, rL * anchorFactor);
  const distR = Math.min(0.62, rR * anchorFactor);

  const cxL = Math.cos(eyeAngleL) * distL;
  const cyL = Math.abs(Math.sin(eyeAngleL)) * distL * -1;
  const cxR = Math.cos(eyeAngleR) * distR;
  const cyR = Math.abs(Math.sin(eyeAngleR)) * distR * -1;

  const eyeY = -0.08; // slight upward seating on the capsule
  const padL = Math.max(rx + 0.02, distL * 0.28);
  const padR = Math.max(rx + 0.02, distR * 0.28);

  const eyes = [0, 1].map((i) => {
    const cx = i === 0 ? cxL : cxR;
    const baseCy = eyeY + (i === 0 ? cyL : cyR);
    const maxCy = baseCy; // keep them level with each other
    // pupil offset follows gaze, clamped inside the eye
    const px = clamp(gaze.x * 0.45, -1, 1) * rx * 0.55;
    const py = clamp(gaze.y * 0.45, -1, 1) * Math.max(ry, 0.02) * 0.55;
    const safeRy = Math.max(ry, 0.015);
    const pupilR = geom.pupil * Math.min(rx, safeRy) * 0.9;
    return {
      cx,
      cy: maxCy,
      rx,
      ry: safeRy,
      rot: geom.rot * (i === 0 ? 1 : -1),
      pupil: { cx: cx + px, cy: maxCy + py, r: pupilR },
      highlight: { cx: cx - rx * 0.32, cy: maxCy - safeRy * 0.38, r: Math.min(rx, safeRy) * 0.26 },
    };
  });
  void padL;
  void padR;

  return {
    bodyPath: profileToPath(profile, pose.squash),
    profile,
    pose,
    eyes,
    ring: { visible: pose.ring > 0.05, angle: pose.ringAngle },
    glow: pose.glow,
    faceAlpha: pose.faceAlpha,
    nextMorph,
  };
}

export { easeOutQuint, capsuleRadius as capsuleRadiusForTest };
