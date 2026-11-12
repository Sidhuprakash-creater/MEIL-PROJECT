import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  GOOGLE_PKCE_COOKIE,
  generatePkcePair,
  isGoogleOAuthConfigured,
  resolveRequestOrigin,
  signPkceCookie,
} from "@/lib/auth/google-oauth";

export const dynamic = "force-dynamic";

/** GET /api/auth/google/start — Initiates Direct Google OAuth 2.0 Authorization Code + PKCE flow. */
export async function GET(request: Request) {
  const origin = resolveRequestOrigin(request);

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(
      `${origin}/?enter=1&authError=not_configured`
    );
  }

  const reqUrl = new URL(request.url);
  const portal = reqUrl.searchParams.get("portal") || "gateway";
  const rememberMe = reqUrl.searchParams.get("remember") === "1";

  const { state, codeVerifier, codeChallenge } = generatePkcePair();
  const redirectUri = `${origin}/api/auth/google/callback`;

  const cookieValue = signPkceCookie({
    state,
    codeVerifier,
    portal,
    rememberMe,
    exp: Date.now() + 10 * 60 * 1000, // 10 minutes
  });

  const jar = await cookies();
  jar.set(GOOGLE_PKCE_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });

  const allowedDomains = process.env.GOOGLE_ALLOWED_DOMAIN
    ?.split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  if (allowedDomains && allowedDomains.length === 1) {
    params.set("hd", allowedDomains[0]);
  }

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}

