import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAuthAudit as logAudit } from "@/lib/auth-audit";
import { scopeTypeForRole } from "@/lib/platform-config";
import { clientIp, createSession } from "@/lib/session";
import { findPreProvisionedGoogleUser } from "@/lib/auth/user-lookup";
import { invalidateAllAuthCaches } from "@/lib/auth/session-utils";
import {
  GOOGLE_LINK_COOKIE,
  GOOGLE_LINK_TTL_SEC,
  signGoogleLinkCookie,
} from "@/lib/auth/google-link";
import {
  GOOGLE_PKCE_COOKIE,
  isGoogleOAuthConfigured,
  resolveRequestOrigin,
  verifyPkceCookie,
} from "@/lib/auth/google-oauth";

export const dynamic = "force-dynamic";

function failRedirect(origin: string, code: string) {
  return NextResponse.redirect(
    `${origin}/?enter=1&authError=${encodeURIComponent(code)}`
  );
}

/** GET /api/auth/google/callback — Completes PKCE exchange and enforces strict Option A pre-provisioned login. */
export async function GET(request: Request) {
  const origin = resolveRequestOrigin(request);
  const ip = clientIp(request.headers);
  const userAgent = request.headers.get("user-agent") ?? undefined;
  const reqUrl = new URL(request.url);
  const jar = await cookies();

  const clearPkceCookie = () => {
    jar.delete(GOOGLE_PKCE_COOKIE);
  };

  if (!isGoogleOAuthConfigured()) {
    clearPkceCookie();
    return failRedirect(origin, "not_configured");
  }

  if (reqUrl.searchParams.get("error")) {
    clearPkceCookie();
    await logAudit({
      eventType: "LOGIN_FAILED",
      result: "FAILURE",
      portal: "google",
      reason: "GOOGLE_OAUTH_DENIED",
      detail: reqUrl.searchParams.get("error") ?? "",
      ip,
      userAgent,
    });
    return failRedirect(origin, "oauth_denied");
  }

  const code = reqUrl.searchParams.get("code");
  const returnedState = reqUrl.searchParams.get("state");
  const pkce = verifyPkceCookie(jar.get(GOOGLE_PKCE_COOKIE)?.value);
  clearPkceCookie();

  if (!code || !returnedState || !pkce || pkce.state !== returnedState) {
    await logAudit({
      eventType: "LOGIN_FAILED",
      result: "FAILURE",
      portal: "google",
      reason: "GOOGLE_INVALID_STATE",
      ip,
      userAgent,
    });
    return failRedirect(origin, "invalid_state");
  }

  const redirectUri = `${origin}/api/auth/google/callback`;

  let accessToken: string;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
        client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: pkce.codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      await logAudit({
        eventType: "LOGIN_FAILED",
        result: "FAILURE",
        portal: pkce.portal,
        reason: "GOOGLE_TOKEN_EXCHANGE_FAILED",
        detail: `status=${tokenRes.status}`,
        ip,
        userAgent,
      });
      return failRedirect(origin, "token_exchange");
    }

    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      return failRedirect(origin, "token_exchange");
    }
    accessToken = tokenJson.access_token;
  } catch {
    return failRedirect(origin, "token_exchange");
  }

  let googleSub = "";
  let googleEmail = "";
  let emailVerified = false;
  try {
    const profileRes = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!profileRes.ok) {
      return failRedirect(origin, "token_exchange");
    }
    const profile = (await profileRes.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
    };
    googleSub = String(profile.sub ?? "").trim();
    googleEmail = String(profile.email ?? "").trim().toLowerCase();
    emailVerified = Boolean(profile.email_verified);
  } catch {
    return failRedirect(origin, "token_exchange");
  }

  if (!googleEmail || !emailVerified || !googleSub) {
    await logAudit({
      eventType: "LOGIN_FAILED",
      result: "FAILURE",
      employeeId: googleEmail || "unknown-google",
      portal: pkce.portal,
      reason: "GOOGLE_UNVERIFIED_EMAIL",
      ip,
      userAgent,
    });
    return failRedirect(origin, "unverified_email");
  }

  // Optional domain restriction if GOOGLE_ALLOWED_DOMAIN is configured
  const allowedDomains = process.env.GOOGLE_ALLOWED_DOMAIN
    ?.split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (allowedDomains && allowedDomains.length > 0) {
    const domain = googleEmail.split("@")[1] ?? "";
    if (!allowedDomains.includes(domain)) {
      await logAudit({
        eventType: "LOGIN_FAILED",
        result: "FAILURE",
        employeeId: googleEmail,
        portal: pkce.portal,
        reason: "GOOGLE_DOMAIN_RESTRICTED",
        detail: domain,
        ip,
        userAgent,
      });
      return failRedirect(origin, "domain_restricted");
    }
  }

  // Strict Option A: only pre-provisioned active/invited users may sign in
  const user = await findPreProvisionedGoogleUser({
    sub: googleSub,
    email: googleEmail,
  });

  if (!user) {
    await logAudit({
      eventType: "LOGIN_FAILED",
      result: "FAILURE",
      employeeId: googleEmail,
      portal: pkce.portal,
      reason: "GOOGLE_LINK_REQUIRED",
      detail: `email=${googleEmail}`,
      ip,
      userAgent,
    });
    const linkTarget =
      pkce.portal === "project"
        ? `${origin}/?portal=project&linkGoogle=1`
        : `${origin}/?enter=1&linkGoogle=1`;
    const res = NextResponse.redirect(linkTarget);
    res.cookies.set(
      GOOGLE_LINK_COOKIE,
      signGoogleLinkCookie({
        googleSub,
        googleEmail,
        portal: pkce.portal,
        remember: pkce.rememberMe,
        exp: Date.now() + GOOGLE_LINK_TTL_SEC * 1000,
      }),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: GOOGLE_LINK_TTL_SEC,
      }
    );
    return res;
  }

  if (user.status !== "ACTIVE" && user.status !== "INVITED") {
    await logAudit({
      eventType: "LOGIN_FAILED",
      result: "FAILURE",
      employeeId: user.employeeId ?? user.email,
      userId: user.id,
      portal: pkce.portal,
      role: user.role,
      reason: "INACTIVE",
      detail: `status=${user.status}`,
      ip,
      userAgent,
    });
    return failRedirect(origin, "inactive");
  }

  if (user.googleSub && user.googleSub !== googleSub) {
    await logAudit({
      eventType: "LOGIN_FAILED",
      result: "FAILURE",
      employeeId: user.employeeId ?? user.email,
      userId: user.id,
      portal: pkce.portal,
      role: user.role,
      reason: "GOOGLE_SUB_MISMATCH",
      ip,
      userAgent,
    });
    return failRedirect(origin, "sub_mismatch");
  }

  const nextProvider = user.passwordHash ? "BOTH" : "GOOGLE";
  const updatedUser = await db.user.update({
    where: { id: user.id },
    data: {
      googleSub: user.googleSub ?? googleSub,
      googleEmail: user.googleEmail ?? googleEmail,
      authProvider: nextProvider,
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      lastLoginAt: new Date(),
      lastActiveAt: new Date(),
      ...(user.status === "INVITED" ? { status: "ACTIVE" } : {}),
    },
    include: { subsidiary: true, businessUnit: true, project: true },
  });

  await createSession({
    userId: updatedUser.id,
    rememberMe: pkce.rememberMe,
    userAgent,
    ip,
  });
  invalidateAllAuthCaches(updatedUser.id);

  await logAudit({
    eventType: "LOGIN_SUCCESS",
    result: "SUCCESS",
    employeeId: updatedUser.employeeId ?? updatedUser.email,
    userId: updatedUser.id,
    portal: scopeTypeForRole(updatedUser.role),
    role: updatedUser.role,
    scopeRef:
      updatedUser.businessUnit?.code ??
      updatedUser.subsidiary?.code ??
      "GROUP",
    detail: `provider=GOOGLE email=${googleEmail}`,
    ip,
    userAgent,
  });

  const scopeType = scopeTypeForRole(updatedUser.role);
  return NextResponse.redirect(
    `${origin}/?dashboard=1&portal=${encodeURIComponent(scopeType)}`
  );
}

