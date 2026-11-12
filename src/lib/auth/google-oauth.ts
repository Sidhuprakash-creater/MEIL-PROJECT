import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

export const GOOGLE_PKCE_COOKIE = "meil_google_pkce";

export interface GooglePkceState {
  state: string;
  codeVerifier: string;
  portal: string;
  rememberMe: boolean;
  exp: number;
}

function oauthSecret(): string {
  return (
    process.env.SESSION_SECRET?.trim() ||
    "meil-esg-dev-oauth-secret-set-SESSION_SECRET-in-prod"
  );
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
}

export function resolveRequestOrigin(req: Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

export function generatePkcePair(): {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
} {
  const state = randomBytes(24).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { state, codeVerifier, codeChallenge };
}

export function signPkceCookie(payload: GooglePkceState): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", oauthSecret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyPkceCookie(raw: string | undefined): GooglePkceState | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = createHmac("sha256", oauthSecret())
    .update(encoded)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as GooglePkceState;
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const GOOGLE_AUTH_ERROR_MESSAGES: Record<string, string> = {
  not_configured:
    "Google Sign-In is not configured yet (missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).",
  oauth_denied: "Google Sign-In was cancelled before completion.",
  invalid_state:
    "Google Sign-In session expired or state verification failed. Please try again.",
  token_exchange:
    "Could not complete verification with Google. Please try again or sign in with credentials.",
  unverified_email:
    "Your Google email address is not verified by Google and cannot be accepted.",
  domain_restricted:
    "Your Google account domain is not permitted by organization policy.",
  not_provisioned:
    "No pre-provisioned MEIL ESG account matches this Google email. Ask your Group or Subsidiary Admin to create or link your account first.",
  inactive:
    "Your MEIL ESG account is suspended or inactive. Contact your Group ESG Administrator.",
  sub_mismatch:
    "Google identity mismatch detected against this account. Contact your Group ESG Administrator.",
};

