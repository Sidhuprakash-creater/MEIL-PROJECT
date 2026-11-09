"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  Building2,
  Users,
  Layers,
  CheckSquare,
  FileSpreadsheet,
  FolderLock,
  Leaf,
  FileCheck2,
  History,
  FileWarning,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  LogOut,
  Calendar,
  ShieldAlert,
  ShieldCheck,
  HelpCircle,
  Sparkles,
  Command,
  X,
  ExternalLink,
} from "lucide-react";
import { usePaStore, PA_VIEW_ORDER, PA_VIEW_META } from "@/lib/project-admin/store";
import { prefetchProjectAdminData } from "@/lib/project-admin/client";
import type { PaViewId } from "@/lib/project-admin/types";
import { PaButton, PaStatusBadge } from "./ui";
import { PA_VIEW_COMPONENTS } from "./view-registry";
import "./project-admin.css";

/* Map view ids to Lucide icons (LayoutGrid for dashboard per reference) */
const VIEW_ICONS: Record<PaViewId, React.ComponentType<{ size?: number; className?: string }>> = {
  dashboard: LayoutGrid, // Matching reference image four-square grid icon
  "project-overview": Building2,
  users: Users,
  categories: Layers,
  tasks: CheckSquare,
  "collection-status": FileSpreadsheet,
  evidence: FolderLock,
  "esg-summary": Leaf,
  "consolidated-report": FileCheck2,
  submissions: History,
  corrections: FileWarning,
  notifications: Bell,
  settings: Settings,
  "approved-dataset": FileCheck2,
};

export interface PaSessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  project?: { id: string; name: string; code: string } | null;
  businessUnit?: { id: string; name: string; code: string } | null;
  subsidiary?: { id: string; name: string; code: string } | null;
}

export function ProjectAdminWorkspaceShell({
  sessionUser,
  onSignOut,
}: {
  sessionUser?: PaSessionUser;
  onSignOut?: () => void;
}) {
  const {
    currentView,
    navigate,
    financialYear,
    setFinancialYear,
    sidebarCollapsed,
    toggleSidebar,
    unreadNotificationsCount,
    commandPaletteOpen,
    setCommandPaletteOpen,
  } = usePaStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Warm up and prefetch all 13 views on mount for instantaneous navigation
  useEffect(() => {
    prefetchProjectAdminData();
  }, []);

  // Keyboard shortcut for Command Palette (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  /* Profile menu: close on Escape and whenever the admin navigates elsewhere.
     Outside clicks use a document mousedown listener — a `fixed inset-0`
     overlay inside the header does NOT cover the viewport because the glass
     header's backdrop-filter turns it into the containing block. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    setProfileMenuOpen(false);
  }, [currentView]);
  useEffect(() => {
    if (!profileMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest("[data-profile-menu]")) setProfileMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [profileMenuOpen]);

  const CurrentViewComponent = PA_VIEW_COMPONENTS[currentView] || PA_VIEW_COMPONENTS.dashboard;

  const projectName = sessionUser?.project?.name || "Zojila Strategic Bi-Directional Tunnel";
  const projectCode = sessionUser?.project?.code || "PRJ-ZOJ";
  const buName = sessionUser?.businessUnit?.name || "Heavy Civil Infrastructure";
  const subName = sessionUser?.subsidiary?.name || "MEIL Core";
  const userInitials = sessionUser?.name
    ? sessionUser.name
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "PA";

  return (
    <div className="pa-root flex h-screen w-screen overflow-hidden">
      {/* ── Atmospheric Glow Orbs ── */}
      <div className="pa-atmosphere" aria-hidden="true">
        <div className="pa-orb-1" />
        <div className="pa-orb-2" />
        <div className="pa-orb-3" />
      </div>

      {/* ── 1. Left Sidebar ── */}
      <aside
        className={`h-full flex-shrink-0 transition-all duration-300 flex flex-col justify-between border-r border-white/80 bg-white/70 backdrop-blur-2xl shadow-xl z-20 ${
          sidebarCollapsed ? "w-20" : "w-72"
        }`}
      >
        {/* Top Brand Cluster */}
        <div>
          <div className="p-4 border-b border-slate-200/50 flex items-center justify-between">
            {!sidebarCollapsed ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#315CFF] via-[#6542F5] to-[#8700E8] shadow-sm">
                  <span className="text-white font-extrabold text-sm tracking-wider">ME</span>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-[#315CFF]">Project Command</div>
                  <div className="text-sm font-extrabold text-[#202938] leading-tight">Center</div>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#315CFF] via-[#6542F5] to-[#8700E8] shadow-sm">
                <span className="text-white font-extrabold text-sm">ME</span>
              </div>
            )}

            <button
              type="button"
              onClick={toggleSidebar}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          {/* Project Scope Context Card */}
          {!sidebarCollapsed && (
            <div className="mx-3 my-3 p-3 rounded-2xl bg-gradient-to-br from-blue-50/80 to-indigo-50/80 border border-blue-100/80 shadow-xs">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748B]">
                <span className="uppercase tracking-wider">Assigned Site</span>
                <span className="px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 font-bold">{projectCode}</span>
              </div>
              <div className="mt-1 text-xs font-bold text-[#202938] truncate" title={projectName}>
                {projectName}
              </div>
              <div className="mt-0.5 text-[11px] text-[#64748B] truncate">{buName}</div>
            </div>
          )}

          {/* Navigation Sections */}
          <div className="px-2 py-2 overflow-y-auto max-h-[calc(100vh-250px)] pa-scroll space-y-4">
            {PA_VIEW_ORDER.map((sec) => (
              <div key={sec.section}>
                {!sidebarCollapsed && (
                  <div className="px-3 py-1 text-[10px] font-extrabold tracking-wider text-[#8F9EAF] uppercase">
                    {sec.section}
                  </div>
                )}
                <div className="space-y-1 mt-1">
                  {sec.views.map((vId) => {
                    const meta = PA_VIEW_META[vId];
                    const Icon = VIEW_ICONS[vId] || LayoutGrid;
                    const isActive = currentView === vId;

                    return (
                      <button
                        key={vId}
                        type="button"
                        onClick={() => navigate(vId)}
                        title={sidebarCollapsed ? meta.label : undefined}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-200 group relative ${
                          isActive
                            ? "pa-gradient-active shadow-sm"
                            : "text-[#64748B] hover:text-[#202938] hover:bg-white/80"
                        } ${sidebarCollapsed ? "justify-center px-0" : ""}`}
                      >
                        <Icon
                          size={18}
                          className={`transition-transform duration-200 ${
                            isActive ? "text-white scale-110" : "text-[#64748B] group-hover:text-[#315CFF]"
                          }`}
                        />
                        {!sidebarCollapsed && (
                          <span className="flex-1 text-left truncate">{meta.label}</span>
                        )}
                        {!sidebarCollapsed && meta.badge && (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-white/20 text-white uppercase tracking-wider">
                            {meta.badge}
                          </span>
                        )}
                        {!sidebarCollapsed && vId === "notifications" && unreadNotificationsCount > 0 && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                            {unreadNotificationsCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* User Profile Bar (Static Clean Badge — Logout is located in top header) */}
        <div className="p-3 border-t border-slate-200/50">
          <div className="flex items-center gap-3 p-2 rounded-2xl bg-white/40 border border-white/60">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#315CFF] to-[#8700E8] text-white font-bold text-xs shadow-xs">
              PA
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 truncate">
                <div className="text-xs font-bold text-[#202938] truncate">{sessionUser?.name || "Project Site Admin"}</div>
                <div className="text-[11px] text-[#64748B] font-medium">Project Admin</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── 2. Main Workspace ── */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative z-10">
        {/* Top Header: strictly pinned, does not scroll with page content */}
        <header className="flex-shrink-0 z-30 flex items-center justify-between px-6 py-3.5 border-b border-white/80 bg-white/80 backdrop-blur-xl shadow-xs">
          {/* Breadcrumb path */}
          <div className="flex items-center gap-2 text-xs text-[#64748B] font-medium truncate">
            <span className="hover:text-blue-600 transition-colors">MEIL Group</span>
            <span>/</span>
            <span className="truncate max-w-[120px]">{subName}</span>
            <span>/</span>
            <span className="truncate max-w-[140px]">{buName}</span>
            <span>/</span>
            <span className="font-bold text-[#315CFF] truncate max-w-[160px]">{projectName}</span>
          </div>

          {/* Top Header Actions matching Image 1: Notification Bell, Help, Profile Pill with Dropdown */}
          <div className="flex items-center gap-3">
            {/* Notification Bell with red counter badge */}
            <button
              type="button"
              onClick={() => navigate("notifications")}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:text-blue-600 hover:bg-white/60 transition-colors"
              title="Notifications"
            >
              <Bell className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex min-w-4 h-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Help button */}
            <button
              type="button"
              onClick={() => navigate("project-overview")}
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:text-blue-600 hover:bg-white/60 transition-colors"
              title="Help & Info"
            >
              <HelpCircle className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
            </button>

            {/* Profile Pill matching Image 1 */}
            <div className="relative" data-profile-menu>
              <button
                type="button"
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition hover:ring-2 hover:ring-blue-100 bg-white/70 border border-slate-200/70 shadow-xs"
                title="Account menu"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                  {userInitials}
                </div>
                <div className="hidden sm:block text-left leading-tight">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-slate-800">{sessionUser?.name || "Project Site Admin"}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <div className="text-[10px] text-slate-500">{sessionUser?.roleLabel || "Project Admin"}</div>
                </div>
              </button>

              <AnimatePresence>
                {profileMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      className="absolute right-0 top-12 z-50 w-64 rounded-2xl p-2 bg-white/95 backdrop-blur-xl border border-white/80 shadow-xl"
                    >
                      <div className="border-b border-slate-200/60 px-3 py-2.5">
                        <div className="text-sm font-bold text-slate-800">{sessionUser?.name || "Project Site Admin"}</div>
                        <div className="text-[11px] text-slate-500 truncate">{sessionUser?.email || "admin@site.meil.in"}</div>
                      </div>
                      <div className="py-1">
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          ROLE & SCOPE
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700">
                          <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                          <span>{sessionUser?.roleLabel || "Project Admin"}</span>
                        </div>
                      </div>
                      <div className="border-t border-slate-200/60 py-1">
                        <button
                          type="button"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            if (onSignOut) onSignOut();
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span>Sign out</span>
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* ── 3. Screen View Scroll Container ── */}
        <main className="flex-1 overflow-y-auto pa-scroll p-6 md:p-8">
          <div className="max-w-7xl w-full mx-auto pb-16">
            <CurrentViewComponent />
          </div>
        </main>
      </div>

      {/* ── 4. Global ⌘K Command Palette ── */}
      {commandPaletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setCommandPaletteOpen(false)} />
          <div className="relative w-full max-w-xl pa-glass-strong rounded-3xl p-4 shadow-2xl border border-white z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-200/60">
              <Search size={18} className="text-[#315CFF]" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Jump to any screen or workflow..."
                className="w-full bg-transparent border-none outline-none text-sm font-medium text-[#202938]"
              />
              <button
                onClick={() => setCommandPaletteOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-2 max-h-80 overflow-y-auto pa-scroll space-y-1">
              {Object.values(PA_VIEW_META)
                .filter(
                  (m) =>
                    !searchQuery ||
                    m.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    m.description.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((m) => {
                  const Icon = VIEW_ICONS[m.id] || LayoutGrid;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        navigate(m.id);
                        setCommandPaletteOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-blue-50/70 text-left transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-blue-100/60 text-[#315CFF] group-hover:bg-[#315CFF] group-hover:text-white transition-colors">
                          <Icon size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#202938]">{m.label}</div>
                          <div className="text-[11px] text-[#64748B]">{m.description}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{m.section}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

