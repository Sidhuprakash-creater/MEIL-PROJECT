"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  User,
  Shield,
  Bell,
  Sliders,
  LogOut,
  Save,
  CheckCircle2,
  Building2,
  Briefcase,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  HelpCircle,
} from "lucide-react";
import {
  PaGlassCard,
  PaButton,
  PaPageHeader,
  PaStatusBadge,
  PaDialog,
} from "@/components/project-admin/ui";
import { MeilBoxLoader } from "@/components/shared/meil-loader";
import { paApiGet, paApiPost, getCachedPaData, clearPaClientCache } from "@/lib/project-admin/client";
import { usePaStore } from "@/lib/project-admin/store";

interface SettingsData {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    projectCode: string;
    projectName: string;
    businessUnit: string;
    subsidiary: string;
    assignedDate?: string;
  };
  preferences: {
    tableDensity: "comfortable" | "compact";
    enableAtmosphericLighting: boolean;
    autoSaveIntervalMinutes: number;
    requireEvidenceForMetrics: boolean;
    notifyOnContributorSubmit: boolean;
    notifyOnBuFeedback: boolean;
    notifyOnTaskDeadline: boolean;
    defaultFinancialYear: string;
  };
}

export function SettingsView() {
  const router = useRouter();
  const { financialYear, setFinancialYear } = usePaStore();
  const cached = getCachedPaData<any>("/api/project-admin/settings");
  const initialUser = cached?.profile || cached?.user;
  const [data, setData] = useState<SettingsData | null>(
    initialUser
      ? {
          user: {
            id: initialUser.id || "",
            name: initialUser.name || "",
            email: initialUser.email || "",
            role: initialUser.role || "Project Admin",
            projectCode: initialUser.projectCode || "PRJ-ZOJ",
            projectName: initialUser.projectName || "Zojila Strategic Bi-Directional Tunnel",
            businessUnit: initialUser.businessUnitName || initialUser.businessUnit || "Heavy Civil Infrastructure",
            subsidiary: initialUser.subsidiaryName || initialUser.subsidiary || "MEIL Core",
          },
          preferences: cached?.preferences || {
            tableDensity: "comfortable",
            enableAtmosphericLighting: true,
            autoSaveIntervalMinutes: 5,
            requireEvidenceForMetrics: true,
            notifyOnContributorSubmit: true,
            notifyOnBuFeedback: true,
            notifyOnTaskDeadline: true,
            defaultFinancialYear: "FY 2025-26",
          },
        }
      : null
  );
  const [isLoading, setIsLoading] = useState(!initialUser);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form states
  const [name, setName] = useState(initialUser?.name || "");
  const [tableDensity, setTableDensity] = useState<"comfortable" | "compact">("comfortable");
  const [lighting, setLighting] = useState(true);
  const [requireEvidence, setRequireEvidence] = useState(true);
  const [notifySubmit, setNotifySubmit] = useState(true);
  const [notifyFeedback, setNotifyFeedback] = useState(true);
  const [notifyDeadline, setNotifyDeadline] = useState(true);

  // Password modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Logout confirm modal
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const loadSettings = async () => {
    if (!data) setIsLoading(true);
    try {
      const res = await paApiGet<any>("/api/project-admin/settings");
      const userObj = res.profile || res.user || {};
      const shaped: SettingsData = {
        user: {
          id: userObj.id || "",
          name: userObj.name || "",
          email: userObj.email || "",
          role: userObj.role || "Project Admin",
          projectCode: userObj.projectCode || "PRJ-ZOJ",
          projectName: userObj.projectName || "Zojila Strategic Bi-Directional Tunnel",
          businessUnit: userObj.businessUnitName || userObj.businessUnit || "Heavy Civil Infrastructure",
          subsidiary: userObj.subsidiaryName || userObj.subsidiary || "MEIL Core",
        },
        preferences: res.preferences || {
          tableDensity: "comfortable",
          enableAtmosphericLighting: true,
          autoSaveIntervalMinutes: 5,
          requireEvidenceForMetrics: true,
          notifyOnContributorSubmit: true,
          notifyOnBuFeedback: true,
          notifyOnTaskDeadline: true,
          defaultFinancialYear: "FY 2025-26",
        },
      };
      setData(shaped);
      setName(shaped.user.name || "");
      if (shaped.preferences) {
        setTableDensity(shaped.preferences.tableDensity || "comfortable");
        setLighting(shaped.preferences.enableAtmosphericLighting ?? true);
        setRequireEvidence(shaped.preferences.requireEvidenceForMetrics ?? true);
        setNotifySubmit(shaped.preferences.notifyOnContributorSubmit ?? true);
        setNotifyFeedback(shaped.preferences.notifyOnBuFeedback ?? true);
        setNotifyDeadline(shaped.preferences.notifyOnTaskDeadline ?? true);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await paApiPost("/api/project-admin/settings", {
        action: "update_preferences",
        name,
        preferences: {
          tableDensity,
          enableAtmosphericLighting: lighting,
          requireEvidenceForMetrics: requireEvidence,
          notifyOnContributorSubmit: notifySubmit,
          notifyOnBuFeedback: notifyFeedback,
          notifyOnTaskDeadline: notifyDeadline,
          defaultFinancialYear: financialYear,
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
      alert("Failed to save preferences. Please check your connection.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    try {
      await paApiPost("/api/project-admin/settings", {
        action: "change_password",
        currentPassword,
        newPassword,
      });
      setPasswordSuccess(true);
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPasswordSuccess(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }, 1500);
    } catch (err: any) {
      setPasswordError(err?.message || "Failed to update password.");
    }
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/");
    router.refresh();
  };

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-6">
        <MeilBoxLoader boxHeight="min-h-[240px]" label="Loading workspace preferences…" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <PaPageHeader
        title="Command Center Preferences & Identity"
        subtitle="Manage your Project Admin credentials, project operating parameters, notification rules, and workspace experience"
        badge="System Configuration"
        actions={
          <div className="flex items-center gap-2">
            <PaButton
              variant="secondary"
              size="sm"
              icon={<KeyRound className="w-4 h-4" />}
              onClick={() => setIsPasswordModalOpen(true)}
            >
              Change Password
            </PaButton>
            <PaButton
              variant="danger"
              size="sm"
              icon={<LogOut className="w-4 h-4" />}
              onClick={() => setIsLogoutModalOpen(true)}
            >
              Sign Out
            </PaButton>
          </div>
        }
      />

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 text-sm flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          Settings saved successfully!
        </div>
      )}

      <form onSubmit={handleSavePreferences} className="space-y-6">
        {/* Profile and Project Identity Card */}
        <PaGlassCard className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200/60">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#315CFF] flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">
                Project Admin Identity
              </h3>
              <p className="text-xs text-slate-500">
                Assigned operational controller profile and project scoping
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Administrator Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/80 border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Official Email Address
              </label>
              <input
                type="email"
                disabled
                value={data?.user.email || ""}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-100/80 border border-slate-200 text-sm text-slate-500 cursor-not-allowed"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Managed centrally via corporate directory
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Operational Role
              </label>
              <div className="px-4 py-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-sm font-semibold text-[#315CFF] flex items-center gap-2">
                <Shield className="w-4 h-4" />
                PROJECT ADMIN (Level 4 Operational Controller)
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Assigned Project
              </label>
              <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-slate-500" />
                {data?.user.projectName} ({data?.user.projectCode})
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Parent Business Unit
              </label>
              <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-500" />
                {data?.user.businessUnit}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Parent Subsidiary
              </label>
              <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-500" />
                {data?.user.subsidiary}
              </div>
            </div>
          </div>
        </PaGlassCard>

        {/* Workspace Display & Controls */}
        <PaGlassCard className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200/60">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#6542F5] flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">
                Workspace Experience & Density
              </h3>
              <p className="text-xs text-slate-500">
                Customize layout compactness, visuals, and financial year defaults
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Table & Grid Density
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setTableDensity("comfortable")}
                  className={`flex-1 p-3 rounded-xl border text-left transition-all ${
                    tableDensity === "comfortable"
                      ? "border-[#315CFF] bg-blue-50/50 shadow-sm"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-800 mb-0.5">Comfortable</div>
                  <div className="text-[11px] text-slate-500">
                    Spacious padding, ideal for general operational review
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setTableDensity("compact")}
                  className={`flex-1 p-3 rounded-xl border text-left transition-all ${
                    tableDensity === "compact"
                      ? "border-[#315CFF] bg-blue-50/50 shadow-sm"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-800 mb-0.5">Compact</div>
                  <div className="text-[11px] text-slate-500">
                    Dense high-information layout for large data tables
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Default Financial Year
              </label>
              <select
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/80 border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              >
                <option value="FY 2024-25">FY 2024-25 (Current Reporting Period)</option>
                <option value="FY 2023-24">FY 2023-24 (Previous Audited)</option>
                <option value="FY 2022-23">FY 2022-23 (Historical)</option>
              </select>
            </div>

            <div className="md:col-span-2 pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={lighting}
                  onChange={(e) => setLighting(e.target.checked)}
                  className="w-4 h-4 rounded text-[#315CFF] focus:ring-blue-400"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    Enable Liquid Glass Atmospheric Orbs
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Renders floating ambient sky-blue and liquid-purple glow orbs in the background
                  </div>
                </div>
              </label>
            </div>
          </div>
        </PaGlassCard>

        {/* Operating & Notification Rules */}
        <PaGlassCard className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200/60">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">
                Operating Rules & Notification Triggers
              </h3>
              <p className="text-xs text-slate-500">
                Data quality enforcement and alert preferences for project events
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={requireEvidence}
                onChange={(e) => setRequireEvidence(e.target.checked)}
                className="w-4 h-4 rounded text-[#315CFF] focus:ring-blue-400 mt-0.5"
              />
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  Strict Evidence Enforcement Rule
                </div>
                <div className="text-[11px] text-slate-500">
                  Flag metrics without linked evidence as incomplete during consolidation validation
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={notifySubmit}
                onChange={(e) => setNotifySubmit(e.target.checked)}
                className="w-4 h-4 rounded text-[#315CFF] focus:ring-blue-400 mt-0.5"
              />
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  Contributor Category Submission Alerts
                </div>
                <div className="text-[11px] text-slate-500">
                  Receive instant notifications when any of the 7 contributor roles submits or updates category data
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={notifyFeedback}
                onChange={(e) => setNotifyFeedback(e.target.checked)}
                className="w-4 h-4 rounded text-[#315CFF] focus:ring-blue-400 mt-0.5"
              />
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  Business Unit Manager Feedback Notifications
                </div>
                <div className="text-[11px] text-slate-500">
                  Receive priority alerts whenever BU Manager approves, rejects, or requests corrections on a consolidated project report
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={notifyDeadline}
                onChange={(e) => setNotifyDeadline(e.target.checked)}
                className="w-4 h-4 rounded text-[#315CFF] focus:ring-blue-400 mt-0.5"
              />
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  Task Deadline Reminders
                </div>
                <div className="text-[11px] text-slate-500">
                  Daily summary of overdue or approaching task deadlines across all contributor categories
                </div>
              </div>
            </label>
          </div>
        </PaGlassCard>

        {/* Save Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <PaButton
            type="submit"
            variant="primary"
            icon={<Save className="w-4 h-4" />}
            disabled={isSaving}
          >
            {isSaving ? "Saving Changes..." : "Save Preferences"}
          </PaButton>
        </div>
      </form>

      {/* Change Password Dialog */}
      <PaDialog
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        title="Change Account Password"
        size="md"
      >
        <form onSubmit={handleChangePassword} className="space-y-4">
          <p className="text-xs text-slate-500">
            Enter your current password and choose a secure replacement.
          </p>

          {passwordError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-xs">
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Password updated successfully!
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/80 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/80 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              placeholder="Minimum 6 characters"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/80 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <PaButton
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setIsPasswordModalOpen(false)}
            >
              Cancel
            </PaButton>
            <PaButton variant="primary" size="sm" type="submit">
              Update Password
            </PaButton>
          </div>
        </form>
      </PaDialog>

      {/* Logout Confirmation Dialog */}
      <PaDialog
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        title="Sign Out Confirmation"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to sign out of the <strong>MEIL — Project Command Center</strong>? Any unsaved edits will be discarded.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <PaButton
              variant="secondary"
              size="sm"
              onClick={() => setIsLogoutModalOpen(false)}
            >
              Cancel
            </PaButton>
            <PaButton
              variant="danger"
              size="sm"
              icon={<LogOut className="w-4 h-4" />}
              onClick={handleSignOut}
            >
              Confirm Sign Out
            </PaButton>
          </div>
        </div>
      </PaDialog>
    </div>
  );
}
