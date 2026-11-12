"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActionButton, Field, GlassDialog } from "@/components/workspace/ui";
import { useToast } from "@/hooks/use-toast";
import { apiPost, useApi, useMutation } from "@/lib/esg/client";
import { ROLE_LABELS } from "@/lib/esg/types";

const ROLE_KEYS = Object.keys(ROLE_LABELS);

type CredentialMode = "temp_password" | "google_invite" | "custom_password";

export interface CreatedUserOutcome {
  userName: string;
  role: string;
  tempPassword?: string;
  emailSent?: boolean;
  emailNote?: string;
}

function scopeHintForRole(role: string): string {
  if (role === "SUBSIDIARY_ADMIN" || role === "SUBSIDIARY_MANAGER") {
    return "Required: select a Subsidiary for this role.";
  }
  if (role === "BU_ADMIN" || role === "BU_MANAGER") {
    return "Required: select a Subsidiary and Business Unit for this role.";
  }
  if (role === "PROJECT_ADMIN") {
    return "Required: select a Subsidiary, Business Unit, and Project / Site for Project Admin.";
  }
  if (
    [
      "ENV_DATA_USER",
      "FIN_RESOURCE_USER",
      "HR_USER",
      "EHS_USER",
      "PROCUREMENT_USER",
      "CSR_USER",
      "COMPLIANCE_USER",
    ].includes(role)
  ) {
    return "Required: assign at least a Business Unit or Project / Site for this contributor role.";
  }
  return "Group-level access by default (optional Subsidiary / BU / Project filter).";
}

export function CreateUserDialog({
  open,
  onOpenChange,
  defaultRole = "",
  subsidiaries: externalSubs,
  businessUnits: externalBus,
  projects: externalProjects,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRole?: string;
  subsidiaries?: { id: string; name: string }[];
  businessUnits?: { id: string; name: string; subsidiaryId: string }[];
  projects?: { id: string; name: string; businessUnitId: string }[];
  onCreated?: (outcome: CreatedUserOutcome) => void;
}) {
  const { toast } = useToast();
  const createMut = useMutation();

  const subsApi = useApi<{ subsidiaries: { id: string; name: string }[] }>(
    externalSubs ? null : "/api/esg/org?type=subsidiaries&light=1"
  );
  const unitsApi = useApi<{
    businessUnits: { id: string; name: string; subsidiaryId: string }[];
  }>(externalBus ? null : "/api/esg/org?type=business-units");
  const projectsApi = useApi<{
    projects: { id: string; name: string; businessUnitId: string }[];
  }>(externalProjects ? null : "/api/esg/org?type=projects");

  const subsidiaries = externalSubs ?? subsApi.data?.subsidiaries ?? [];
  const businessUnits = externalBus ?? unitsApi.data?.businessUnits ?? [];
  const projects = externalProjects ?? projectsApi.data?.projects ?? [];

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState(defaultRole);
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [googleEmail, setGoogleEmail] = useState("");
  const [subsidiaryId, setSubsidiaryId] = useState("ALL");
  const [businessUnitId, setBusinessUnitId] = useState("ALL");
  const [projectId, setProjectId] = useState("ALL");
  const [credMode, setCredMode] = useState<CredentialMode>("temp_password");
  const [customPassword, setCustomPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setEmployeeId("");
      setRole(defaultRole || "");
      setTitle("");
      setPhone("");
      setGoogleEmail("");
      setSubsidiaryId("ALL");
      setBusinessUnitId("ALL");
      setProjectId("ALL");
      setCredMode("temp_password");
      setCustomPassword("");
      setErrors({});
    }
  }, [open, defaultRole]);

  const buOptions = businessUnits.filter(
    (b) => subsidiaryId === "ALL" || b.subsidiaryId === subsidiaryId
  );
  const projectOptions = projects.filter(
    (p) => businessUnitId === "ALL" || p.businessUnitId === businessUnitId
  );

  const validate = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Full name must be at least 2 characters.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      e.email = "A valid email address is required.";
    }
    if (!role) e.role = "Select a role.";
    if (
      googleEmail.trim() &&
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(googleEmail.trim())
    ) {
      e.googleEmail = "Enter a valid Google email address.";
    }
    if (credMode === "custom_password" && customPassword.length < 8) {
      e.customPassword = "Initial password must be at least 8 characters.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const payload: Record<string, unknown> = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      employeeId: employeeId.trim() || undefined,
      googleEmail: googleEmail.trim().toLowerCase() || undefined,
      role,
      title: title.trim() || undefined,
      phone: phone.trim() || undefined,
      subsidiaryId: subsidiaryId === "ALL" ? "" : subsidiaryId,
      businessUnitId: businessUnitId === "ALL" ? "" : businessUnitId,
      projectId: projectId === "ALL" ? "" : projectId,
      issueTempPassword: credMode === "temp_password",
      customPassword:
        credMode === "custom_password" ? customPassword : undefined,
    };

    const res = await createMut.run(() => apiPost("/api/esg/users", payload));
    if (!res) {
      toast({
        title: "Create user failed",
        description:
          createMut.error ?? "Server rejected the user provisioning request.",
        variant: "destructive",
      });
      return;
    }

    const r = res as {
      tempPassword?: string;
      emailSent?: boolean;
      emailNote?: string;
      message?: string;
    };

    const roleLabel = ROLE_LABELS[role] ?? role.replaceAll("_", " ");
    toast({
      title: credMode === "google_invite" ? "Invitation sent" : "User created with access",
      description:
        r.message ??
        `${name.trim()} provisioned as ${roleLabel} and can now access their workspace.`,
    });

    onOpenChange(false);
    onCreated?.({
      userName: name.trim(),
      role,
      tempPassword: r.tempPassword,
      emailSent: r.emailSent,
      emailNote: r.emailNote,
    });
  };

  return (
    <GlassDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create / Invite User"
      description="Provision a role-scoped user with Google SSO and/or immediate login credentials."
      wide
      footer={
        <>
          <Button
            variant="outline"
            className="glass-subtle rounded-2xl"
            onClick={() => onOpenChange(false)}
            disabled={createMut.pending}
          >
            Cancel
          </Button>
          <ActionButton pending={createMut.pending} onClick={() => void handleSubmit()}>
            {credMode === "google_invite" ? "Send invite" : "Create user & grant access"}
          </ActionButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={errors.name}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="glass-subtle rounded-2xl border-white/60"
              placeholder="e.g. Priya Nair"
            />
          </Field>
          <Field label="Email" required error={errors.email}>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-subtle rounded-2xl border-white/60"
              placeholder="name@meilgroup.com"
              type="email"
            />
          </Field>
          <Field label="Role" required error={errors.role}>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="glass-subtle w-full rounded-2xl border-white/60">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent className="glass-strong z-[100] max-h-72 rounded-2xl border-white/70 shadow-2xl backdrop-blur-md">
                {ROLE_KEYS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r] ?? r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Google Sign-In Email (optional)"
            error={errors.googleEmail}
            hint="Link a Gmail / Google Workspace address for 1-click Google SSO"
          >
            <Input
              value={googleEmail}
              onChange={(e) => setGoogleEmail(e.target.value)}
              className="glass-subtle rounded-2xl border-white/60"
              placeholder="user@gmail.com"
              type="email"
            />
          </Field>
          <Field label="Employee ID (optional)" hint="Auto-generated if left blank">
            <Input
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="glass-subtle rounded-2xl border-white/60"
              placeholder="e.g. MEIL-1042"
            />
          </Field>
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="glass-subtle rounded-2xl border-white/60"
              placeholder="e.g. Environment Data Lead"
            />
          </Field>
          <Field label="Phone">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="glass-subtle rounded-2xl border-white/60"
              placeholder="+91…"
            />
          </Field>
          <Field label="Access / Credential mode">
            <Select
              value={credMode}
              onValueChange={(v) => setCredMode(v as CredentialMode)}
            >
              <SelectTrigger className="glass-subtle w-full rounded-2xl border-white/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-strong z-[100] max-h-72 rounded-2xl border-white/70 shadow-2xl backdrop-blur-md">
                <SelectItem value="temp_password">
                  Temporary Password (+ Google SSO)
                </SelectItem>
                <SelectItem value="custom_password">
                  Set Initial Password (+ Google SSO)
                </SelectItem>
                <SelectItem value="google_invite">
                  Google SSO / Email Invite Only
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {credMode === "custom_password" && (
            <Field
              label="Initial password"
              required
              error={errors.customPassword}
              hint="Minimum 8 characters. Active immediately."
            >
              <Input
                type="password"
                value={customPassword}
                onChange={(e) => setCustomPassword(e.target.value)}
                className="glass-subtle rounded-2xl border-white/60"
                placeholder="Min 8 characters"
              />
            </Field>
          )}
        </div>

        {role && (
          <div className="flex items-center gap-2 rounded-2xl border border-sky-200/70 bg-sky-50/70 px-3.5 py-2 text-xs text-sky-900">
            <Info className="h-4 w-4 shrink-0 text-sky-600" />
            <span>{scopeHintForRole(role)}</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Subsidiary">
            <Select
              value={subsidiaryId}
              onValueChange={(v) => {
                setSubsidiaryId(v);
                setBusinessUnitId("ALL");
                setProjectId("ALL");
              }}
            >
              <SelectTrigger className="glass-subtle w-full rounded-2xl border-white/60">
                <SelectValue placeholder="Select subsidiary" />
              </SelectTrigger>
              <SelectContent className="glass-strong z-[100] max-h-72 rounded-2xl border-white/70 shadow-2xl backdrop-blur-md">
                <SelectItem value="ALL">Group level (none)</SelectItem>
                {subsidiaries.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Business unit">
            <Select
              value={businessUnitId}
              onValueChange={(v) => {
                setBusinessUnitId(v);
                setProjectId("ALL");
              }}
            >
              <SelectTrigger className="glass-subtle w-full rounded-2xl border-white/60">
                <SelectValue placeholder="Select business unit" />
              </SelectTrigger>
              <SelectContent className="glass-strong z-[100] max-h-72 rounded-2xl border-white/70 shadow-2xl backdrop-blur-md">
                <SelectItem value="ALL">None</SelectItem>
                {buOptions.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Project / Site">
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="glass-subtle w-full rounded-2xl border-white/60">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent className="glass-strong z-[100] max-h-72 rounded-2xl border-white/70 shadow-2xl backdrop-blur-md">
                <SelectItem value="ALL">None</SelectItem>
                {projectOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>
    </GlassDialog>
  );
}

