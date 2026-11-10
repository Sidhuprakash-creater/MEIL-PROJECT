"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2, Clock, X, ChevronRight } from "lucide-react";
import { Ring } from "@/components/ring";
import { CONTRIBUTOR_CATEGORIES } from "@/lib/project-admin/store";
import type { ContributorRole } from "@/lib/project-admin/types";

/* ── 1. Glass Card ── */
export function PaGlassCard({
  children,
  className = "",
  strong = false,
  subtle = false,
  hover = false,
  onClick,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  strong?: boolean;
  subtle?: boolean;
  hover?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  const base = strong ? "pa-glass-strong" : subtle ? "pa-glass-subtle" : "pa-glass";
  const hoverClass = hover ? "pa-glass-hover cursor-pointer" : "";

  return (
    <div
      onClick={onClick}
      style={style}
      className={`${base} ${hoverClass} rounded-2xl p-5 ${className}`}
    >
      {children}
    </div>
  );
}

/* ── 2. Primary / Secondary Buttons ── */
export function PaButton({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  loading = false,
  disabled = false,
  className = "",
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: React.ComponentType<{ className?: string; size?: number }> | React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}) {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs rounded-xl",
    md: "px-4 py-2.5 text-sm rounded-xl",
    lg: "px-6 py-3 text-base rounded-2xl",
  }[size];

  const variantClasses = {
    primary: "pa-btn-primary",
    secondary: "pa-btn-secondary",
    danger: "bg-rose-600 hover:bg-rose-700 text-white shadow-xs border border-rose-700/20",
    ghost: "bg-transparent hover:bg-white/60 text-[#202938] hover:text-[#315CFF]",
  }[variant];

  const renderIcon = () => {
    if (loading) return <Ring className={size === "sm" ? "size-3.5" : "size-4"} />;
    if (!Icon) return null;
    if (React.isValidElement(Icon)) return Icon;
    if (typeof Icon === "function") {
      const Component = Icon as React.ComponentType<{ className?: string; size?: number }>;
      return <Component size={size === "sm" ? 14 : 16} />;
    }
    return null;
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${variantClasses} ${className}`}
    >
      {renderIcon()}
      <span>{children}</span>
    </button>
  );
}

/* ── 3. Page Header ── */
export function PaPageHeader({
  title,
  subtitle,
  badge,
  actions,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-[#202938] sm:text-3xl">{title}</h1>
          {badge && (
            <span className="pa-gradient-active px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide">
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p className="mt-1 text-sm text-[#64748B]">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3 flex-wrap">{actions}</div>}
    </div>
  );
}

/* ── 4. KPI Card with animated number ── */
export function PaKpiCard({
  title,
  value,
  label,
  icon: Icon,
  accentColor = "#315CFF",
  trend,
  onClick,
}: {
  title: string;
  value: number | string;
  label?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accentColor?: string;
  trend?: { value: string; positive: boolean };
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{ ["--kpi-glow" as any]: `${accentColor}15` }}
      className={`pa-kpi-card p-5 group flex flex-col justify-between ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">{title}</span>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#1E293B] tracking-tight">
            {typeof value === "number" ? <CountUp target={value} /> : value}
          </div>
          {label && <p className="mt-1 text-xs text-[#64748B] font-medium">{label}</p>}
        </div>
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0"
          style={{
            background: `linear-gradient(135deg, ${accentColor}18, ${accentColor}08)`,
            border: `1px solid ${accentColor}25`,
            color: accentColor,
            boxShadow: `0 2px 6px ${accentColor}15`,
          }}
        >
          <Icon size={20} />
        </div>
      </div>

      {trend && (
        <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold">
          <span className={trend.positive ? "text-emerald-600" : "text-amber-600"}>
            {trend.positive ? "↑" : "↓"} {trend.value}
          </span>
          <span className="text-slate-400 font-normal">vs last cycle</span>
        </div>
      )}
    </div>
  );
}

/* ── 5. Status Badges ── */
export function PaStatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  let bg = "bg-slate-100 text-slate-700 border-slate-200";
  let dot = "bg-slate-400";
  let label = status.replace(/_/g, " ");

  if (normalized === "ACTIVE" || normalized === "COMPLETED" || normalized === "APPROVED" || normalized === "BU_APPROVED" || normalized === "VERIFIED" || normalized === "COMPLETE" || normalized === "ON_TRACK") {
    bg = "bg-emerald-50 text-emerald-700 border-emerald-200/60";
    dot = "bg-emerald-500";
    if (normalized === "BU_APPROVED") label = "Approved (BU)";
  } else if (normalized === "PENDING" || normalized === "UNDER_REVIEW" || normalized === "SUBMITTED" || normalized === "READY_TO_SUBMIT" || normalized === "IN_PROGRESS" || normalized === "BU_REVIEW_PENDING") {
    bg = "bg-blue-50 text-blue-700 border-blue-200/60";
    dot = "bg-blue-500 animate-pulse";
  } else if (normalized === "DRAFT" || normalized === "DUE_SOON" || normalized === "PENDING_REVIEW") {
    bg = "bg-amber-50 text-amber-700 border-amber-200/60";
    dot = "bg-amber-500";
  } else if (normalized === "RETURNED" || normalized === "CHANGES_REQUESTED" || normalized === "REJECTED" || normalized === "ACTION_REQUIRED" || normalized === "OVERDUE" || normalized === "MISSING") {
    bg = "bg-rose-50 text-rose-700 border-rose-200/60";
    dot = "bg-rose-500";
  }

  return (
    <span className={`pa-badge border ${bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="capitalize">{label.toLowerCase()}</span>
    </span>
  );
}

/* ── 6. BU handoff decision badge ────────────────────────────────────────────
   One vocabulary for "what did the Business Unit decide with this report",
   shared by the Consolidated tracker and the Submissions screen. */
export function PaBuDecisionBadge({ decision }: { decision?: string | null }) {
  const d = String(decision || "AWAITING_BU_REVIEW").toUpperCase();
  let bg = "bg-sky-50 text-sky-700 border-sky-200/60";
  let dot = "bg-sky-500 animate-pulse";
  let label = "Awaiting BU review";

  if (d === "BU_APPROVED") {
    bg = "bg-emerald-50 text-emerald-700 border-emerald-200/60";
    dot = "bg-emerald-500";
    label = "BU approved";
  } else if (d === "BU_REJECTED") {
    bg = "bg-rose-50 text-rose-700 border-rose-200/60";
    dot = "bg-rose-500";
    label = "BU rejected";
  } else if (d === "RETURNED_BY_BU") {
    bg = "bg-amber-50 text-amber-700 border-amber-200/60";
    dot = "bg-amber-500";
    label = "Returned by BU";
  }

  return (
    <span className={`pa-badge border ${bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="capitalize">{label.toLowerCase()}</span>
    </span>
  );
}

/* ── 7. Contributor Category Badge ── */
export function PaCategoryBadge({ category }: { category: ContributorRole }) {
  const def = CONTRIBUTOR_CATEGORIES[category] || { label: category, color: "#315CFF" };
  return (
    <span
      className="pa-badge border"
      style={{
        background: `${def.color}15`,
        borderColor: `${def.color}40`,
        color: def.color,
      }}
    >
      {def.label}
    </span>
  );
}

/* ── 7. Circular Progress Indicator ── */
export function PaCircularProgress({
  percentage,
  size = 120,
  strokeWidth = 10,
  color = "#315CFF",
  label = "Completed",
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(123, 161, 210, 0.2)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#paProgressGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="paProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#315CFF" />
            <stop offset="60%" stopColor="#6542F5" />
            <stop offset="100%" stopColor="#8700E8" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-black text-[#202938] tracking-tight">{percentage}%</span>
        {label && <span className="text-[10px] uppercase font-bold text-[#64748B]">{label}</span>}
      </div>
    </div>
  );
}

/* ── 8. Tab Strip ── */
export function PaTabStrip({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="pa-segmented-pill flex-wrap max-w-full">
      {tabs.map((t) => {
        const isActive = activeTab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`pa-segmented-item flex items-center gap-2 ${
              isActive ? "active" : ""
            }`}
          >
            <span>{t.label}</span>
            {t.count !== undefined && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive ? "bg-blue-100/90 text-blue-700" : "bg-white/70 text-slate-500"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── 9. Modal / Dialog ── */
export function PaDialog({
  open,
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth,
  size,
}: {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const isShown = open ?? isOpen ?? false;
  if (!isShown) return null;

  const sizeClass =
    size === "sm"
      ? "max-w-md"
      : size === "md"
      ? "max-w-xl"
      : size === "lg"
      ? "max-w-3xl"
      : size === "xl"
      ? "max-w-5xl"
      : maxWidth || "max-w-2xl";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      {/* Content */}
      <div className={`relative w-full ${sizeClass} pa-glass-strong rounded-3xl p-6 sm:p-8 z-10 shadow-2xl border border-white max-h-[90vh] overflow-y-auto pa-scroll`}>
        <div className="flex items-start justify-between pb-4 border-b border-slate-200/60 mb-6">
          <div>
            <h3 className="text-xl font-bold text-[#202938]">{title}</h3>
            {subtitle && <p className="text-xs text-[#64748B] mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100/80 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

/* ── 10. Drawer Panel ── */
export function PaDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl h-full pa-glass-strong p-6 sm:p-8 z-10 shadow-2xl border-l border-white overflow-y-auto pa-scroll animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
          <div>
            <h3 className="text-lg font-bold text-[#202938]">{title}</h3>
            {subtitle && <p className="text-xs text-[#64748B] mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── 11. CountUp component ── */
function CountUp({ target }: { target: number }) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 800;
    const stepTime = 20;
    const steps = duration / stepTime;
    const increment = target / steps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setVal(target);
        clearInterval(timer);
      } else {
        setVal(Math.floor(start));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [target]);

  return <span>{val.toLocaleString()}</span>;
}
