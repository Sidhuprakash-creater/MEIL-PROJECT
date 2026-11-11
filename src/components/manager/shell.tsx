"use client";

import * as React from "react";
import {
  ChevronDown, ChevronsLeft, ChevronsRight, Command, LogOut, Menu, Search, ShieldCheck, X,
} from "lucide-react";
import { LoaderRoleProvider, MeilLoader } from "@/components/shared/meil-loader";
import {
  AlarmAlertIcon, BellIcon, CheckSealIcon, FileCheckIcon, GaugeIcon, GearIcon,
  HourglassIcon, ProjectsIcon, PulseIcon, TrendIcon, UnitsIcon, WorkflowIcon,
} from "@/components/workspace/premium-icons";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, StatusBadge } from "@/components/workspace/ui";
import { SM_VIEWS, type SmViewComponent } from "@/components/manager/view-registry";
import { REPORTING_YEARS, VIEW_META, VIEW_ORDER, useSmWorkspace } from "@/lib/sm/store";
import type { SmViewId, SaNotification } from "@/lib/sm/types";
import { timeAgo, useSmApi } from "@/lib/sm/client";

/* Map view ids to the premium iOS icon set — one visual language across
   sidebar, command palette and view headers (SF Symbols style). */
export const SM_VIEW_ICONS: Record<SmViewId, React.ComponentType<{ className?: string }>> = {
  dashboard: GaugeIcon,
  notifications: BellIcon,
  queue: CheckSealIcon,
  "reports-bu": UnitsIcon,
  "reports-project": ProjectsIcon,
  evidence: FileCheckIcon,
  corrections: WorkflowIcon,
  deadlines: HourglassIcon,
  analytics: TrendIcon,
  activity: PulseIcon,
  profile: GearIcon,
};

/* ───────────────────────── Verified session user ────────────────────────
   The AppGate (/) resolves the signed-in identity from /api/auth/session
   and provides it here — including the assigned subsidiary context. */

export interface SmSessionUser {
  id: string;
  name: string;
  email: string; // employee ID or email used at sign-in
  role: string;
  roleLabel: string;
  subsidiary: { id: string; code: string; name: string };
}

const SessionUserContext = React.createContext<SmSessionUser | null>(null);
const SignOutContext = React.createContext<() => void>(() => undefined);

export function useSmSessionUser(): SmSessionUser {
  const user = React.useContext(SessionUserContext);
  if (!user) {
    // Defensive fallback (should never render without the gate providing one).
    return { id: "demo", name: "Subsidiary Manager", email: "SUB-1001", role: "SUBSIDIARY_MANAGER", roleLabel: "Subsidiary Manager", subsidiary: { id: "", code: "SUB", name: "Assigned Subsidiary" } };
  }
  return user;
}

/** Sign-out callback provided by the AppGate through the shell. */
export function useSmSignOut(): () => void {
  return React.useContext(SignOutContext);
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : name;
}

const NAV_LABELS: Record<SmViewId, string> = {
  dashboard: "Dashboard",
  notifications: "Notifications",
  queue: "Review Queue",
  "reports-bu": "BU Reports",
  "reports-project": "Business Unit Reports",
  evidence: "Evidence Review",
  corrections: "Corrections",
  deadlines: "Tasks & Deadlines",
  analytics: "ESG Analytics",
  activity: "Activity & History",
  profile: "Profile",
};

/* ───────────────────────────── Sidebar ───────────────────────────── */

function NavItem({ view, collapsed }: { view: SmViewId; collapsed: boolean }) {
  const { view: active, navigate, queueCount, buFinalReportsCount, projectReportsCount } = useSmWorkspace();
  const Icon = SM_VIEW_ICONS[view];
  const meta = VIEW_META[view];
  const isActive = active === view;
  const showBadge = view === "queue" && queueCount > 0;
  /* "BU Reports" badge — final consolidated reports the BUs of this
     subsidiary sent up and that still await the manager's decision. */
  const showBuBadge = view === "reports-bu" && buFinalReportsCount > 0;
  /* "Business Unit Reports" badge — project-level reports the BU Manager
     signed off that now await this manager's approval. */
  const showProjectBadge = view === "reports-project" && projectReportsCount > 0;
  const btn = (
    <button
      onClick={() => navigate(view)}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200",
        isActive ? "nav-active" : "text-[color:var(--ink-soft)] hover:border-white/70 hover:bg-white/60",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-[color:var(--esg-blue)]" : "text-[color:var(--ink-faint)] group-hover:text-[color:var(--ink-soft)]")} />
      {!collapsed && <span className="truncate">{NAV_LABELS[view]}</span>}
      {!collapsed && showBadge && (
        <span className="ml-auto rounded-full bg-[rgba(58,123,255,0.14)] px-2 py-0.5 text-[10.5px] font-bold tabular text-[color:var(--esg-blue)]">{queueCount}</span>
      )}
      {!collapsed && showBuBadge && (
        <span
          className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#315CFF] px-1.5 text-[10px] font-extrabold tabular text-white shadow-md shadow-[rgba(49,92,255,0.35)] ring-2 ring-white/60"
          title={`${buFinalReportsCount} BU final report${buFinalReportsCount === 1 ? "" : "s"} awaiting your review`}
        >
          {buFinalReportsCount}
        </span>
      )}
      {!collapsed && showProjectBadge && (
        <span
          className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#315CFF] px-1.5 text-[10px] font-extrabold tabular text-white shadow-md shadow-[rgba(49,92,255,0.35)] ring-2 ring-white/60"
          title={`${projectReportsCount} project report${projectReportsCount === 1 ? "" : "s"} awaiting your approval`}
        >
          {projectReportsCount}
        </span>
      )}
      {collapsed && showBadge && (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[color:var(--esg-blue)] ring-2 ring-white/80" />
      )}
      {collapsed && (showBuBadge || showProjectBadge) && (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#315CFF] ring-2 ring-white/80" />
      )}
    </button>
  );
  if (collapsed) {
    return (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side="right" className="rounded-xl border-white/70 bg-white/95 font-medium text-[color:var(--ink)] shadow-lg backdrop-blur">
          {meta.title}
        </TooltipContent>
      </Tooltip>
    );
  }
  return btn;
}

function SidebarContent({ collapsed }: { collapsed: boolean }) {
  const { navigate } = useSmWorkspace();
  const user = useSmSessionUser();
  return (
    <div className={cn("flex h-full flex-col", collapsed ? "px-2.5 py-4" : "px-3.5 py-4")}>
      {/* Brand */}
      <button onClick={() => navigate("dashboard")} className={cn("mb-4 flex items-center gap-3 rounded-2xl px-1.5 py-1 text-left", collapsed && "justify-center px-0")}>
        <span className="glass-strong glass-sheen flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-md">
          <span className="bg-gradient-to-br from-[#3a7bff] to-[#6a5bff] bg-clip-text text-[15px] font-extrabold tracking-tight text-transparent">ME</span>
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate text-[14.5px] font-bold leading-tight tracking-tight text-[color:var(--ink)]">MEIL ESG Platform</span>
            <span className="block truncate text-[11px] font-medium text-[color:var(--ink-faint)]">Subsidiary Manager Workspace</span>
          </span>
        )}
      </button>

      {/* Manager identity card */}
      {!collapsed && (
        <div className="glass-subtle glass-sheen mb-4 rounded-2xl p-2.5">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} size={34} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{user.name}</div>
              <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{user.roleLabel}</div>
            </div>
            <span className="flex h-2 w-2 shrink-0 rounded-full bg-[#238653] pulse-dot" aria-label="Online" />
          </div>
          <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-[rgba(58,123,255,0.08)] px-2 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--esg-blue)]">Scope</span>
            <span className="truncate text-[11px] font-semibold text-[color:var(--ink-soft)]">{user.subsidiary.name}</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="nice-scroll flex-1 space-y-4 overflow-y-auto pb-2" aria-label="Primary">
        {VIEW_ORDER.map((group) => (
          <div key={group.group}>
            {!collapsed && (
              <div className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-widest text-[color:var(--ink-faint)]">{group.group}</div>
            )}
            <div className="space-y-1">
              {group.views.map((v) => (
                <NavItem key={v} view={v} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer note */}
      {!collapsed && (
        <div className="glass-subtle mt-3 rounded-2xl p-3">
          <div className="flex items-center gap-2 text-[11.5px] font-semibold text-[color:var(--ink-soft)]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#1d6b44]" /> Review authority
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--ink-faint)]">
            You verify and decide on {user.subsidiary.name} reports. Organization, users and timelines stay with the Subsidiary Admin.
          </p>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── Live sync indicator ───────────────────────────── */

function LiveSyncBadge() {
  const { lastSyncedAt, setCommandOpen } = useSmWorkspace();
  const [, force] = React.useState(0);
  React.useEffect(() => {
    const t = window.setInterval(() => force((n) => n + 1), 5000);
    return () => window.clearInterval(t);
  }, []);
  const secs = lastSyncedAt ? Math.max(0, Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 1000)) : null;
  return (
    <button
      className="glass-subtle hidden h-10 items-center gap-2 rounded-2xl px-3 transition-colors hover:bg-white/75 xl:flex"
      onClick={() => setCommandOpen(true)}
      aria-label={`Live sync active, last synced ${secs ?? "—"} seconds ago`}
      title="Data syncs automatically every 15 seconds"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#238653] opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#238653]" />
      </span>
      <span className="text-[11.5px] font-semibold text-[color:var(--ink-soft)]">Live</span>
      <span className="text-[11px] tabular text-[color:var(--ink-faint)]">{secs === null ? "syncing…" : secs < 60 ? `${secs}s ago` : timeAgo(lastSyncedAt)}</span>
    </button>
  );
}

/* ───────────────────────────── Top bar ───────────────────────────── */

function NotificationBell() {
  const { data } = useSmApi<{ notifications: SaNotification[]; unread: number }>("/api/sm/notifications?limit=6&filter=all");
  const { navigate, setUnreadCount, unreadCount } = useSmWorkspace();
  const unread = data?.unread ?? 0;
  React.useEffect(() => {
    setUnreadCount(unread);
  }, [unread, setUnreadCount]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="glass-subtle relative flex h-10 w-10 items-center justify-center rounded-2xl transition-all hover:bg-white/75" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
          <BellIcon className="h-[18px] w-[18px] text-[color:var(--ink-soft)]" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c34a4a] px-1 text-[10px] font-bold text-white shadow-md ring-2 ring-white/80">
              {unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass-strong w-[360px] rounded-3xl border-white/80 p-2">
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <span className="text-[13px] font-semibold text-[color:var(--ink)]">Notifications</span>
          <button className="text-xs font-medium text-[color:var(--esg-blue)] hover:underline" onClick={() => navigate("notifications")}>
            View all
          </button>
        </div>
        <div className="nice-scroll max-h-[320px] space-y-1 overflow-y-auto">
          {(data?.notifications ?? []).length === 0 && <div className="px-3 py-6 text-center text-sm text-[color:var(--ink-faint)]">No notifications</div>}
          {(data?.notifications ?? []).map((n) => (
            <button
              key={n.id}
              className={cn("flex w-full items-start gap-2.5 rounded-2xl p-2.5 text-left transition-colors hover:bg-white/70", !n.read && "bg-[rgba(58,123,255,0.06)]")}
              onClick={() => navigate("notifications", { openId: n.id })}
            >
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.severity === "CRITICAL" ? "bg-[#c34a4a]" : n.severity === "WARNING" ? "bg-[#c57926]" : n.severity === "SUCCESS" ? "bg-[#238653]" : "bg-[#3a7bff]", !n.read && "pulse-dot")} />
              <span className="min-w-0">
                <span className={cn("block truncate text-[13px]", n.read ? "text-[color:var(--ink-soft)]" : "font-semibold text-[color:var(--ink)]")}>{n.title}</span>
                <span className="block truncate text-[11.5px] text-[color:var(--ink-faint)]">{n.body}</span>
                <span className="mt-0.5 block text-[10.5px] text-[color:var(--ink-faint)]">{timeAgo(n.createdAt)}{n.origin === "group" && " · from Group Admin"}</span>
              </span>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GlobalSearch({ trigger }: { trigger: React.ReactNode }) {
  const { commandOpen, setCommandOpen, navigate } = useSmWorkspace();
  const open = React.useCallback(() => setCommandOpen(true), [setCommandOpen]);
  const triggerWithClick =
    React.isValidElement<{ onClick?: () => void }>(trigger) ? React.cloneElement(trigger, { onClick: open }) : trigger;
  return (
    <>
      {triggerWithClick}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Search modules and actions…" className="text-sm" />
        <CommandList className="nice-scroll">
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Modules">
            {VIEW_ORDER.flatMap((g) => g.views).map((v) => {
              const Icon = SM_VIEW_ICONS[v];
              return (
                <CommandItem key={v} value={VIEW_META[v].title} onSelect={() => navigate(v)}>
                  <Icon className="mr-2 h-4 w-4 text-[color:var(--esg-blue)]" />
                  {VIEW_META[v].title}
                  <span className="ml-auto text-xs text-[color:var(--ink-faint)]">{VIEW_META[v].group}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
          <CommandGroup heading="Quick actions">
            <CommandItem onSelect={() => navigate("queue")}>
              <CheckSealIcon className="mr-2 h-4 w-4 text-[color:var(--esg-blue)]" /> Open the Review Queue
            </CommandItem>
            <CommandItem onSelect={() => navigate("queue", { statusFilter: "overdue" })}>
              <AlarmAlertIcon className="mr-2 h-4 w-4 text-[#c34a4a]" /> Overdue review actions
            </CommandItem>
            <CommandItem onSelect={() => navigate("corrections")}>
              <WorkflowIcon className="mr-2 h-4 w-4 text-[#c57926]" /> Corrections &amp; rejections
            </CommandItem>
            <CommandItem onSelect={() => navigate("deadlines")}>
              <HourglassIcon className="mr-2 h-4 w-4 text-[#c57926]" /> Review deadlines
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

function TopBar() {
  const { view, params, reportingYear, setReportingYear, toggleSidebar, sidebarCollapsed, setMobileNav } = useSmWorkspace();
  const user = useSmSessionUser();
  const onSignOut = React.useContext(SignOutContext);
  const meta = VIEW_META[view];

  return (
    <header className="glass-chrome glass-sheen z-30 mx-3 flex shrink-0 items-center gap-2 rounded-3xl px-3 py-2.5 sm:mx-4 sm:gap-3 sm:px-4">
      <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-2xl hover:bg-white/70 lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" className="hidden h-10 w-10 shrink-0 rounded-2xl hover:bg-white/70 lg:flex" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {sidebarCollapsed ? <ChevronsRight className="h-4.5 w-4.5" /> : <ChevronsLeft className="h-4.5 w-4.5" />}
      </Button>

      {/* Breadcrumbs with subsidiary context */}
      <div className="hidden min-w-0 flex-col md:flex">
        <div className="flex max-w-[280px] items-center gap-1.5 overflow-hidden whitespace-nowrap text-[11px] font-medium text-[color:var(--ink-faint)]">
          <span className="truncate">{user.subsidiary.name}</span>
          <span className="shrink-0">/</span>
          <span className="truncate">{meta.group}</span>
        </div>
        <div className="truncate text-[14px] font-semibold text-[color:var(--ink)]">{meta.title}</div>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
        {/* Assigned subsidiary scope chip */}
        <div className="glass-subtle hidden h-10 items-center gap-2 rounded-2xl px-3 2xl:flex" title="Your session is scoped to this subsidiary">
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--esg-blue)]" aria-hidden="true" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Scope</span>
          <span className="max-w-[150px] truncate text-[12.5px] font-semibold text-[color:var(--ink)]">{user.subsidiary.name}</span>
          <span className="rounded-lg bg-[rgba(58,123,255,0.1)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--esg-blue)]">{user.subsidiary.code}</span>
        </div>

        <LiveSyncBadge />

        {/* Reporting year */}
        <div className="glass-subtle hidden items-center rounded-2xl border-white/60 sm:flex">
          <span className="pl-3 pr-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ink-faint)]">Period</span>
          <Select value={reportingYear} onValueChange={setReportingYear}>
            <SelectTrigger className="h-9 w-[126px] rounded-2xl border-0 bg-transparent text-[13px] font-semibold text-[color:var(--ink)] shadow-none focus:ring-0" aria-label="Reporting year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              {REPORTING_YEARS.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <GlobalSearch trigger={
          <button className="glass-subtle hidden h-10 items-center gap-2 rounded-2xl px-3 text-[13px] text-[color:var(--ink-faint)] transition-colors hover:bg-white/75 md:flex" aria-label="Search (command palette)">
            <Search className="h-4 w-4" />
            <span>Search…</span>
            <kbd className="ml-2 hidden rounded-lg border border-[rgba(125,177,216,0.4)] bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--ink-soft)] xl:inline">⌘K</kbd>
          </button>
        } />

        <NotificationBell />

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="glass-subtle flex h-10 items-center gap-2 rounded-2xl pl-1.5 pr-2.5 transition-colors hover:bg-white/75" aria-label="Profile menu">
              <Avatar name={user.name} size={30} />
              <span className="hidden text-[13px] font-semibold text-[color:var(--ink)] lg:inline">{shortName(user.name)}</span>
              <ChevronDown className="hidden h-3.5 w-3.5 text-[color:var(--ink-faint)] lg:inline" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass-strong w-64 rounded-3xl border-white/80 p-2">
            <DropdownMenuLabel className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-widest text-[color:var(--ink-faint)]">Subsidiary Manager</DropdownMenuLabel>
            <div className="flex items-center gap-3 px-2 py-2">
              <Avatar name={user.name} size={40} />
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold text-[color:var(--ink)]">{user.name}</div>
                <div className="truncate text-[11.5px] text-[color:var(--ink-faint)]">{user.email}</div>
                <div className="mt-1"><StatusBadge status="ACTIVE" /></div>
              </div>
            </div>
            <div className="mx-2 mb-1 rounded-xl bg-[rgba(58,123,255,0.07)] px-2.5 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Assigned subsidiary</div>
              <div className="truncate text-[12px] font-semibold text-[color:var(--ink)]">{user.subsidiary.name} · {user.subsidiary.code}</div>
            </div>
            <DropdownMenuSeparator className="bg-[rgba(125,177,216,0.3)]" />
            <DropdownMenuItem className="rounded-xl text-[13px]" onClick={() => useSmWorkspace.getState().navigate("profile")}>
              <GearIcon className="mr-2 h-4 w-4" /> Profile &amp; preferences
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-xl text-[13px]" onClick={() => useSmWorkspace.getState().navigate("activity")}>
              <FileCheckIcon className="mr-2 h-4 w-4" /> My decision trail
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[rgba(125,177,216,0.3)]" />
            <DropdownMenuItem
              className="rounded-xl text-[13px] text-[#a53b3b] data-[highlighted]:bg-[rgba(195,74,74,0.08)]"
              onClick={onSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

/* ───────────────────────────── Workspace shell ───────────────────────────── */

export function SmWorkspaceShell({
  sessionUser,
  onSignOut,
}: {
  sessionUser: SmSessionUser;
  onSignOut?: () => void;
}) {
  const { view, sidebarCollapsed, mobileNavOpen, setMobileNav, commandOpen, setCommandOpen, setQueueCount, setBuFinalReportsCount, setProjectReportsCount } = useSmWorkspace();

  /* ⌘K keyboard shortcut */
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen(!commandOpen);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [commandOpen, setCommandOpen]);

  /* Live queue counter for the sidebar badge (15s poll, visibility-aware). */
  const { data: pulse } = useSmApi<{ unread: number; queueCount: number; buFinalReportsCount: number; projectReportsCount: number }>("/api/sm/pulse", { pollMs: 15000 });
  React.useEffect(() => {
    if (pulse && typeof pulse.queueCount === "number") setQueueCount(pulse.queueCount);
    if (pulse && typeof pulse.buFinalReportsCount === "number") setBuFinalReportsCount(pulse.buFinalReportsCount);
    if (pulse && typeof pulse.projectReportsCount === "number") setProjectReportsCount(pulse.projectReportsCount);
  }, [pulse, setQueueCount, setBuFinalReportsCount, setProjectReportsCount]);

  const ViewComponent = SM_VIEWS[view] as SmViewComponent;

  /* App-frame layout: shell chrome never scrolls — ONLY <main> scrolls. */
  return (
    <SessionUserContext.Provider value={sessionUser}>
      <SignOutContext.Provider value={onSignOut ?? (() => undefined)}>
        <LoaderRoleProvider role="SUBSIDIARY_MANAGER">
        <div className="relative h-dvh overflow-hidden">
          {/* Ambient orbs are intentionally static — animating them would force every
              backdrop-filter glass surface to re-sample its backdrop every frame. */}
          <div className="liquid-sky" aria-hidden="true">
            <div className="orb left-[6%] top-[8%] h-[380px] w-[380px] bg-[rgba(120,180,255,0.34)]" />
            <div className="orb right-[4%] top-[22%] h-[320px] w-[320px] bg-[rgba(32,167,121,0.16)]" />
            <div className="orb bottom-[6%] left-[38%] h-[420px] w-[420px] bg-[rgba(86,196,187,0.18)]" />
          </div>
          <div className="liquid-grain" aria-hidden="true" />

          <div className="relative z-10 flex h-full">
            {/* Desktop sidebar */}
            <aside
              className={cn(
                "glass-chrome z-20 my-3 ml-3 hidden shrink-0 flex-col rounded-3xl transition-[width] duration-300 lg:flex",
                sidebarCollapsed ? "w-[84px]" : "w-[264px]"
              )}
              aria-label="Sidebar"
            >
              <SidebarContent collapsed={sidebarCollapsed} />
            </aside>

            {/* Mobile drawer */}
            <AnimatePresence>
              {mobileNavOpen && (
                <>
                  <motion.div
                    className="fixed inset-0 z-40 bg-[rgba(23,38,61,0.3)] backdrop-blur-sm lg:hidden"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => setMobileNav(false)}
                    aria-hidden="true"
                  />
                  <motion.aside
                    className="glass-chrome fixed left-0 top-0 z-50 flex h-full w-[290px] flex-col lg:hidden"
                    initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
                    transition={{ type: "spring", damping: 30, stiffness: 300 }}
                    aria-label="Mobile navigation"
                  >
                    <button className="absolute right-3 top-3.5 rounded-xl p-1.5 text-[color:var(--ink-faint)] hover:bg-white/70" onClick={() => setMobileNav(false)} aria-label="Close navigation">
                      <X className="h-5 w-5" />
                    </button>
                    <SidebarContent collapsed={false} />
                  </motion.aside>
                </>
              )}
            </AnimatePresence>

            {/* Main column — top bar is fixed chrome; only <main> scrolls */}
            <div className="flex h-full min-w-0 flex-1 flex-col pb-4 pt-3">
              <TopBar />
              <main
                className="nice-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-4 sm:px-4"
                id="main-content"
              >
                <React.Suspense
                  fallback={
                    <div className="glass glass-sheen flex h-64 items-center justify-center rounded-3xl">
                      <MeilLoader size={48} role="SUBSIDIARY_MANAGER" label="Loading module…" />
                    </div>
                  }
                >
                  <ViewComponent />
                </React.Suspense>
              </main>
            </div>
          </div>
        </div>
        </LoaderRoleProvider>
      </SignOutContext.Provider>
    </SessionUserContext.Provider>
  );
}

/* Re-export for the AppGate's dynamic import */
export { Command as CommandGlyph };
