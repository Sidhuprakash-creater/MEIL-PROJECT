"use client";

import * as React from "react";
import {
  Building2, ChevronDown, ChevronsLeft, ChevronsRight, Command, LogOut, Menu, Search, Settings, Sparkles, X,
} from "lucide-react";
import {
  AlarmAlertIcon, BellIcon, CheckSealIcon, DatabaseIcon, FileCheckIcon, FilesIcon, GaugeIcon, GearIcon,
  MegaphoneIcon, NetworkIcon, OrgIcon, PeopleIcon, ProjectsIcon, PulseIcon, ReportChartIcon, ShieldIcon,
  TaskCheckIcon, TrendIcon, UnitsIcon, UserPlusIcon,
} from "@/components/workspace/premium-icons";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, StatusBadge } from "@/components/workspace/ui";
import { LoaderRoleProvider, MeilLoader } from "@/components/shared/meil-loader";
import { getViewComponent, VIEW_COMPONENTS } from "@/components/workspace/view-registry";
import { CopilotFloating } from "@/components/copilot/floating";
import { CalculatorDock } from "@/components/shared/calculator/calculator-dock";
import { REPORTING_YEARS, VIEW_META, VIEW_ORDER, useWorkspace } from "@/lib/esg/store";
import type { ViewId } from "@/lib/esg/types";
import { useApi, timeAgo } from "@/lib/esg/client";
import type { Notification } from "@/lib/esg/types";

/* Map view ids to the premium iOS icon set — one visual language across
   sidebar, command palette and view headers. Bold 2px solid-color glyphs
   (SF Symbols style) stay crisp on glass at every size. */
export const VIEW_ICONS: Record<ViewId, React.ComponentType<{ className?: string }>> = {
  dashboard: GaugeIcon,
  notifications: BellIcon,
  hierarchy: NetworkIcon,
  subsidiaries: OrgIcon,
  units: UnitsIcon,
  projects: ProjectsIcon,
  users: PeopleIcon,
  roles: ShieldIcon,
  submissions: FilesIcon,
  approvals: CheckSealIcon,
  tasks: TaskCheckIcon,
  comms: MegaphoneIcon,
  brsr: ReportChartIcon,
  brsrChecklist: FileCheckIcon,
  consolidation: DatabaseIcon,
  analytics: TrendIcon,
  intelligence: Sparkles,
  activity: PulseIcon,
  audit: FileCheckIcon,
  settings: GearIcon,
};

const SUBSIDIARIES_LIGHT: { id: string; name: string }[] = [];

/* ───────────────────────── Verified session user ────────────────────────
   The AppGate (/) resolves the signed-in identity from /api/auth/session
   and provides it here. Defaults match the demo Group Admin so the
   workspace still renders standalone exactly as before. */

export interface SessionUser {
  id: string;
  name: string;
  email: string; // employee ID or email used at sign-in
  role: string;
  roleLabel: string;
}

const DEMO_SESSION_USER: SessionUser = {
  id: "demo",
  name: "Arun Bhaskar",
  email: "GRP-0001 · arun.bhaskar@meil.in",
  role: "GROUP_ADMIN",
  roleLabel: "Group Admin",
};

const SessionUserContext = React.createContext<SessionUser>(DEMO_SESSION_USER);
const SignOutContext = React.createContext<() => void>(() => undefined);

function useSessionUser(): SessionUser {
  return React.useContext(SessionUserContext);
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : name;
}

/* ───────────────────────────── Sidebar ───────────────────────────── */

function NavItem({ view, collapsed }: { view: ViewId; collapsed: boolean }) {
  const { view: active, navigate, params } = useWorkspace();
  const Icon = VIEW_ICONS[view];
  const meta = VIEW_META[view];
  const isActive = active === view;
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
      {!collapsed && <span className="truncate">{meta.title.replace(" Management", "").replace(" & ", " & ")}</span>}
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
  const { navigate } = useWorkspace();
  const user = useSessionUser();
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
            <span className="block truncate text-[11px] font-medium text-[color:var(--ink-faint)]">Group Admin Workspace</span>
          </span>
        )}
      </button>

      {/* Group Admin identity card */}
      {!collapsed && (
        <div className="glass-subtle glass-sheen mb-4 flex items-center gap-3 rounded-2xl p-2.5">
          <Avatar name={user.name} size={34} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{user.name}</div>
            <div className="truncate text-[11px] text-[color:var(--ink-faint)]">{user.roleLabel} · Super Admin</div>
          </div>
          <span className="flex h-2 w-2 shrink-0 rounded-full bg-[#238653] pulse-dot" aria-label="Online" />
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
            <Sparkles className="h-3.5 w-3.5 text-[color:var(--esg-purple)]" /> Demo dataset
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--ink-faint)]">
            All records in this workspace are clearly-identified demo data for the MEIL group.
          </p>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── Top bar ───────────────────────────── */

function NotificationBell() {
  const { data } = useApi<{ notifications: Notification[]; unread: number }>("/api/esg/notifications?limit=6");
  const { navigate, setUnreadCount, unreadCount } = useWorkspace();
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
              onClick={() => navigate(n.linkView as ViewId)}
            >
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.severity === "CRITICAL" ? "bg-[#c34a4a]" : n.severity === "WARNING" ? "bg-[#c57926]" : n.severity === "SUCCESS" ? "bg-[#238653]" : "bg-[#3a7bff]", !n.read && "pulse-dot")} />
              <span className="min-w-0">
                <span className={cn("block truncate text-[13px]", n.read ? "text-[color:var(--ink-soft)]" : "font-semibold text-[color:var(--ink)]")}>{n.title}</span>
                <span className="block truncate text-[11.5px] text-[color:var(--ink-faint)]">{n.body}</span>
                <span className="mt-0.5 block text-[10.5px] text-[color:var(--ink-faint)]">{timeAgo(n.createdAt)}</span>
              </span>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GlobalSearch({ trigger }: { trigger: React.ReactNode }) {
  const { commandOpen, setCommandOpen, navigate } = useWorkspace();
  const open = React.useCallback(() => setCommandOpen(true), [setCommandOpen]);
  const triggerWithClick =
    React.isValidElement<{ onClick?: () => void }>(trigger) ? React.cloneElement(trigger, { onClick: open }) : trigger;
  return (
    <>
      {triggerWithClick}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Search modules, organizations, actions…" className="text-sm" />
        <CommandList className="nice-scroll">
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Modules">
            {VIEW_ORDER.flatMap((g) => g.views).map((v) => {
              const Icon = VIEW_ICONS[v];
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
            <CommandItem onSelect={() => navigate("users", { create: Date.now() })}>
              <UserPlusIcon className="mr-2 h-4 w-4 text-[color:var(--esg-blue)]" /> Invite a new user
            </CommandItem>
            <CommandItem onSelect={() => navigate("tasks", { create: Date.now() })}>
              <TaskCheckIcon className="mr-2 h-4 w-4 text-[color:var(--esg-blue)]" /> Assign a reporting task
            </CommandItem>
            <CommandItem onSelect={() => navigate("brsr", { wizard: Date.now() })}>
              <ReportChartIcon className="mr-2 h-4 w-4 text-[color:var(--esg-blue)]" /> Create new BRSR report
            </CommandItem>
            <CommandItem onSelect={() => navigate("comms", { create: Date.now() })}>
              <MegaphoneIcon className="mr-2 h-4 w-4 text-[color:var(--esg-blue)]" /> Send an announcement
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

function TopBar() {
  const { view, params, reportingYear, setReportingYear, orgScope, setOrgScope, toggleSidebar, sidebarCollapsed, setMobileNav } = useWorkspace();
  const user = useSessionUser();
  const onSignOut = React.useContext(SignOutContext);
  const meta = VIEW_META[view];
  const { data: subs } = useApi<{ subsidiaries: { id: string; name: string }[] }>("/api/esg/org?type=subsidiaries&light=1");
  const detailMode = !!params.detailId;

  return (
    <header className="glass-chrome glass-sheen z-30 mx-3 flex shrink-0 items-center gap-2 rounded-3xl px-3 py-2.5 sm:mx-4 sm:gap-3 sm:px-4">
      <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-2xl hover:bg-white/70 lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" className="hidden h-10 w-10 shrink-0 rounded-2xl hover:bg-white/70 lg:flex" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {sidebarCollapsed ? <ChevronsRight className="h-4.5 w-4.5" /> : <ChevronsLeft className="h-4.5 w-4.5" />}
      </Button>

      {/* Breadcrumbs */}
      <div className="hidden min-w-0 flex-col md:flex">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-[color:var(--ink-faint)]">
          <span>Group</span>
          <span>/</span>
          <span>{meta.group}</span>
          {detailMode && (
            <>
              <span>/</span>
              <span className="text-[color:var(--esg-blue)]">Detail</span>
            </>
          )}
        </div>
        <div className="truncate text-[14px] font-semibold text-[color:var(--ink)]">{meta.title}</div>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
        {/* Reporting year */}
        <div className="glass-subtle hidden items-center rounded-2xl border-white/60 sm:flex">
          <span className="pl-3 pr-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ink-faint)]">Period</span>
          <Select value={reportingYear} onValueChange={setReportingYear}>
            <SelectTrigger className="h-9 w-[122px] rounded-2xl border-0 bg-transparent text-[13px] font-semibold text-[color:var(--ink)] shadow-none focus:ring-0" aria-label="Reporting year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              {REPORTING_YEARS.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Org scope */}
        <div className="glass-subtle hidden items-center rounded-2xl border-white/60 xl:flex">
          <Building2 className="ml-3 h-3.5 w-3.5 text-[color:var(--ink-faint)]" />
          <Select value={orgScope} onValueChange={setOrgScope}>
            <SelectTrigger className="h-9 w-[168px] rounded-2xl border-0 bg-transparent text-[13px] font-semibold text-[color:var(--ink)] shadow-none focus:ring-0" aria-label="Organization scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-strong rounded-2xl border-white/70">
              <SelectItem value="GROUP">Group (all)</SelectItem>
              {(subs?.subsidiaries ?? SUBSIDIARIES_LIGHT).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Command palette trigger */}
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
            <div className="flex items-center gap-3 px-2 py-2">
              <Avatar name={user.name} size={40} />
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold text-[color:var(--ink)]">{user.name}</div>
                <div className="truncate text-[11.5px] text-[color:var(--ink-faint)]">{user.email}</div>
                <div className="mt-1"><StatusBadge status="ACTIVE" /></div>
              </div>
            </div>
            <DropdownMenuSeparator className="bg-[rgba(125,177,216,0.3)]" />
            <DropdownMenuItem className="rounded-xl text-[13px]" onClick={() => useWorkspace.getState().navigate("settings")}>
              <Settings className="mr-2 h-4 w-4" /> Settings & Configuration
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-xl text-[13px]" onClick={() => useWorkspace.getState().navigate("audit")}>
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

/* ───────────────────────────── Workspace shell ───────────────────────────── */

export function WorkspaceShell({
  sessionUser,
  onSignOut,
}: {
  sessionUser?: SessionUser;
  onSignOut?: () => void;
} = {}) {
  const { view, sidebarCollapsed, mobileNavOpen, setMobileNav, commandOpen, setCommandOpen } = useWorkspace();

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

  // Module-scope lazy components — stable identity per view, never recreated during render.
  const ViewComponent = VIEW_COMPONENTS[view];

  /* App-frame layout: the shell (sidebar + top bar + footer) is a fixed-height
     chrome that never scrolls — ONLY <main> scrolls. This keeps navigation
     perfectly still while content (or any inner list) scrolls independently,
     and stops backdrop-filter chrome from re-sampling on every scroll frame. */
  return (
    <SessionUserContext.Provider value={sessionUser ?? DEMO_SESSION_USER}>
      <SignOutContext.Provider value={onSignOut ?? (() => undefined)}>
        <LoaderRoleProvider role={sessionUser?.role ?? "GROUP_ADMIN"}>
    <div className="relative h-dvh overflow-hidden">
      {/* Ambient orbs are intentionally static — animating them would force every
          backdrop-filter glass surface to re-sample its backdrop every frame. */}
      <div className="liquid-sky" aria-hidden="true">
        <div className="orb left-[6%] top-[8%] h-[380px] w-[380px] bg-[rgba(120,180,255,0.34)]" />
        <div className="orb right-[4%] top-[22%] h-[320px] w-[320px] bg-[rgba(167,139,250,0.2)]" />
        <div className="orb bottom-[6%] left-[38%] h-[420px] w-[420px] bg-[rgba(86,196,187,0.18)]" />
      </div>
      <div className="liquid-grain" aria-hidden="true" />

      <div className="relative z-10 flex h-full">
        {/* Desktop sidebar — full-height chrome with its own internal nav scroll */}
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
                  <MeilLoader size={48} role={sessionUser?.role ?? "GROUP_ADMIN"} label="Loading module…" />
                </div>
              }
            >
              <ViewComponent />
            </React.Suspense>
          </main>
        </div>
      </div>

      {/* MEIL Intelligence — floating assistant on non-intelligence views */}
      {view !== "intelligence" && <CopilotFloating />}

      {/* Calculator dock — right-edge vertical rail, available to every role */}
      <CalculatorDock />
    </div>
        </LoaderRoleProvider>
      </SignOutContext.Provider>
    </SessionUserContext.Provider>
  );
}
