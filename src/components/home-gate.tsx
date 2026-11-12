"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG & BRSR PLATFORM — APP GATE (client state machine hydrated from SSR)

   Receives initialGate, initialSession, and initialResetToken from src/app/page.tsx
   so authenticated callbacks (/?dashboard=1&portal=...) and OAuth link returns
   (/?enter=1&linkGoogle=1 or /?portal=project&linkGoogle=1) render their target
   surface immediately without flashing the marketing landing page first.
   ═══════════════════════════════════════════════════════════════════════════ */

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  LogOut,
  ShieldQuestion,
} from "lucide-react";
import type { SessionPayload, VerifiedUser } from "@/lib/platform-config";
import { MeilLoader } from "@/components/shared/meil-loader";
import {
  ForceChangePasswordDialog,
  ResetTokenModal,
} from "@/components/auth/password-recovery-modals";

export type Gate = "landing" | "enter" | "workspace" | "project-portal";

function PortalSplash({ role, label }: { role?: string; label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef6fd]">
      <div className="glass glass-sheen rounded-3xl px-6 py-5">
        <MeilLoader compact size={40} role={role} label={label} />
      </div>
    </div>
  );
}

const LandingPage = dynamic(() => import("@/components/landing/landing-page"), {
  ssr: false,
  loading: () => (
    <div className="ep-root flex min-h-screen items-center justify-center" aria-busy="true" aria-label="Loading">
      <MeilLoader size={48} label="Loading MEIL ESG…" />
    </div>
  ),
});

const EnterPlatform = dynamic(
  () => import("@/components/enter-platform/enter-platform"),
  {
    ssr: false,
    loading: () => (
      <div className="ep-root flex min-h-screen items-center justify-center" aria-busy="true" aria-label="Loading secure gateway">
        <MeilLoader size={48} variant="ring" label="Loading secure gateway…" />
      </div>
    ),
  }
);

const WorkspaceShell = dynamic(
  () => import("@/components/workspace/shell").then((m) => m.WorkspaceShell),
  { ssr: false, loading: () => <PortalSplash role="GROUP_ADMIN" label="Loading Group Admin workspace…" /> }
);

const SaWorkspaceShell = dynamic(
  () => import("@/components/subsidiary/shell").then((m) => m.SaWorkspaceShell),
  { ssr: false, loading: () => <PortalSplash role="SUBSIDIARY_ADMIN" label="Loading Subsidiary Admin workspace…" /> }
);

const SmWorkspaceShell = dynamic(
  () => import("@/components/manager/shell").then((m) => m.SmWorkspaceShell),
  { ssr: false, loading: () => <PortalSplash role="SUBSIDIARY_MANAGER" label="Loading Subsidiary Manager workspace…" /> }
);

const BmWorkspaceShell = dynamic(
  () => import("@/components/bm/shell").then((m) => m.BmWorkspaceShell),
  { ssr: false, loading: () => <PortalSplash role="BU_MANAGER" label="Loading Business Unit Manager workspace…" /> }
);

const BaWorkspaceShell = dynamic(
  () => import("@/components/ba/shell").then((m) => m.BaWorkspaceShell),
  { ssr: false, loading: () => <PortalSplash role="BU_ADMIN" label="Loading Business Unit Admin workspace…" /> }
);

const ProjectAdminWorkspaceShell = dynamic(
  () => import("@/components/project-admin/shell").then((m) => m.ProjectAdminWorkspaceShell),
  { ssr: false, loading: () => <PortalSplash role="PROJECT_ADMIN" label="Loading Project Admin workspace…" /> }
);

const SiteOpsShell = dynamic(
  () => import("@/components/site-ops/shell").then((m) => m.SiteOpsShell),
  { ssr: false, loading: () => <PortalSplash role="ENV_DATA_USER" label="Loading Project User portal…" /> }
);

const PuApp = dynamic(() => import("@/components/pu/pu-app"), {
  ssr: false,
  loading: () => <PortalSplash role="PROJECT_USER" label="Opening Project User portal…" />,
});

/* Group-scope roles that may open the full group console workspace. */
const GROUP_ROLES = new Set(["GROUP_ADMIN", "ORG_MANAGER"]);
/* Subsidiary-scope roles with shipped consoles. */
const SUBSIDIARY_ADMIN_ROLES = new Set(["SUBSIDIARY_ADMIN"]);
const SUBSIDIARY_MANAGER_ROLES = new Set(["SUBSIDIARY_MANAGER"]);
/* Business Unit-scope roles with shipped consoles. */
const BU_MANAGER_ROLES = new Set(["BU_MANAGER"]);
const BU_ADMIN_ROLES = new Set(["BU_ADMIN"]);
const PROJECT_ADMIN_ROLES = new Set(["PROJECT_ADMIN"]);
/* Site-level roles served by the integrated Project User (site operations) portal. */
const PROJECT_USER_ROLES = new Set([
  "PROJECT_MANAGER",
  "PROJECT_USER",
  "ENV_DATA_USER",
  "FIN_RESOURCE_USER",
  "EHS_USER",
  "HR_USER",
  "PROCUREMENT_USER",
  "CSR_USER",
  "COMPLIANCE_USER",
  "ESG_ANALYST",
]);

function resolveConsoleForRole(
  role: string
): "group" | "subsidiary" | "manager" | "bu-manager" | "bu-admin" | "project" | "project-admin" | "none" {
  if (GROUP_ROLES.has(role)) return "group";
  if (SUBSIDIARY_ADMIN_ROLES.has(role)) return "subsidiary";
  if (SUBSIDIARY_MANAGER_ROLES.has(role)) return "manager";
  if (BU_MANAGER_ROLES.has(role)) return "bu-manager";
  if (BU_ADMIN_ROLES.has(role)) return "bu-admin";
  if (PROJECT_ADMIN_ROLES.has(role)) return "project-admin";
  if (PROJECT_USER_ROLES.has(role)) return "project";
  return "none";
}

export interface HomeGateProps {
  initialGate?: Gate;
  initialSession?: SessionPayload | null;
  initialResetToken?: string | null;
  initialLinkGoogle?: boolean;
}

export default function HomeGate({
  initialGate = "landing",
  initialSession = null,
  initialResetToken = null,
  initialLinkGoogle = false,
}: HomeGateProps) {
  const [gate, setGate] = useState<Gate>(() => {
    if (
      initialGate === "enter" &&
      !initialLinkGoogle &&
      initialSession?.authenticated &&
      initialSession.user &&
      resolveConsoleForRole(initialSession.user.role) !== "none"
    ) {
      return "workspace";
    }
    return initialGate;
  });
  const [session, setSession] = useState<SessionPayload | null>(initialSession);
  const [scopedUser, setScopedUser] = useState<VerifiedUser | null>(() => {
    if (
      initialGate !== "landing" &&
      initialSession?.authenticated &&
      initialSession.user &&
      resolveConsoleForRole(initialSession.user.role) === "none"
    ) {
      return initialSession.user;
    }
    return null;
  });
  const [signingOut, setSigningOut] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(initialResetToken);

  /* Restore an existing session when not already hydrated from SSR + honour client query deep links. */
  useEffect(() => {
    if (initialSession !== null) return;

    const params = new URLSearchParams(window.location.search);
    const pResetToken = params.get("resetToken");
    const pEnter = params.get("enter");
    const pPortal = params.get("portal");
    const pLinkGoogle = params.get("linkGoogle");
    const deepLink =
      pEnter === "1" || pEnter === "true" || pPortal === "enter"
        ? "enter"
        : params.get("dashboard") === "1"
          ? "workspace"
          : pPortal === "project"
            ? "project-portal"
            : null;

    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d: SessionPayload) => {
        if (pResetToken) setResetToken(pResetToken);
        setSession(d);
        if (d.authenticated && d.user) {
          const target = resolveConsoleForRole(d.user.role);
          if (deepLink === "project-portal") {
            setGate("project-portal");
          } else if (target !== "none") {
            if (deepLink === "workspace" || (deepLink === "enter" && pLinkGoogle !== "1")) {
              setGate("workspace");
            }
          } else if (deepLink) {
            setScopedUser(d.user);
            setGate("enter");
          }
        } else if (deepLink) {
          setGate(deepLink === "project-portal" ? "project-portal" : "enter");
        }
      })
      .catch(() => {
        if (pResetToken) setResetToken(pResetToken);
        setSession({ authenticated: false });
        if (deepLink) setGate(deepLink === "project-portal" ? "project-portal" : "enter");
      });
  }, [initialSession]);

  /* Landing → Enter Platform (role-aware shortcut for live sessions) */
  const handleEnter = useCallback(() => {
    if (session === null) return; // session probe still in flight
    if (session.authenticated && session.user && resolveConsoleForRole(session.user.role) !== "none") {
      setGate("workspace");
    } else {
      setGate("enter");
    }
  }, [session]);

  /* Gateway login success */
  const handleAuthed = useCallback((user: VerifiedUser) => {
    setSession({ authenticated: true, user });
    if (resolveConsoleForRole(user.role) !== "none") {
      setScopedUser(null);
      setGate("workspace");
    } else {
      setScopedUser(user);
    }
  }, []);

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
    window.history.replaceState(null, "", "/?enter=1");
  }, []);

  /* Project Admin / Site Operations sign out → revoke session → return directly to site operations role screen */
  const handleProjectSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* cookie revocation is best-effort; local state is authoritative */
    }
    try {
      await fetch("/api/pu/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    setSession({ authenticated: false });
    setScopedUser(null);
    setSigningOut(false);
    setGate("project-portal");
    window.history.replaceState(null, "", "/?portal=project&stage=role");
    window.dispatchEvent(new PopStateEvent("popstate"));
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

  if (resetToken) {
    return (
      <ResetTokenModal
        token={resetToken}
        onDone={() => {
          setResetToken(null);
          window.history.replaceState(null, "", "/?enter=1");
          setGate("enter");
        }}
      />
    );
  }

  if (gate === "workspace") {
    if (session === null) {
      return (
        <div className="ep-root" aria-busy="true" aria-label="Restoring secure session">
          <PortalSplash label="Opening your role workspace…" />
        </div>
      );
    }
    if (session.authenticated && session.user) {
      if (session.user.mustChangePassword) {
        return (
          <ForceChangePasswordDialog
            userName={session.user.name}
            onCompleted={() => {
              setSession((prev) =>
                prev && prev.user
                  ? { ...prev, user: { ...prev.user, mustChangePassword: false } }
                  : prev
              );
            }}
          />
        );
      }
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
      if (BU_MANAGER_ROLES.has(role) && session.user.scope.businessUnit && session.user.scope.subsidiary) {
        return (
          <BmWorkspaceShell
            sessionUser={{
              id: session.user.id,
              name: session.user.name,
              email: session.user.employeeId,
              role: session.user.role,
              roleLabel: session.user.roleLabel,
              businessUnit: {
                id: session.user.scope.businessUnit.id,
                code: session.user.scope.businessUnit.code,
                name: session.user.scope.businessUnit.name,
                subsidiaryId: session.user.scope.subsidiary.id,
              },
              subsidiary: session.user.scope.subsidiary,
            }}
            onSignOut={() => void handleSignOut()}
          />
        );
      }
      if (BU_ADMIN_ROLES.has(role) && session.user.scope.businessUnit && session.user.scope.subsidiary) {
        return (
          <BaWorkspaceShell
            sessionUser={{
              id: session.user.id,
              name: session.user.name,
              email: session.user.employeeId,
              role: session.user.role,
              roleLabel: session.user.roleLabel,
              businessUnit: {
                id: session.user.scope.businessUnit.id,
                code: session.user.scope.businessUnit.code,
                name: session.user.scope.businessUnit.name,
                subsidiaryId: session.user.scope.subsidiary.id,
              },
              subsidiary: session.user.scope.subsidiary,
            }}
            onSignOut={() => void handleSignOut()}
          />
        );
      }
      if (PROJECT_ADMIN_ROLES.has(role)) {
        return (
          <ProjectAdminWorkspaceShell
            sessionUser={{
              id: session.user.id,
              name: session.user.name,
              email: session.user.employeeId,
              role: session.user.role,
              roleLabel: session.user.roleLabel,
              subsidiary: session.user.scope.subsidiary ?? null,
              businessUnit: session.user.scope.businessUnit ?? null,
              project: session.user.scope.project ?? null,
            }}
            onSignOut={handleProjectSignOut}
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
            onSignOut={handleProjectSignOut}
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
      enterLabel={session?.authenticated && session.user && resolveConsoleForRole(session.user.role) !== "none" ? "Open Workspace" : undefined}
    />
  );
}

