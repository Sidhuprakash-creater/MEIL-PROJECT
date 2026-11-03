"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   PROJECT USER PORTAL — root experience (mounted inside the main platform's
   single-route app gate). Pattern mirrors the portal project's page.tsx:

     AppProvider → loading splash → WelcomeScreen (org → project → role → login)
                 → AppShell + per-role dashboard / ModuleRouter

   Everything visual is scoped under `.pu-root` (see ./pu.css) so the portal's
   own liquid-glass design system never leaks into the main platform.
   ═══════════════════════════════════════════════════════════════════════════ */

import { ArrowLeft } from "lucide-react";
import { AppProvider, useApp } from "@/lib/pu/auth-context";
import { WelcomeScreen } from "@/components/pu/welcome/welcome-screen";
import { AppShell } from "@/components/pu/shell/app-shell";
import { SiteUserOverview } from "@/components/pu/dashboard/site-user-overview";
import { ProjectAdminWorkspaceShell } from "@/components/project-admin/shell";
import { HrDashboard } from "@/components/pu/dashboard/hr-dashboard";
import { EhsDashboard } from "@/components/pu/dashboard/ehs-dashboard";
import { ProcurementDashboard } from "@/components/pu/dashboard/procurement-dashboard";
import { CsrDashboard } from "@/components/pu/dashboard/csr-dashboard";
import { ComplianceDashboard } from "@/components/pu/dashboard/compliance-dashboard";
import { EsgAnalystDashboard } from "@/components/pu/dashboard/esg-analyst-dashboard";
import { FinanceDashboard } from "@/components/pu/dashboard/finance-dashboard";
import { ModuleRouter } from "@/components/pu/modules/module-router";
import { ErrorBoundary } from "@/components/pu/error-boundary";
import "./pu.css";

/* Per-role dashboard mapping — each role gets a UNIQUE dashboard
   with a distinct color theme, layout, and information focus. */
function getRoleDashboard(roleKey: string) {
  switch (roleKey) {
    case "PROJECT_USER":
      return <SiteUserOverview />;
    case "FINANCE_USER":
      return <FinanceDashboard />;
    case "HR_USER":
      return <HrDashboard />;
    case "EHS_USER":
      return <EhsDashboard />;
    case "PROCUREMENT_USER":
      return <ProcurementDashboard />;
    case "CSR_USER":
      return <CsrDashboard />;
    case "COMPLIANCE_USER":
      return <ComplianceDashboard />;
    case "ESG_ANALYST":
      return <EsgAnalystDashboard />;
    case "PROJECT_ADMIN":
      return <SiteUserOverview />;
    default:
      return <SiteUserOverview />;
  }
}

/* Floating gateway back-link — always reachable, styled with the portal's
   own glass so it reads as part of the experience, not an overlay. */
function ExitPortalButton({ onExit }: { onExit: () => void }) {
  return (
    <button
      type="button"
      className="pu-exit-btn glass-strong"
      onClick={onExit}
      aria-label="Exit Project User Portal — back to secure gateway"
      title="Back to gateway"
    >
      <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
      <span>Exit</span>
    </button>
  );
}

function PortalRoot({ onExit }: { onExit?: () => void }) {
  const { user, loading, activeModule, logout } = useApp();

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center">
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="orb animate-orb"
            style={{ width: 360, height: 360, top: "20%", left: "30%", background: "radial-gradient(circle, rgba(125,181,255,0.5), transparent 70%)" }}
          />
        </div>
        <div className="glass-strong relative z-10 flex items-center gap-3 rounded-2xl px-6 py-4">
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500" />
          <span className="text-sm font-medium text-slate-600">Loading MEIL ESG…</span>
        </div>
      </div>
    );
  }

  if (!user) return <WelcomeScreen />;

  const roleKey = user?.roles?.[0]?.key ?? "";

  if (roleKey === "PROJECT_ADMIN") {
    return (
      <ProjectAdminWorkspaceShell
        sessionUser={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: "PROJECT_ADMIN",
          roleLabel: "Project Admin",
          subsidiary: null,
          businessUnit: null,
          project: null,
        }}
        onSignOut={() => void logout()}
      />
    );
  }


  return (
    <AppShell>
      <ErrorBoundary label={activeModule}>
        {activeModule === "overview" ? getRoleDashboard(roleKey) : <ModuleRouter />}
      </ErrorBoundary>
    </AppShell>
  );
}

export default function PuApp({ onExit }: { onExit?: () => void }) {
  return (
    <div className="pu-root">
      <AppProvider>
        <ErrorBoundary label="root">
          <PortalRoot onExit={onExit} />
        </ErrorBoundary>
      </AppProvider>
    </div>
  );
}
