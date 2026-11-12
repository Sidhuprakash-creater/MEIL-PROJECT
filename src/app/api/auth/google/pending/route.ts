import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  GOOGLE_LINK_COOKIE,
  verifyGoogleLinkCookie,
} from "@/lib/auth/google-link";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(GOOGLE_LINK_COOKIE)?.value;
  const pending = verifyGoogleLinkCookie(raw);

  if (!pending) {
    return NextResponse.json({ pending: null }, { status: 200 });
  }

  return NextResponse.json({
    pending: {
      googleEmail: pending.googleEmail,
      portal: pending.portal,
      remember: pending.remember,
      expiresAt: pending.exp,
      allowDemoReassign:
        process.env.ALLOW_DEMO_PASSWORDS?.trim().toLowerCase() === "true",
    },
  });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GOOGLE_LINK_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}

