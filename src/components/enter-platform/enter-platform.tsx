"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG — ENTER PLATFORM (secure access gateway)
   Left: cinematic sustainability stage + brand story.
   Right: four access portals with role-scoped, server-verified login flows.
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  FileClock,
  Fingerprint,
  HardHat,
  Info,
  KeyRound,
  Loader2,
  LockKeyhole,
  Network,
  ScrollText,
  Search,
  ShieldCheck,
  Workflow,
  X,
} from "lucide-react";
import {
  PORTAL_ROLES,
  ROLES,
  PORTAL_ROLE_LABELS,
  PORTAL_TITLES,
  type PortalId,
  type VerifiedUser,
} from "@/lib/platform-config";
import "./enter-platform.css";

/* ── types ─────────────────────────────────────────────────────────────────── */

interface SubsidiaryOpt {
  id: string;
  code: string;
  name: string;
}

interface BUOpt extends SubsidiaryOpt {
  subsidiaryId: string;
}

interface ProjectOpt {
  id: string;
  code: string;
  name: string;
  location: string;
  subsidiaryName: string;
  businessUnitName: string;
}

interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

/* ── portal catalogue ──────────────────────────────────────────────────────── */

interface PortalDef {
  id: PortalId;
  tier: string;
  accent: "gold" | "teal" | "green" | "amber";
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  title: string;
  desc: string;
  cta: string;
  external?: boolean;
}

const PORTALS: PortalDef[] = [
  {
    id: "group",
    tier: "Tier 01",
    accent: "gold",
    icon: Building2,
    title: "Group Portal",
    desc: "Access group-level ESG reporting, consolidated data, governance, and organization-wide dashboards.",
    cta: "Continue",
  },
  {
    id: "subsidiary",
    tier: "Tier 02",
    accent: "teal",
    icon: Network,
    title: "Subsidiary Portal",
    desc: "Manage subsidiary-level ESG reporting, business units, consolidation, and approvals.",
    cta: "Continue",
  },
  {
    id: "business_unit",
    tier: "Tier 03",
    accent: "green",
    icon: Workflow,
    title: "Business Unit Portal",
    desc: "Manage business-unit-level ESG reporting, performance, and project data consolidation.",
    cta: "Continue",
  },
  {
    id: "project",
    tier: "Tier 04",
    accent: "amber",
    icon: HardHat,
    title: "Project User Portal",
    desc: "Site-operations workspace: ESG data entry, evidence vault, submissions, BRSR mapping and analytics.",
    cta: "Continue",
  },
];

const STEP_LABELS: Record<PortalId, string[]> = {
  group: ["Role", "Credentials"],
  subsidiary: ["Subsidiary", "Role", "Credentials"],
  business_unit: ["Subsidiary", "Business Unit", "Role", "Credentials"],
  project: ["Project", "Role", "Credentials"],
};

/* ═══════════════════════════════════════════════════════════════════════════
   Searchable subsidiary combobox (keyboard + screen-reader accessible)
   ═══════════════════════════════════════════════════════════════════════════ */

function SubsidiaryCombobox({
  label,
  hint,
  required = true,
  value,
  options,
  loading,
  disabled,
  invalid,
  errorText,
  placeholder = "Search subsidiaries…",
  onChange,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  value: SubsidiaryOpt | null;
  options: SubsidiaryOpt[];
  loading?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  errorText?: string;
  placeholder?: string;
  onChange: (opt: SubsidiaryOpt | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useMemo(() => `ep-combo-${Math.random().toString(36).slice(2, 8)}`, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q)
    );
  }, [options, query]);

  /* close on outside interaction */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const openList = () => {
    if (disabled) return;
    setQuery("");
    setActive(0);
    setOpen(true);
  };

  const pick = (opt: SubsidiaryOpt) => {
    onChange(opt);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      openList();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) pick(filtered[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const displayValue = open ? query : value ? value.name : "";

  return (
    <div className={`ep-block${disabled ? " is-disabled" : ""}`}>
      <label className="ep-label" htmlFor={listId + "-input"}>
        <span>
          {label}
          {required && <span className="ep-req">*</span>}
        </span>
        {hint && <span className="ep-hint">{hint}</span>}
      </label>
      <div className="ep-combo" ref={wrapRef}>
        <div style={{ position: "relative" }}>
          <Search
            size={15}
            strokeWidth={2}
            style={{
              position: "absolute",
              left: 15,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--tx-400)",
              pointerEvents: "none",
            }}
          />
          <input
            id={listId + "-input"}
            ref={inputRef}
            className={`ep-combo-input${invalid ? " is-invalid" : ""}`}
            style={{ paddingLeft: 42, paddingRight: value && !open ? 96 : 40, cursor: disabled ? "not-allowed" : "text" }}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && filtered[active] ? `${listId}-opt-${active}` : undefined}
            autoComplete="off"
            disabled={disabled}
            placeholder={disabled ? "Select a subsidiary first" : placeholder}
            value={displayValue}
            onFocus={openList}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(0);
              if (value) onChange(null);
            }}
            onKeyDown={onKey}
          />
          {value && !open && (
            <span className="ep-combo-value">
              <span className="ep-combo-code">{value.code}</span>
            </span>
          )}
          {!open && (
            <ChevronDown
              size={16}
              style={{
                position: "absolute",
                right: 16,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--tx-400)",
                pointerEvents: "none",
              }}
            />
          )}
        </div>

        {open && (
          <ul
            className="ep-combo-list"
            id={listId}
            role="listbox"
            aria-label={label}
            style={{ ["--ep-accent" as string]: "var(--gold-400)" }}
          >
            {loading ? (
              <li className="ep-combo-empty" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Loader2 size={14} className="ep-spin" style={{ animation: "ep-spin 0.7s linear infinite" }} />
                Loading subsidiaries…
              </li>
            ) : filtered.length === 0 ? (
              <li className="ep-combo-empty">No subsidiaries match “{query}”.</li>
            ) : (
              filtered.map((opt, i) => (
                <li key={opt.id} role="none">
                  <button
                    type="button"
                    id={`${listId}-opt-${i}`}
                    role="option"
                    aria-selected={value?.id === opt.id}
                    className={`ep-combo-opt${i === active ? " is-active" : ""}`}
                    onMouseEnter={() => setActive(i)}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => pick(opt)}
                  >
                    <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span>{opt.name}</span>
                      {value?.id === opt.id && (
                        <span style={{ fontSize: 10, color: "var(--gold-600)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>
                          SELECTED
                        </span>
                      )}
                    </span>
                    <span className="ep-combo-code">{opt.code}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      {errorText && (
        <div className="ep-field-err" role="alert">
          <AlertCircle size={13} /> {errorText}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Portal login workflow (per-portal state machine)
   ═══════════════════════════════════════════════════════════════════════════ */

function PortalFlow({
  portal,
  subsidiaries,
  subsidiariesLoading,
  onBackToPortals,
  onAuthed,
}: {
  portal: PortalId;
  subsidiaries: SubsidiaryOpt[] | null;
  subsidiariesLoading: boolean;
  onBackToPortals: () => void;
  onAuthed: (user: VerifiedUser) => void;
}) {
  const def = PORTALS.find((p) => p.id === portal) as PortalDef;
  const needsSubs = portal === "subsidiary" || portal === "business_unit";

  /* selection + credentials state */
  const [subsidiary, setSubsidiary] = useState<SubsidiaryOpt | null>(null);
  const [businessUnits, setBusinessUnits] = useState<BUOpt[]>([]);
  const [buLoading, setBuLoading] = useState(false);
  const [businessUnit, setBusinessUnit] = useState<BUOpt | null>(null);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [project, setProject] = useState<ProjectOpt | null>(null);
  const [role, setRole] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("demo");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);

  /* ui state */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<VerifiedUser | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotId, setForgotId] = useState("");

  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (successTimer.current) clearTimeout(successTimer.current); }, []);

  /* Project portal — load the active project list once */
  useEffect(() => {
    if (portal !== "project") return;
    let cancelled = false;
    setProjectLoading(true);
    fetch("/api/master/projects")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setProjects(d.projects ?? []); })
      .catch(() => { if (!cancelled) setProjects([]); })
      .finally(() => { if (!cancelled) setProjectLoading(false); });
    return () => { cancelled = true; };
  }, [portal]);

  /* changing subsidiary clears everything downstream (spec §4) */
  const selectSubsidiary = useCallback(
    (opt: SubsidiaryOpt | null) => {
      setSubsidiary(opt);
      setBusinessUnit(null);
      setBusinessUnits([]);
      setRole("");
      setEmployeeId("");
      setPassword("demo");
      setError(null);
      setFieldErrors({});
      setForgotMsg("");
      if (portal === "business_unit" && opt) {
        setBuLoading(true);
        fetch(`/api/master/business-units?subsidiaryId=${encodeURIComponent(opt.id)}`)
          .then((r) => r.json())
          .then((d) => setBusinessUnits(d.businessUnits ?? []))
          .catch(() => setBusinessUnits([]))
          .finally(() => setBuLoading(false));
      }
    },
    [portal]
  );

  /* changing business unit clears role + credentials (spec §5) */
  const selectBusinessUnit = useCallback((opt: BUOpt | null) => {
    setBusinessUnit(opt);
    setRole("");
    setEmployeeId("");
    setPassword("demo");
    setError(null);
    setFieldErrors({});
  }, []);

  /* changing project clears role + credentials (same cascade rules) */
  const selectProject = useCallback((opt: ProjectOpt | null) => {
    setProject(opt);
    setRole("");
    setEmployeeId("");
    setPassword("demo");
    setError(null);
    setFieldErrors({});
  }, []);

  const changeRole = (v: string) => {
    setRole(v);
    setError(null);
    setFieldErrors((f) => ({ ...f, role: "" }));
  };

  /* stepper status */
  const steps = STEP_LABELS[portal];
  const doneCount = useMemo(() => {
    if (portal === "group") return role ? 1 : 0;
    if (portal === "subsidiary") return role ? 2 : subsidiary ? 1 : 0;
    if (portal === "project") return role ? 2 : project ? 1 : 0;
    return role ? 3 : businessUnit ? 2 : subsidiary ? 1 : 0;
  }, [portal, role, subsidiary, businessUnit, project]);

  /* client-side required-field validation */
  const validate = (): boolean => {
    const fe: Record<string, string> = {};
    if (needsSubs && !subsidiary) fe.subsidiaryId = "Please select your subsidiary.";
    if (portal === "business_unit" && !businessUnit)
      fe.businessUnitId = "Please select your business unit.";
    if (portal === "project" && !project)
      fe.projectId = "Please select your project.";
    if (!role) fe.role = "Please select your role.";
    if (!employeeId.trim()) fe.employeeId = "Employee ID or email is required.";
    if (!password) fe.password = "Password is required.";
    setFieldErrors(fe);
    return Object.keys(fe).length === 0;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || success) return; // prevent duplicate submissions
    setError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portal,
          role,
          employeeId: employeeId.trim(),
          password,
          subsidiaryId: subsidiary?.id,
          businessUnitId: businessUnit?.id,
          projectId: project?.id,
          rememberMe: remember,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError({ code: data.code ?? "ERROR", message: data.message ?? "Sign-in failed. Please try again.", fields: data.fields });
        if (data.fields) setFieldErrors((f) => ({ ...f, ...data.fields }));
        setLoading(false);
        return;
      }
      const user = data.user as VerifiedUser;
      setSuccess(user);
      setLoading(false);
      successTimer.current = setTimeout(() => onAuthed(user), 1500);
    } catch {
      setError({ code: "NETWORK", message: "Could not reach the secure gateway. Check your connection and try again." });
      setLoading(false);
    }
  };

  const sendForgot = async () => {
    if (forgotLoading) return;
    if (!forgotId.trim()) {
      setForgotMsg("Enter your Employee ID or email first.");
      return;
    }
    setForgotLoading(true);
    setForgotMsg("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: forgotId.trim() }),
      });
      const data = await res.json();
      setForgotMsg(
        data.ok
          ? data.message
          : data.message ?? "Could not submit the request. Please try again."
      );
    } catch {
      setForgotMsg("Could not submit the request. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const roleOptions: Array<[string, string]> =
    portal === "group"
      ? [
          ["GROUP_ADMIN", PORTAL_ROLE_LABELS.group.admin],
          ["ORG_MANAGER", PORTAL_ROLE_LABELS.group.manager],
        ]
      : portal === "subsidiary"
        ? [
            ["SUBSIDIARY_ADMIN", PORTAL_ROLE_LABELS.subsidiary.admin],
            ["SUBSIDIARY_MANAGER", PORTAL_ROLE_LABELS.subsidiary.manager],
          ]
        : portal === "project"
          ? (PORTAL_ROLES.project as readonly string[]).map((code) => [
              code,
              (ROLES as Record<string, string>)[code] ?? code,
            ])
          : [
              ["BU_ADMIN", PORTAL_ROLE_LABELS.business_unit.admin],
              ["BU_MANAGER", PORTAL_ROLE_LABELS.business_unit.manager],
            ];

  const roleDisabled =
    (portal === "subsidiary" && !subsidiary) ||
    (portal === "business_unit" && !businessUnit) ||
    (portal === "project" && !project);

  const credsReady =
    portal === "group"
      ? !!role
      : portal === "subsidiary"
        ? !!role && !!subsidiary
        : portal === "project"
          ? !!role && !!project
          : !!role && !!businessUnit;

  return (
    <div className="ep-flow" style={{ ["--ep-accent" as string]: `var(--${def.accent === "gold" ? "gold-400" : def.accent === "teal" ? "teal-400" : def.accent === "green" ? "green-400" : "gold-400"})` }}>
      {/* header */}
      <div className="ep-flow-head">
        <span className="ep-card-ico" style={{ ["--ep-accent" as string]: `var(--${def.accent === "teal" ? "teal-400" : def.accent === "green" ? "green-400" : "gold-400"})` }}>
          <def.icon size={23} strokeWidth={1.8} />
        </span>
        <div>
          <b>{PORTAL_TITLES[portal]}</b>
          <small>Secure Login · {def.tier}</small>
        </div>
      </div>

      {/* stepper */}
      <ol className="ep-steps" aria-label="Login steps">
        {steps.map((label, i) => (
          <li key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              className={`ep-step${i < doneCount ? " is-done" : i === doneCount ? " is-active" : ""}`}
              aria-current={i === doneCount ? "step" : undefined}
            >
              <span className="ep-step-n">{i < doneCount ? <Check size={9} strokeWidth={3} /> : i + 1}</span>
              {label}
            </span>
            {i < steps.length - 1 && <span className="ep-step-sep" aria-hidden />}
          </li>
        ))}
      </ol>

      {error && (
        <div className="ep-alert" role="alert">
          <AlertCircle size={16} strokeWidth={2.1} />
          <span>{error.message}</span>
        </div>
      )}

      <form onSubmit={submit} noValidate>
        {/* STEP 1 — project (Project User portal) */}
        {portal === "project" && (
          <div className="ep-block">
            <label className="ep-label" htmlFor="ep-project-select">
              <span>
                Select Project / Site<span className="ep-req">*</span>
              </span>
              <span className="ep-hint">
                {projectLoading
                  ? "Loading projects…"
                  : project
                    ? `${project.subsidiaryName} · ${project.businessUnitName}`
                    : `${projects.length} active sites`}
              </span>
            </label>
            <div className="ep-select-wrap">
              <select
                id="ep-project-select"
                className={`ep-select${fieldErrors.projectId ? " is-invalid" : ""}`}
                value={project?.id ?? ""}
                disabled={projectLoading}
                onChange={(e) => selectProject(projects.find((p) => p.id === e.target.value) ?? null)}
                aria-describedby={fieldErrors.projectId ? "ep-project-err" : undefined}
              >
                <option value="">
                  {projectLoading ? "Loading projects…" : project ? "" : "Choose your project…"}
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.subsidiaryName}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} strokeWidth={2.2} />
            </div>
            {fieldErrors.projectId && (
              <div className="ep-field-err" id="ep-project-err" role="alert">
                <AlertCircle size={13} /> {fieldErrors.projectId}
              </div>
            )}
          </div>
        )}

        {/* STEP 1 — subsidiary (subsidiary & BU portals) */}
        {needsSubs && (
          <SubsidiaryCombobox
            label="Select Subsidiary"
            hint="Searchable · active entities"
            value={subsidiary}
            options={subsidiaries ?? []}
            loading={subsidiariesLoading}
            invalid={!!fieldErrors.subsidiaryId}
            errorText={fieldErrors.subsidiaryId}
            onChange={selectSubsidiary}
          />
        )}

        {/* STEP 2 — business unit (BU portal only, strictly dependent) */}
        {portal === "business_unit" && (
          <div className={`ep-block${!subsidiary ? " is-disabled" : ""}`}>
            <label className="ep-label" htmlFor="ep-bu-select">
              <span>
                Select Business Unit<span className="ep-req">*</span>
              </span>
              <span className="ep-hint">{subsidiary ? `${businessUnits.length} unit${businessUnits.length === 1 ? "" : "s"} in ${subsidiary.code}` : "Select a subsidiary first"}</span>
            </label>
            <div className="ep-select-wrap">
              <select
                id="ep-bu-select"
                className={`ep-select${fieldErrors.businessUnitId ? " is-invalid" : ""}`}
                value={businessUnit?.id ?? ""}
                disabled={!subsidiary || buLoading}
                onChange={(e) => selectBusinessUnit(businessUnits.find((b) => b.id === e.target.value) ?? null)}
                aria-describedby={fieldErrors.businessUnitId ? "ep-bu-err" : undefined}
              >
                <option value="">{buLoading ? "Loading business units…" : businessUnit ? "" : "Choose business unit…"}</option>
                {businessUnits.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} strokeWidth={2.2} />
            </div>
            {fieldErrors.businessUnitId && (
              <div className="ep-field-err" id="ep-bu-err" role="alert">
                <AlertCircle size={13} /> {fieldErrors.businessUnitId}
              </div>
            )}
          </div>
        )}

        {/* STEP 3 — role */}
        <div className={`ep-block${roleDisabled ? " is-disabled" : ""}`}>
          <label className="ep-label" htmlFor="ep-role-select">
            <span>
              Select {portal === "group" ? "Group" : portal === "subsidiary" ? "Subsidiary" : portal === "project" ? "Project" : "Business Unit"} Role<span className="ep-req">*</span>
            </span>
            <span className="ep-hint">Verified server-side</span>
          </label>
          <div className="ep-select-wrap">
            <select
              id="ep-role-select"
              className={`ep-select${fieldErrors.role ? " is-invalid" : ""}`}
              value={role}
              disabled={roleDisabled}
              onChange={(e) => changeRole(e.target.value)}
            >
              <option value="">Choose your role…</option>
              {roleOptions.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown size={16} strokeWidth={2.2} />
          </div>
          {fieldErrors.role && (
            <div className="ep-field-err" role="alert">
              <AlertCircle size={13} /> {fieldErrors.role}
            </div>
          )}
        </div>

        {/* STEP 4 — credentials */}
        <div className={`ep-block${!credsReady ? " is-disabled" : ""}`}>
          <label className="ep-label" htmlFor="ep-emp-id">
            <span>
              Employee ID / Email<span className="ep-req">*</span>
            </span>
          </label>
          <input
            id="ep-emp-id"
            className={`ep-input mono${fieldErrors.employeeId ? " is-invalid" : ""}`}
            type="text"
            inputMode="text"
            autoCapitalize="off"
            autoComplete="username"
            spellCheck={false}
            disabled={!credsReady}
            placeholder="e.g. GRP-0001 or arun.bhaskar@meil.in"
            value={employeeId}
            onChange={(e) => {
              setEmployeeId(e.target.value);
              setFieldErrors((f) => ({ ...f, employeeId: "" }));
            }}
          />
          {fieldErrors.employeeId && (
            <div className="ep-field-err" role="alert">
              <AlertCircle size={13} /> {fieldErrors.employeeId}
            </div>
          )}

          <label className="ep-label" htmlFor="ep-pw" style={{ marginTop: 16 }}>
            <span>
              Password<span className="ep-req">*</span>
            </span>
          </label>
          <div className="ep-pw-wrap">
            <input
              id="ep-pw"
              className={`ep-input${fieldErrors.password ? " is-invalid" : ""}`}
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              disabled={!credsReady}
              placeholder="demo"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((f) => ({ ...f, password: "" }));
              }}
            />
            <button
              type="button"
              className="ep-pw-toggle"
              aria-label={showPw ? "Hide password" : "Show password"}
              aria-pressed={showPw}
              disabled={!credsReady}
              onClick={() => setShowPw((s) => !s)}
            >
              {showPw ? <EyeOff size={17} strokeWidth={1.9} /> : <Eye size={17} strokeWidth={1.9} />}
            </button>
          </div>
          {fieldErrors.password && (
            <div className="ep-field-err" role="alert">
              <AlertCircle size={13} /> {fieldErrors.password}
            </div>
          )}

          <div className="ep-row" style={{ marginTop: 16 }}>
            <label className="ep-check">
              <input
                type="checkbox"
                checked={remember}
                disabled={!credsReady}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember me for 30 days
            </label>
            <button
              type="button"
              className="ep-link"
              onClick={() => setForgotOpen((o) => !o)}
              aria-expanded={forgotOpen}
              style={{ pointerEvents: "auto" }}
            >
              Forgot Password?
            </button>
          </div>
        </div>

        {/* forgot password — always available, self-contained employee-id input */}
        {forgotOpen && (
          <div className="ep-forgot">
            <p>
              Enter your Employee ID or registered email below and we will issue
              reset instructions to your business email. Every request is recorded
              on the audit trail.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                className="ep-input mono"
                style={{ flex: "1 1 220px" }}
                type="text"
                placeholder="Employee ID / Email"
                aria-label="Employee ID or email for password reset"
                value={forgotId}
                onChange={(e) => {
                  setForgotId(e.target.value);
                  setForgotMsg("");
                }}
              />
              <button
                type="button"
                className="ep-btn"
                style={{ width: "auto", padding: "12px 22px", fontSize: 13 }}
                onClick={sendForgot}
                disabled={forgotLoading}
              >
                {forgotLoading ? (
                  <>
                    <span className="ep-spinner" aria-hidden />
                    Submitting…
                  </>
                ) : (
                  "Request Reset"
                )}
              </button>
            </div>
            {forgotMsg && (
              <div className="ep-forgot-msg" role="status" style={{ marginTop: 12 }}>
                {forgotMsg}
              </div>
            )}
          </div>
        )}

        {/* actions */}
        <div className="ep-block">
          <button type="submit" className="ep-btn" disabled={loading || !!success}>
            {loading ? (
              <>
                <span className="ep-spinner" aria-hidden />
                Verifying credentials…
              </>
            ) : (
              <>
                <LockKeyhole size={16} strokeWidth={2.3} />
                Login
              </>
            )}
          </button>
          <button type="button" className="ep-btn ep-btn-ghost" style={{ marginTop: 10 }} onClick={onBackToPortals} disabled={loading}>
            <ArrowLeft size={15} strokeWidth={2.2} />
            Back to All Portals
          </button>
          <div className="ep-form-foot">
            <ShieldCheck size={13} strokeWidth={2.1} />
            Zero-trust verification · Role-scoped · Audit logged
          </div>
        </div>
      </form>

      {/* success overlay */}
      {success && (
        <div className="ep-success" role="status" aria-live="polite">
          <div className="ep-success-card glass-dark glass-edge">
            <span className="ep-success-ring">
              <CheckCircle2 size={30} strokeWidth={2.1} />
            </span>
            <b>Access Granted</b>
            <p>
              Verified as <strong style={{ color: "var(--gold-600)" }}>{success.roleLabel}</strong>
              {success.scope.subsidiary ? ` · ${success.scope.subsidiary.name}` : ""}
              {success.scope.businessUnit ? ` · ${success.scope.businessUnit.name}` : ""}
              <br />
              Opening your dashboard…
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Root — stage + panel
   ═══════════════════════════════════════════════════════════════════════════ */

const BENEFITS = [
  {
    icon: ShieldCheck,
    accent: "var(--gold-400)",
    title: "Role-Based Access Control",
    desc: "Every credential is scoped on the server — group, subsidiary and business-unit boundaries are enforced per request, never in the browser.",
  },
  {
    icon: BarChart3,
    accent: "var(--teal-400)",
    title: "Centralized ESG Reporting",
    desc: "Scope 1, 2 & 3 emissions, water, safety and social indicators consolidate through one engine aligned to CEA factors and the GHG Protocol.",
  },
  {
    icon: FileClock,
    accent: "var(--green-400)",
    title: "Traceable Audit Trail",
    desc: "Every submission, approval and sign-in is written to an immutable chain of custody with timestamped evidentiary documentation.",
  },
  {
    icon: ScrollText,
    accent: "var(--gold-400)",
    title: "BRSR Principles 1–9",
    desc: "Full alignment to the NGRBC nine principles with SEBI BRSR Core indicator mapping and XBRL disclosure-ready outputs.",
  },
] as const;

const DEMO_ACCOUNTS: Array<[string, string, string]> = [
  ["Group", "GRP-0001", "Group Admin · Arun Bhaskar"],
  ["Subsidiary", "SUB-1001", "Subsidiary Manager · MEIL Energy"],
  ["Subsidiary", "SUB-1002", "Subsidiary Admin · MEIL Energy"],
  ["Business Unit", "BU-1001", "BU Manager · Thermal"],
  ["Business Unit", "BU-3002", "BU Admin · Water Supply"],
  ["Project", "PRJ-ADMIN", "Project Admin · Zojila Tunnel Project"],
  ["Project", "ENV-1001", "Site Data Entry · Pavagada Solar Park"],
  ["Project", "FIN-1001", "Finance & Resource · Kothagudem Thermal"],
  ["Project", "EHS-1001", "EHS Officer · Kothagudem Thermal"],
  ["Project", "HR-1001", "HR / Workforce · NH-48 Highway"],
  ["Project", "ANA-1001", "ESG Analyst · Group-wide"],
];

export default function EnterPlatform({
  onBack,
  onAuthed,
  onEnterProjectPortal,
}: {
  onBack: () => void;
  onAuthed: (user: VerifiedUser) => void;
  /* Project User Portal → straight into the portal's own welcome flow
     (org → project → role → portal sign-in), skipping the gateway wizard. */
  onEnterProjectPortal?: () => void;
}) {
  const [view, setView] = useState<PortalId | null>(null);
  const [subsidiaries, setSubsidiaries] = useState<SubsidiaryOpt[] | null>(null);
  const [subsLoading, setSubsLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /* master data is fetched from the backend when a scoped portal opens */
  const loadSubsidiaries = useCallback(() => {
    if (subsidiaries || subsLoading) return;
    setSubsLoading(true);
    fetch("/api/master/subsidiaries")
      .then((r) => r.json())
      .then((d) => setSubsidiaries(d.subsidiaries ?? []))
      .catch(() => setSubsidiaries([]))
      .finally(() => setSubsLoading(false));
  }, [subsidiaries, subsLoading]);

  const openPortal = (p: PortalDef) => {
    setNotice(null);
    if (p.id === "project") {
      /* The Project User Portal has its own native welcome experience —
         open it directly instead of the gateway credential wizard. */
      if (onEnterProjectPortal) {
        onEnterProjectPortal();
        return;
      }
    }
    if (p.id === "subsidiary" || p.id === "business_unit") loadSubsidiaries();
    setView(p.id);
  };

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [view]);

  return (
    <div className="ep-root">
      <div className="ep-bubbles" aria-hidden="true">
        <span className="ep-bubble ep-bubble-1" />
        <span className="ep-bubble ep-bubble-2" />
        <span className="ep-bubble ep-bubble-3" />
        <span className="ep-bubble ep-bubble-4" />
      </div>
      <div className="ep-grid">
        {/* ═══ LEFT — STAGE ═══ */}
        <aside className="ep-stage">
          <div className="ep-stage-media" aria-hidden>
            <img src="/meil_kaleshwaram_project.jpg" alt="" />
          </div>

          {/* decorative ambience — aura glows + floating glass bubbles */}
          <div className="ep-stage-aura" aria-hidden>
            <span className="ep-aura ep-aura-a" />
            <span className="ep-aura ep-aura-b" />
            <span className="ep-stage-bubble ep-sb-1" />
            <span className="ep-stage-bubble ep-sb-2" />
            <span className="ep-stage-bubble ep-sb-3" />
          </div>

          <div className="ep-stage-content">
            <div className="ep-brand">
              <span className="ep-brand-mark">M</span>
              <span className="ep-brand-text">
                <b>MEIL Group</b>
                <small>BRSR &amp; ESG Intelligence</small>
              </span>
              <span className="ep-secure-chip">
                <span className="ep-pulse" aria-hidden />
                Zero-Trust Gateway
              </span>
            </div>

            <div className="ep-stage-heading">
              <span className="ep-eyebrow">Secure Access · Enter Platform</span>
              <h1 className="ep-title">
                Enterprise <em>Sustainability</em> Management System
              </h1>
              <p className="ep-lede">
                One governed ledger for <strong>Megha Engineering &amp; Infrastructures</strong> —
                BRSR Core indicators, CEA emission factors and assurance-grade evidence,
                consolidated from every subsidiary, business unit and project site into
                board-ready disclosure.
              </p>
            </div>

            <div className="ep-benefits">
              {BENEFITS.map((b) => (
                <div className="ep-benefit" key={b.title} style={{ ["--ep-accent" as string]: b.accent }}>
                  <span className="ep-benefit-ico">
                    <b.icon size={19} strokeWidth={1.9} />
                  </span>
                  <div>
                    <b>{b.title}</b>
                    <p>{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="ep-trust">
              <span className="ep-trust-chip">
                <ShieldCheck size={12} strokeWidth={2.2} /> ISO 27001 Aligned
              </span>
              <span className="ep-trust-chip">
                <BadgeCheck size={12} strokeWidth={2.2} /> SEBI BRSR Core
              </span>
              <span className="ep-trust-chip">
                <LockKeyhole size={12} strokeWidth={2.2} /> 256-bit Encrypted
              </span>
            </div>
          </div>

          <div className="ep-stage-foot">
            <span>© Megha Engineering &amp; Infrastructures Ltd</span>
            <span>Kaleshwaram Lift Irrigation · Telangana</span>
          </div>
        </aside>

        {/* ═══ RIGHT — GATEWAY PANEL ═══ */}
        <main className="ep-panel-zone">
          <div className="aurora aurora-a" aria-hidden />
          <div className="aurora aurora-b" aria-hidden />

          <div className="ep-panel glass-dark glass-edge noise" ref={panelRef}>
            <div className="ep-topbar">
              <button
                type="button"
                className="ep-back"
                onClick={() => (view ? setView(null) : onBack())}
              >
                <ArrowLeft size={15} strokeWidth={2.2} />
                {view ? "Back to Portals" : "Back to Site"}
              </button>
              <span className="ep-status">
                <Fingerprint size={13} strokeWidth={1.9} />
                Secure Gateway · TLS 1.3
              </span>
            </div>

            {view === null ? (
              /* ── PORTAL CHOOSER ── */
              <div className="ep-flow">
                <div className="ep-panel-heading">
                  <span className="ep-eyebrow">Access Portals</span>
                  <h2>
                    Choose Your <em>Access Portal</em>
                  </h2>
                  <p>
                    Select your organizational level to continue to secure login. Authorization
                    is always verified against your assigned role and scope.
                  </p>
                </div>

                {notice && (
                  <div className="ep-notice" role="status" aria-live="polite">
                    <Info size={16} strokeWidth={2} />
                    <span>{notice}</span>
                    <button type="button" aria-label="Dismiss notice" onClick={() => setNotice(null)}>
                      <X size={14} strokeWidth={2.2} />
                    </button>
                  </div>
                )}

                <div className="ep-cards">
                  {PORTALS.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      className="ep-card sweep"
                      data-accent={p.accent}
                      style={{ ["--i" as string]: i }}
                      onClick={() => openPortal(p)}
                      aria-label={`${p.title}${p.external ? " (opens external site)" : ""}`}
                    >
                      <span className="ep-card-top">
                        <span className="ep-card-ico">
                          <p.icon size={22} strokeWidth={1.8} />
                        </span>
                        <span className="ep-card-tier">{p.tier}</span>
                      </span>
                      <b>{p.title}</b>
                      <p>{p.desc}</p>
                      <span className="ep-card-cta">
                        {p.cta}
                        {p.external ? (
                          <ExternalLink size={13} strokeWidth={2.2} />
                        ) : (
                          <ArrowRight size={13} strokeWidth={2.4} />
                        )}
                      </span>
                    </button>
                  ))}
                </div>

                <details className="ep-demo">
                  <summary>
                    <Info size={13} strokeWidth={2} />
                    Demo environment · seeded credentials
                  </summary>
                  <table className="ep-demo-table">
                    <thead>
                      <tr>
                        <th>Portal</th>
                        <th>Employee ID</th>
                        <th>Assigned role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DEMO_ACCOUNTS.map(([portal, emp, role]) => (
                        <tr key={emp}>
                          <td>{portal}</td>
                          <td>{emp}</td>
                          <td>{role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p style={{ marginTop: 10, fontSize: 11, color: "var(--tx-500)", fontFamily: "var(--font-mono)" }}>
                    Password for all demo accounts: <span style={{ color: "var(--gold-600)" }}>demo</span> · master data is configurable in <span style={{ color: "var(--gold-600)" }}>prisma/seed.ts</span>
                  </p>
                </details>
              </div>
            ) : (
              /* ── PORTAL WORKFLOW ── */
              <PortalFlow
                portal={view}
                subsidiaries={subsidiaries}
                subsidiariesLoading={subsLoading}
                onBackToPortals={() => setView(null)}
                onAuthed={onAuthed}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
