"use client";

import * as React from "react";
import {
  ChevronDown, ChevronsLeft, ChevronsRight, Command, LogOut, Menu, Search, Settings, Sparkles, X,
} from "lucide-react";
import { LoaderRoleProvider, MeilLoader } from "@/components/shared/meil-loader";
import {
  BellIcon, DatabaseIcon, FileCheckIcon, FilesIcon, GearIcon, GaugeIcon,
  HourglassIcon, MegaphoneIcon, PeopleIcon, ProjectsIcon, PulseIcon, ReportChartIcon,
  ShieldIcon, TaskCheckIcon, TrendIcon,
} from "@/components/workspace/premium-icons";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, StatusBadge } from "@/components/workspace/ui";
import { BA_VIEWS, type BaViewComponent } from "@/components/ba/view-registry";
import { CalculatorDock } from "@/components/shared/calculator/calculator-dock";
import { REPORTING_YEARS, VIEW_META, VIEW_ORDER, useBaWorkspace } from "@/lib/ba/store";
import type { BaViewId, SaNotification } from "@/lib/ba/types";
import { apiGet, timeAgo, useBaApi } from "@/lib/ba/client";

/* Map view ids → premium iOS icon set. */
export const BA_VIEW_ICONS: Record<BaViewId, React.ComponentType<{ className?: string }>> = {
  dashboard: GaugeIcon,
  notifications: BellIcon,
  users: PeopleIcon,
  roles: ShieldIcon,
  projects: ProjectsIcon,
  timelines: HourglassIcon,
  submissions: FilesIcon,
  monitoring: PulseIcon,
  evidence: FileCheckIcon,
  tasks: TaskCheckIcon,
  comms: MegaphoneIcon,
  validation: DatabaseIcon,
  esg: ReportChartIcon,
  analytics: TrendIcon,
  activity: PulseIcon,
  settings: GearIcon,
};

/* ───────────────────────── Verified session user ────────────────────────
   The AppGate (/) resolves the signed-in identity from /api/auth/session
   and provides it here — including the assigned BU + subsidiary context. */

export interface BaSessionUser {
  id: string;
  name: string;
  email: string; // employee ID or email used at sign-in
  role: string;
  roleLabel: string;
  businessUnit: { id: string; code: string; name: string; subsidiaryId: string };
  subsidiary: { id: string; code: string; name: string };
}

const SessionUserContext = React.createContext<BaSessionUser | null>(null);
const SignOutContext = React.createContext<() => void>(() => undefined);

export function useBaSessionUser(): BaSessionUser {
  const user = React.useContext(SessionUserContext);
  if (!user) {
    return {
      id: "demo", name: "BU Admin", email: "BU-3002", role: "BU_ADMIN", roleLabel: "BU Admin",
      businessUnit: { id: "", code: "BU", name: "Assigned BU", subsidiaryId: "" },
      subsidiary: { id: "", code: "SUB", name: "Assigned Subsidiary" },
    };
  }
  return user;
}

export function useBaSignOut(): () => void {
  return React.useContext(SignOutContext);
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : name;
}

/* ───────────────────────────── Sidebar ───────────────────────────── */

function NavItem({ view, collapsed }: { view: BaViewId; collapsed: boolean }) {
  const { view: active, navigate } = useBaWorkspace();
  const Icon = BA_VIEW_ICONS[view];
  const meta = VIEW_META[view];
  const isActive = active === view;
  const btn = (
    <button
      onClick={() => navigate(view)}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200",
        isActive ? "nav-ba-active" : "text-[color:var(--ink-soft)] hover:border-white/70 hover:bg-white/60",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon className={cn("icon-tint h-[18px] w-[18px] shrink-0", isActive ? "" : "text-[color:var(--ink-faint)] group-hover:text-[color:var(--ink-soft)]")} />
      {!collapsed && <span className="truncate">{meta.title}</span>}
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
  const { navigate } = useBaWorkspace();
  const user = useBaSessionUser();
  return (
    <div className={cn("flex h-full flex-col", collapsed ? "px-2.5 py-4" : "px-3.5 py-4")}>
      {/* Brand — sky-blue gradient splash */}
      <button onClick={() => navigate("dashboard")} className={cn("mb-4 flex items-center gap-3 rounded-2xl px-1.5 py-1 text-left", collapsed && "justify-center px-0")}>
        <span className="glass-strong glass-sheen flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-md">
          <span className="bg-gradient-to-br from-[#348BE8] to-[#62B8FF] bg-clip-text text-[15px] font-extrabold tracking-tight text-transparent">ME</span>
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate text-[14.5px] font-bold leading-tight tracking-tight text-[color:var(--ink)]">MEIL ESG Platform</span>
            <span className="block truncate text-[11px] font-medium text-[color:var(--ink-faint)]">BU Admin Workspace</span>
          </span>
        )}
      </button>

      {/* BU Admin identity card */}
      {!collapsed && (
        <div className="glass-subtle glass-sheen mb-4 rounded-2xl p-2.5">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} size={34} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{user.name}</div>
              <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{user.roleLabel}</div>
            </div>
            <span className="flex h-2 w-2 shrink-0 rounded-full bg-[#348BE8] pulse-dot" aria-label="Online" />
          </div>
          <div className="mt-2 rounded-xl bg-[rgba(52,139,232,0.08)] px-2 py-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--ba-sky-deep)]">BU scope</div>
            <div className="truncate text-[11px] font-semibold text-[color:var(--ink-soft)]">{user.businessUnit.name}</div>
            <div className="mt-0.5 truncate text-[10px] text-[color:var(--ink-faint)]">under {user.subsidiary.name}</div>
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

      {/* Footer note — operational command center */}
      {!collapsed && (
        <div className="glass-subtle mt-3 rounded-2xl p-3">
          <div className="flex items-center gap-2 text-[11.5px] font-semibold text-[color:var(--ink-soft)]">
            <Sparkles className="h-3.5 w-3.5 text-[color:var(--ba-purple)]" /> Operational scope
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--ink-faint)]">
            Every record you see is filtered to {user.businessUnit.name}. Approvals belong to the BU Manager.
          </p>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── Live sync indicator ───────────────────────────── */

function LiveSyncBadge() {
  const { lastSyncedAt, setCommandOpen } = useBaWorkspace();
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
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#348BE8] opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#348BE8]" />
      </span>
      <span className="text-[11.5px] font-semibold text-[color:var(--ink-soft)]">Live</span>
      <span className="text-[11px] tabular text-[color:var(--ink-faint)]">{secs === null ? "syncing…" : secs < 60 ? `${secs}s ago` : timeAgo(lastSyncedAt)}</span>
    </button>
  );
}

/* ───────────────────────────── Top bar ───────────────────────────── */

function NotificationBell() {
  const { data } = useBaApi<{ notifications: SaNotification[]; unread: number }>("/api/ba/notifications?limit=6&filter=all");
  const { navigate, setUnreadCount, unreadCount } = useBaWorkspace();
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
          <button className="text-xs font-medium text-[color:var(--ba-sky-deep)] hover:underline" onClick={() => navigate("notifications")}>
            View all
          </button>
        </div>
        <div className="nice-scroll max-h-[320px] space-y-1 overflow-y-auto">
          {(data?.notifications ?? []).length === 0 && <div className="px-3 py-6 text-center text-sm text-[color:var(--ink-faint)]">No notifications</div>}
          {(data?.notifications ?? []).map((n) => (
            <button
              key={n.id}
              className={cn("flex w-full items-start gap-2.5 rounded-2xl p-2.5 text-left transition-colors hover:bg-white/70", !n.read && "bg-[rgba(52,139,232,0.06)]")}
              onClick={() => navigate("notifications", { openId: n.id })}
            >
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.severity === "CRITICAL" ? "bg-[#c34a4a]" : n.severity === "WARNING" ? "bg-[#c57926]" : n.severity === "SUCCESS" ? "bg-[#238653]" : "bg-[#348BE8]", !n.read && "pulse-dot")} />
              <span className="min-w-0">
                <span className={cn("block truncate text-[13px]", n.read ? "text-[color:var(--ink-soft)]" : "font-semibold text-[color:var(--ink)]")}>{n.title}</span>
                <span className="block truncate text-[11.5px] text-[color:var(--ink-faint)]">{n.body}</span>
                <span className="mt-0.5 block text-[10.5px] text-[color:var(--ink-faint)]">{timeAgo(n.createdAt)}{n.origin === "group" && " · broadcast"}</span>
              </span>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GlobalSearch({ trigger }: { trigger: React.ReactNode }) {
  const { commandOpen, setCommandOpen, navigate } = useBaWorkspace();
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
              const Icon = BA_VIEW_ICONS[v];
              return (
                <CommandItem key={v} value={VIEW_META[v].title} onSelect={() => navigate(v)}>
                  <Icon className="mr-2 h-4 w-4 text-[color:var(--ba-sky-deep)]" />
                  {VIEW_META[v].title}
                  <span className="ml-auto text-xs text-[color:var(--ink-faint)]">{VIEW_META[v].group}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
          <CommandGroup heading="Quick actions">
            <CommandItem onSelect={() => navigate("users", { create: Date.now() })}>
              <PeopleIcon className="mr-2 h-4 w-4 text-[color:var(--ba-sky-deep)]" /> Invite a BU user
            </CommandItem>
            <CommandItem onSelect={() => navigate("timelines", { create: Date.now() })}>
              <HourglassIcon className="mr-2 h-4 w-4 text-[color:var(--ba-sky-deep)]" /> Assign a project deadline
            </CommandItem>
            <CommandItem onSelect={() => navigate("monitoring", { statusFilter: "submitted" })}>
              <PulseIcon className="mr-2 h-4 w-4 text-[color:var(--ba-sky-deep)]" /> View submitted reports
            </CommandItem>
            <CommandItem onSelect={() => navigate("esg", { prepare: Date.now() })}>
              <ReportChartIcon className="mr-2 h-4 w-4 text-[color:var(--ba-sky-deep)]" /> Prepare BU reporting package
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

function TopBar() {
  const { view, params, reportingYear, setReportingYear, toggleSidebar, sidebarCollapsed, setMobileNav } = useBaWorkspace();
  const user = useBaSessionUser();
  const onSignOut = React.useContext(SignOutContext);
  const meta = VIEW_META[view];
  const detailMode = !!params.detailId;

  return (
    <header className="glass-chrome glass-sheen z-30 mx-3 flex shrink-0 items-center gap-2 rounded-3xl px-3 py-2.5 sm:mx-4 sm:gap-3 sm:px-4">
      <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-2xl hover:bg-white/70 lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" className="hidden h-10 w-10 shrink-0 rounded-2xl hover:bg-white/70 lg:flex" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {sidebarCollapsed ? <ChevronsRight className="h-4.5 w-4.5" /> : <ChevronsLeft className="h-4.5 w-4.5" />}
      </Button>

      {/* Breadcrumb: subsidiary / BU / view group */}
      <div className="hidden min-w-0 flex-col md:flex">
        <div className="flex max-w-[420px] items-center gap-1.5 overflow-hidden whitespace-nowrap text-[11px] font-medium text-[color:var(--ink-faint)]">
          <span className="truncate">{user.subsidiary.name}</span>
          <span className="shrink-0">/</span>
          <span className="truncate text-[color:var(--ink-soft)]">{user.businessUnit.name}</span>
          <span className="shrink-0">/</span>
          <span className="truncate">{meta.group}</span>
          {detailMode && (
            <>
              <span className="shrink-0">/</span>
              <span className="shrink-0 text-[color:var(--ba-sky-deep)]">Detail</span>
            </>
          )}
        </div>
        <div className="truncate text-[14px] font-semibold text-[color:var(--ink)]">{meta.title}</div>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
        {/* BU scope chip — visible only at 2xl (redundant with profile menu otherwise) */}
        <div className="glass-subtle hidden h-10 items-center gap-2 rounded-2xl px-3 2xl:flex" title="Your session is scoped to this BU">
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--ba-sky-deep)]" aria-hidden="true" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">BU</span>
          <span className="max-w-[150px] truncate text-[12.5px] font-semibold text-[color:var(--ink)]">{user.businessUnit.name}</span>
          <span className="rounded-lg bg-[rgba(52,139,232,0.1)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--ba-sky-deep)]">{user.businessUnit.code}</span>
        </div>

        <LiveSyncBadge />

        {/* Reporting period */}
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
            <DropdownMenuLabel className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-widest text-[color:var(--ink-faint)]">BU Admin</DropdownMenuLabel>
            <div className="flex items-center gap-3 px-2 py-2">
              <Avatar name={user.name} size={40} />
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold text-[color:var(--ink)]">{user.name}</div>
                <div className="truncate text-[11.5px] text-[color:var(--ink-faint)]">{user.email}</div>
                <div className="mt-1"><StatusBadge status="ACTIVE" /></div>
              </div>
            </div>
            <div className="mx-2 mb-1 rounded-xl bg-[rgba(52,139,232,0.08)] px-2.5 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">Assigned business unit</div>
              <div className="truncate text-[12px] font-semibold text-[color:var(--ink)]">{user.businessUnit.name} · {user.businessUnit.code}</div>
              <div className="mt-1 truncate text-[11px] text-[color:var(--ink-faint)]">under {user.subsidiary.name}</div>
            </div>
            <DropdownMenuSeparator className="bg-[rgba(125,177,216,0.3)]" />
            <DropdownMenuItem className="rounded-xl text-[13px]" onClick={() => useBaWorkspace.getState().navigate("settings")}>
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-xl text-[13px]" onClick={() => useBaWorkspace.getState().navigate("activity")}>
              <FileCheckIcon className="mr-2 h-4 w-4" /> My audit trail
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

/* ───────────────────────────── Workspace shell ─────────────────────────────
   App-frame layout: shell chrome never scrolls — ONLY <main> scrolls. */

export function BaWorkspaceShell({
  sessionUser,
  onSignOut,
}: {
  sessionUser: BaSessionUser;
  onSignOut?: () => void;
}) {
  const { view, sidebarCollapsed, mobileNavOpen, setMobileNav, commandOpen, setCommandOpen } = useBaWorkspace();

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

  const ViewComponent = BA_VIEWS[view] as BaViewComponent;

  return (
    <SessionUserContext.Provider value={sessionUser}>
      <SignOutContext.Provider value={onSignOut ?? (() => undefined)}>
        <LoaderRoleProvider role="BU_ADMIN">
        <div className="liquid-sky-ba relative h-dvh overflow-hidden">
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

            {/* Main column — top bar fixed; only <main> scrolls */}
            <div className="flex h-full min-w-0 flex-1 flex-col pb-4 pt-3">
              <TopBar />
              <main
                className="nice-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-4 sm:px-4"
                id="main-content"
              >
                <React.Suspense
                  fallback={
                    <div className="glass-ba glass-sheen flex h-64 items-center justify-center rounded-3xl">
                      <MeilLoader size={48} role="BU_ADMIN" label="Loading module…" />
                    </div>
                  }
                >
                  <ViewComponent />
                </React.Suspense>
              </main>
            </div>
          </div>

          {/* Calculator dock — right-edge vertical rail, available to every role */}
          <CalculatorDock />
        </div>
        </LoaderRoleProvider>
      </SignOutContext.Provider>
    </SessionUserContext.Provider>
  );
}

/* Re-export for the AppGate's dynamic import */
export { Command as CommandGlyph };
void apiGet;
