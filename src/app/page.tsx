"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG & BRSR PLATFORM — APP GATE (single route, staged experience)

   Flow (per product spec):
     1. Landing page (public marketing site)
     2. "Enter Platform" → secure access gateway (portal chooser)
     3. Group Portal → Group Admin role → credentials → Group Admin workspace
        Subsidiary Portal → subsidiary → Subsidiary Admin → credentials → Subsidiary workspace
     4. Server-verified session (httpOnly cookie + Session row)

   The server owns the session; the gate only renders the right stage and
   always re-checks against /api/auth/session.
   ═══════════════════════════════════════════════════════════════════════════ */

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  LogOut,
  ShieldQuestion,
} from "lucide-react";
import type { SessionPayload, VerifiedUser } from "@/lib/platform-config";

const LandingPage = dynamic(() => import("@/components/landing/landing-page"), {
  ssr: false,
  loading: () => <div className="ep-root" aria-busy="true" aria-label="Loading" />,
});

const EnterPlatform = dynamic(
  () => import("@/components/enter-platform/enter-platform"),
  { ssr: false, loading: () => <div className="ep-root" aria-busy="true" aria-label="Loading secure gateway" /> }
);

const WorkspaceShell = dynamic(
  () => import("@/components/workspace/shell").then((m) => m.WorkspaceShell),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-[#eef6fd]">
        <div className="glass glass-sheen flex items-center gap-3 rounded-3xl px-6 py-5">
          <span className="glass-strong flex h-10 w-10 items-center justify-center rounded-2xl">
            <span className="bg-gradient-to-br from-[#3a7bff] to-[#6a5bff] bg-clip-text text-[15px] font-extrabold text-transparent">ME</span>
          </span>
          <div>
            <div className="text-sm font-semibold text-[#17263d]">MEIL ESG &amp; BRSR Platform</div>
            <div className="text-xs text-[#66778d]">Loading Group Admin workspace…</div>
          </div>
        </div>
      </div>
    ),
  }
);

const SaWorkspaceShell = dynamic(
  () => import("@/components/subsidiary/shell").then((m) => m.SaWorkspaceShell),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-[#eef6fd]">
        <div className="glass glass-sheen flex items-center gap-3 rounded-3xl px-6 py-5">
          <span className="glass-strong flex h-10 w-10 items-center justify-center rounded-2xl">
            <span className="bg-gradient-to-br from-[#20a779] to-[#3a7bff] bg-clip-text text-[15px] font-extrabold text-transparent">ME</span>
          </span>
          <div>
            <div className="text-sm font-semibold text-[#17263d]">MEIL ESG &amp; BRSR Platform</div>
            <div className="text-xs text-[#66778d]">Loading Subsidiary Admin workspace…</div>
          </div>
        </div>
      </div>
    ),
  }
);

const SmWorkspaceShell = dynamic(
  () => import("@/components/manager/shell").then((m) => m.SmWorkspaceShell),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-[#eef6fd]">
        <div className="glass glass-sheen flex items-center gap-3 rounded-3xl px-6 py-5">
          <span className="glass-strong flex h-10 w-10 items-center justify-center rounded-2xl">
            <span className="bg-gradient-to-br from-[#7c5cff] to-[#3a7bff] bg-clip-text text-[15px] font-extrabold text-transparent">ME</span>
          </span>
          <div>
            <div className="text-sm font-semibold text-[#17263d]">MEIL ESG &amp; BRSR Platform</div>
            <div className="text-xs text-[#66778d]">Loading Subsidiary Manager workspace…</div>
          </div>
        </div>
      </div>
    ),
  }
);

const SiteOpsShell = dynamic(
  () => import("@/components/site-ops/shell").then((m) => m.SiteOpsShell),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-[#eef6fd]">
        <div className="glass glass-sheen flex items-center gap-3 rounded-3xl px-6 py-5">
          <span className="glass-strong flex h-10 w-10 items-center justify-center rounded-2xl">
            <span className="bg-gradient-to-br from-[#f97316] to-[#0ea5e9] bg-clip-text text-[15px] font-extrabold text-transparent">ME</span>
          </span>
          <div>
            <div className="text-sm font-semibold text-[#17263d]">MEIL ESG &amp; BRSR Platform</div>
            <div className="text-xs text-[#66778d]">Loading Project User portal…</div>
          </div>
        </div>
      </div>
    ),
  }
);

/* Project User Portal — the portal's own native experience (org → project →
   role → sign-in → workspace), mounted as its own gated surface. */
const PuApp = dynamic(() => import("@/components/pu/pu-app"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-[#eef6fd]">
      <div className="glass glass-sheen flex items-center gap-3 rounded-3xl px-6 py-5">
        <span className="glass-strong flex h-10 w-10 items-center justify-center rounded-2xl">
          <span className="bg-gradient-to-br from-[#f97316] to-[#0ea5e9] bg-clip-text text-[15px] font-extrabold text-transparent">ME</span>
        </span>
        <div>
          <div className="text-sm font-semibold text-[#17263d]">MEIL ESG &amp; BRSR Platform</div>
          <div className="text-xs text-[#66778d]">Opening Project User portal…</div>
        </div>
      </div>
    </div>
  ),
});

type Gate = "landing" | "enter" | "workspace" | "project-portal";

/* Group-scope roles that may open the full group console workspace. */
const GROUP_ROLES = new Set(["GROUP_ADMIN", "ORG_MANAGER"]);
/* Subsidiary-scope roles with shipped consoles. */
const SUBSIDIARY_ADMIN_ROLES = new Set(["SUBSIDIARY_ADMIN"]);
const SUBSIDIARY_MANAGER_ROLES = new Set(["SUBSIDIARY_MANAGER"]);
/* Site-level roles served by the integrated Project User (site operations) portal. */
const PROJECT_USER_ROLES = new Set([
  "ENV_DATA_USER",
  "FIN_RESOURCE_USER",
  "EHS_USER",
  "HR_USER",
  "PROCUREMENT_USER",
  "CSR_USER",
  "COMPLIANCE_USER",
  "ESG_ANALYST",
]);

export default function Page() {
  const [gate, setGate] = useState<Gate>("landing");
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [scopedUser, setScopedUser] = useState<VerifiedUser | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  /* Resolve which console a verified role may open. */
  const consoleForRole = useCallback((role: string): "group" | "subsidiary" | "manager" | "project" | "none" => {
    if (GROUP_ROLES.has(role)) return "group";
    if (SUBSIDIARY_ADMIN_ROLES.has(role)) return "subsidiary";
    if (SUBSIDIARY_MANAGER_ROLES.has(role)) return "manager";
    if (PROJECT_USER_ROLES.has(role)) return "project";
    return "none";
  }, []);

  /* Restore an existing session + honour deep links (/?enter=1, /?dashboard=1, /?portal=project) */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const deepLink =
      params.get("enter") === "1"
        ? "enter"
        : params.get("dashboard") === "1"
          ? "workspace"
          : params.get("portal") === "project"
            ? "project-portal"
            : null;

    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d: SessionPayload) => {
        setSession(d);
        if (d.authenticated && d.user) {
          const target = consoleForRole(d.user.role);
          if (deepLink === "project-portal") {
            /* Portal deep link always opens the native portal experience. */
            setGate("project-portal");
          } else if (target !== "none") {
            if (deepLink === "workspace" || deepLink === "enter") setGate("workspace");
          } else if (deepLink) {
            setScopedUser(d.user);
            setGate("enter");
          }
        } else if (deepLink) {
          setGate(deepLink === "project-portal" ? "project-portal" : "enter");
        }
      })
      .catch(() => {
        setSession({ authenticated: false });
        if (deepLink) setGate("enter");
      });
  }, [consoleForRole]);

  /* Landing → Enter Platform (role-aware shortcut for live sessions) */
  const handleEnter = useCallback(() => {
    if (session === null) return; // session probe still in flight
    if (session.authenticated && session.user && consoleForRole(session.user.role) !== "none") {
      setGate("workspace");
    } else {
      setGate("enter");
    }
  }, [session, consoleForRole]);

  /* Gateway login success */
  const handleAuthed = useCallback((user: VerifiedUser) => {
    setSession({ authenticated: true, user });
    if (consoleForRole(user.role) !== "none") {
      setScopedUser(null);
      setGate("workspace");
    } else {
      /* Honest scope notice — this release ships the Group, Subsidiary Admin,
         Subsidiary Manager and Project User consoles. */
      setScopedUser(user);
    }
  }, [consoleForRole]);

  /* Workspace sign out → revoke server session → back to the gateway */
  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* cookie revocation is best-effort; local state is authoritative */
    }
    setSession({ authenticated: false });
    setScopedUser(null);
    setSigningOut(false);
    setGate("enter");
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  /* Gateway → Project User Portal (native welcome flow, no credential wizard) */
  const handleEnterProjectPortal = useCallback(() => {
    setGate("project-portal");
    window.history.replaceState(null, "", "/?portal=project");
  }, []);

  /* Project User Portal exit → back to the gateway */
  const handleExitProjectPortal = useCallback(() => {
    setGate("enter");
    window.history.replaceState(null, "", "/?enter=1");
  }, []);

  /* Gateway → back to public site */
  const handleExitToSite = useCallback(() => {
    setGate("landing");
    window.history.replaceState(null, "", window.location.pathname);
    window.scrollTo({ top: 0 });
  }, []);

  /* Signed in under a scope without a shipped console: honest notice. */
  if (scopedUser && gate !== "landing") {
    return (
      <div className="ep-root" style={{ alignItems: "center", justifyContent: "center", display: "flex" }}>
        <div className="ep-panel glass-dark glass-edge noise" style={{ maxWidth: 460, margin: "24px auto" }}>
          <div className="ep-flow">
            <div className="ep-flow-head">
              <span className="ep-card-ico" style={{ ["--ep-accent" as string]: "var(--teal-400)" }}>
                <ShieldQuestion size={23} strokeWidth={1.8} />
              </span>
              <div>
                <b>Scope console not included</b>
                <small>Signed in · {scopedUser.roleLabel}</small>
              </div>
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--tx-500)" }}>
              You are verified as <strong style={{ color: "var(--gold-600)" }}>{scopedUser.name}</strong>
              {" "}({scopedUser.roleLabel}
              {scopedUser.scope.subsidiary ? ` · ${scopedUser.scope.subsidiary.name}` : ""}
              {scopedUser.scope.businessUnit ? ` · ${scopedUser.scope.businessUnit.name}` : ""}).
              This release ships the Group Admin, Subsidiary Admin, Subsidiary
              Manager and Project User consoles. Your scope&apos;s dedicated console is
              delivered in a later phase.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
              <button
                type="button"
                className="ep-btn"
                style={{ width: "auto", padding: "12px 22px", fontSize: 13 }}
                onClick={() => void handleSignOut()}
                disabled={signingOut}
              >
                <LogOut size={15} strokeWidth={2.2} />
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
              <button
                type="button"
                className="ep-btn ep-btn-ghost"
                style={{ width: "auto", padding: "12px 22px", fontSize: 13 }}
                onClick={handleExitToSite}
              >
                <Building2 size={15} strokeWidth={2.2} />
                Back to site
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gate === "workspace") {
    if (session === null) {
      /* session probe still in flight — brief ink splash */
      return (
        <div className="ep-root" aria-busy="true" aria-label="Restoring secure session" />
      );
    }
    if (session.authenticated && session.user) {
      const role = session.user.role;
      if (GROUP_ROLES.has(role)) {
        return (
          <WorkspaceShell
            sessionUser={{
              id: session.user.id,
              name: session.user.name,
              email: session.user.employeeId,
              role: session.user.role,
              roleLabel: session.user.roleLabel,
            }}
            onSignOut={() => void handleSignOut()}
          />
        );
      }
      if (SUBSIDIARY_ADMIN_ROLES.has(role) && session.user.scope.subsidiary) {
        return (
          <SaWorkspaceShell
            sessionUser={{
              id: session.user.id,
              name: session.user.name,
              email: session.user.employeeId,
              role: session.user.role,
              roleLabel: session.user.roleLabel,
              subsidiary: session.user.scope.subsidiary,
            }}
            onSignOut={() => void handleSignOut()}
          />
        );
      }
      if (SUBSIDIARY_MANAGER_ROLES.has(role) && session.user.scope.subsidiary) {
        return (
          <SmWorkspaceShell
            sessionUser={{
              id: session.user.id,
              name: session.user.name,
              email: session.user.employeeId,
              role: session.user.role,
              roleLabel: session.user.roleLabel,
              subsidiary: session.user.scope.subsidiary,
            }}
            onSignOut={() => void handleSignOut()}
          />
        );
      }
      if (PROJECT_USER_ROLES.has(role)) {
        return (
          <SiteOpsShell
            sessionUser={{
              id: session.user.id,
              employeeId: session.user.employeeId,
              name: session.user.name,
              email: session.user.employeeId,
              role: session.user.role,
              roleLabel: session.user.roleLabel,
              subsidiary: session.user.scope.subsidiary ?? null,
              businessUnit: session.user.scope.businessUnit ?? null,
              project: session.user.scope.project ?? null,
            }}
            onSignOut={() => void handleSignOut()}
          />
        );
      }
    }
    /* stale workspace link without a live session → gateway */
    return (
      <EnterPlatform
        onBack={handleExitToSite}
        onAuthed={handleAuthed}
        onEnterProjectPortal={handleEnterProjectPortal}
      />
    );
  }

  if (gate === "project-portal") {
    return <PuApp onExit={handleExitProjectPortal} />;
  }

  if (gate === "enter") {
    return (
      <EnterPlatform
        onBack={handleExitToSite}
        onAuthed={handleAuthed}
        onEnterProjectPortal={handleEnterProjectPortal}
      />
    );
  }

  return (
    <LandingPage
      onEnter={handleEnter}
      /* A restored session turns the CTAs into a direct workspace shortcut. */
      enterLabel={session?.authenticated && session.user && consoleForRole(session.user.role) !== "none" ? "Open Workspace" : undefined}
    />
  );
}
