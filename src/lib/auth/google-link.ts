import { createHmac, timingSafeEqual } from "crypto";

export const GOOGLE_LINK_COOKIE = "meil_google_link_pending";
export const GOOGLE_LINK_TTL_SEC = 5 * 60; // 5 minutes to verify existing credentials

export interface GooglePendingLink {
  googleSub: string;
  googleEmail: string;
  portal: string;
  remember: boolean;
  exp: number;
}

function getSigningSecret(): string {
  return (
    process.env.SESSION_SECRET?.trim() ||
    "meil-esg-dev-ephemeral-session-secret-change-in-prod"
  );
}

/** Sign a short-lived Google verification payload for credential-based account linking. */
export function signGoogleLinkCookie(payload: GooglePendingLink): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", getSigningSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

/** Verify and parse a signed pending Google link cookie, rejecting expired/tampered values. */
export function verifyGoogleLinkCookie(
  raw: string | undefined | null
): GooglePendingLink | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const encoded = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expectedSig = createHmac("sha256", getSigningSecret())
    .update(encoded)
    .digest("base64url");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as GooglePendingLink;
    if (
      !parsed.googleSub ||
      !parsed.googleEmail ||
      !parsed.exp ||
      parsed.exp < Date.now()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

