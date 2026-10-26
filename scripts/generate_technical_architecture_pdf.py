#!/usr/bin/env python3
"""Generate an evidence-based technical architecture report for the MEIL ESG app."""

from __future__ import annotations

import os
import re
import sqlite3
import sys
from datetime import datetime, timezone
from html import escape
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
RUNTIME_DB = ROOT / "db" / "custom.db"
SECONDARY_DB = ROOT / "prisma" / "db" / "custom.db"
OUTPUT = ROOT / "download" / "MEIL-ESG-Technical-Architecture-Report.pdf"

PRIMARY = colors.HexColor("#123b5d")
BLUE = colors.HexColor("#1d6fa5")
TEAL = colors.HexColor("#0f766e")
INK = colors.HexColor("#172033")
MUTED = colors.HexColor("#526174")
LIGHT = colors.HexColor("#eef5f8")
PALE = colors.HexColor("#f7fafc")
LINE = colors.HexColor("#cbd5e1")
AMBER = colors.HexColor("#92400e")


ROLE_WORK = {
    "SUPER_ADMIN": "Administers users, roles, organization, projects, configuration, security, and all workflows.",
    "PROJECT_USER": "Enters site/project ESG source data, uploads evidence, submits records, and tracks project reporting.",
    "FINANCE_USER": "Collects financial turnover, CapEx/OpEx, resource expenditure, supporting evidence, and submissions.",
    "HR_USER": "Maintains workforce, training, wellbeing, human-rights, and workforce evidence data.",
    "EHS_USER": "Maintains safety incidents, inspections, corrective actions, environmental, energy, water, waste, and safety evidence.",
    "PROCUREMENT_USER": "Maintains suppliers, assessments, sustainable sourcing, transactions, and value-chain data.",
    "CSR_USER": "Maintains CSR projects, budgets, beneficiaries, impact, community engagement, and local sourcing data.",
    "COMPLIANCE_USER": "Maintains policies, obligations, controls, cases, ethics, and the regulatory calendar.",
    "BU_REVIEWER": "Reviews business-unit submissions, evidence, exceptions, and performs BU approval or rejection.",
    "SUBSIDIARY_REVIEWER": "Reviews subsidiary consolidation, BRSR impact, evidence, and subsidiary approvals.",
    "GROUP_REVIEWER": "Performs group consolidation, enterprise review, assurance review, final BRSR review, and locking.",
    "ESG_MANAGER": "Owns ESG KPI quality, completeness, material risks, targets, cross-functional review, and methodology oversight.",
    "ESG_ANALYST": "Explores ESG data, metrics, emissions, energy/resources, social/governance trends, variance, and quality.",
    "BRSR_MANAGER": "Configures frameworks, manages Sections A/B/C and BRSR Core mappings, readiness, report building, and issuance.",
    "AUDITOR": "Performs assurance engagements, scope/materiality, evidence testing, BRSR testing, findings, requests, and reports.",
    "EXECUTIVE": "Consumes enterprise ESG, BRSR readiness, strategic risk, trends, business-unit, assurance, and report dashboards.",
}


ROLE_PERMISSIONS = {
    "PROJECT_USER": "organization.read, project.read, esg.energy.write, esg.water.write, esg.waste.write, esg.people.write, esg.safety.write, esg.travel.write, evidence.upload, evidence.read, submission.submit, brsr.read, report.read, audit.read",
    "FINANCE_USER": "organization.read, project.read, esg.travel.write, evidence.upload, evidence.read, submission.submit, brsr.read, report.read, audit.read",
    "HR_USER": "organization.read, project.read, esg.people.write, evidence.upload, evidence.read, submission.submit, brsr.read, report.read, audit.read",
    "EHS_USER": "organization.read, project.read, esg.safety.write, esg.energy.write, esg.water.write, esg.waste.write, evidence.upload, evidence.read, submission.submit, brsr.read, report.read, audit.read",
    "PROCUREMENT_USER": "organization.read, project.read, esg.travel.write, evidence.upload, evidence.read, submission.submit, brsr.read, report.read, audit.read",
    "CSR_USER": "organization.read, project.read, evidence.upload, evidence.read, submission.submit, brsr.read, report.read, audit.read",
    "COMPLIANCE_USER": "organization.read, project.read, evidence.read, submission.submit, brsr.read, report.read, audit.read",
    "BU_REVIEWER": "organization.read, project.read, submission.review, submission.reject, submission.approve, evidence.read, evidence.verify, brsr.read, report.read, audit.read",
    "SUBSIDIARY_REVIEWER": "organization.read, project.read, submission.review, submission.approve, evidence.read, brsr.read, report.read, audit.read",
    "GROUP_REVIEWER": "organization.read, project.read, submission.review, submission.approve, submission.lock, evidence.read, brsr.read, brsr.generate, report.read, report.generate, audit.read",
    "ESG_MANAGER": "organization.read, project.read, evidence.read, brsr.read, report.read, audit.read",
    "ESG_ANALYST": "organization.read, project.read, brsr.read, report.read",
    "BRSR_MANAGER": "organization.read, project.read, brsr.read, brsr.generate, brsr.configure, report.read, report.generate, audit.read",
    "AUDITOR": "organization.read, project.read, evidence.read, brsr.read, report.read, audit.read",
    "EXECUTIVE": "organization.read, project.read, brsr.read, report.read",
}


def db_rows(db: sqlite3.Connection, query: str):
    return db.execute(query).fetchall()


def load_snapshot():
    conn = sqlite3.connect(RUNTIME_DB)
    conn.row_factory = sqlite3.Row
    tables = [r[0] for r in db_rows(conn, "select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name")]
    counts = {table: conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0] for table in tables}
    scope_names = {}
    for table, label_column in (("Group", "name"), ("Subsidiary", "name"), ("BusinessUnit", "name"), ("Project", "projectName")):
        for row in conn.execute(f'SELECT id, "{label_column}" FROM "{table}"'):
            scope_names[row[0]] = row[1]
    users = []
    query = '''
        SELECT u.name, u.email, u.employeeCode, u.status, u.demo,
               r.key AS role_key, r.name AS role_name, r.phase,
               s.scopeType, s.scopeId
        FROM "User" u
        LEFT JOIN "UserRole" ur ON ur.userId = u.id
        LEFT JOIN "Role" r ON r.id = ur.roleId
        LEFT JOIN "UserScope" s ON s.userId = u.id
        ORDER BY u.name, u.email
    '''
    for row in conn.execute(query):
        users.append(dict(row))
    projects = [dict(row) for row in conn.execute('''
        SELECT g.name AS group_name, s.name AS subsidiary, b.name AS business_unit,
               p.projectCode, p.projectName, p.location, p.status
        FROM "Project" p
        JOIN "BusinessUnit" b ON b.id = p.businessUnitId
        JOIN "Subsidiary" s ON s.id = b.subsidiaryId
        JOIN "Group" g ON g.id = s.groupId
        ORDER BY p.projectCode
    ''')]
    for user in users:
        user["scope_name"] = scope_names.get(user["scopeId"], "") if user["scopeId"] else "Group-wide / unrestricted"
    submissions = [dict(row) for row in conn.execute('''
        SELECT status, COUNT(*) AS total FROM "Submission" GROUP BY status ORDER BY status
    ''')]
    conn.close()
    return counts, users, projects, submissions


def count_files():
    patterns = {
        "TypeScript/TSX source files": "src/**/*.ts",
        "React TSX source files": "src/**/*.tsx",
        "API route files": "src/app/api/**/route.ts",
        "Dashboard components": "src/components/dashboard/*.tsx",
        "Workspace modules": "src/components/modules/*.tsx",
        "UI primitives": "src/components/ui/*.tsx",
    }
    result = {}
    for label, pattern in patterns.items():
        result[label] = len(list(ROOT.glob(pattern)))
    return result


def p(text, style):
    return Paragraph(escape(str(text)).replace("\n", "<br/>"), style)


def rich(text, style):
    return Paragraph(text, style)


def table(headers, rows, widths=None, font_size=7.2):
    data = [[rich(f"<b>{escape(str(h))}</b>", STYLES["th"]) for h in headers]]
    for row in rows:
        data.append([p(value, STYLES["td"]) for value in row])
    t = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def section(title, body=None):
    items = [Paragraph(title, STYLES["h2"])]
    if body:
        items.append(rich(body, STYLES["body"]))
    return items


def bullet(text):
    return rich(f"• {escape(text)}", STYLES["body"])


def page_header_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(16 * mm, 13 * mm, A4[0] - 16 * mm, 13 * mm)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(16 * mm, 8 * mm, "MEIL ESG / BRSR Technical Architecture Report")
    canvas.drawRightString(A4[0] - 16 * mm, 8 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_report():
    global STYLES
    styles = getSampleStyleSheet()
    STYLES = {
        "title": ParagraphStyle("ReportTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=24, leading=28, textColor=PRIMARY, spaceAfter=7),
        "subtitle": ParagraphStyle("ReportSubtitle", parent=styles["Normal"], fontSize=10, leading=14, textColor=MUTED, spaceAfter=12),
        "h1": ParagraphStyle("H1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=16, leading=19, textColor=PRIMARY, spaceBefore=8, spaceAfter=7),
        "h2": ParagraphStyle("H2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=11.5, leading=14, textColor=BLUE, spaceBefore=9, spaceAfter=5),
        "body": ParagraphStyle("Body", parent=styles["BodyText"], fontSize=8.8, leading=12, textColor=INK, spaceAfter=5),
        "small": ParagraphStyle("Small", parent=styles["BodyText"], fontSize=7.2, leading=9.2, textColor=MUTED, spaceAfter=3),
        "th": ParagraphStyle("TH", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=7.2, leading=8.8, textColor=colors.white),
        "td": ParagraphStyle("TD", parent=styles["BodyText"], fontSize=7.2, leading=9.4, textColor=INK),
        "callout": ParagraphStyle("Callout", parent=styles["BodyText"], fontSize=8.5, leading=11.5, textColor=AMBER, backColor=colors.HexColor("#fff7ed"), borderColor=colors.HexColor("#fed7aa"), borderWidth=0.5, borderPadding=7, spaceBefore=5, spaceAfter=8),
        "center": ParagraphStyle("Center", parent=styles["BodyText"], alignment=TA_CENTER, fontSize=8.5, leading=11, textColor=PRIMARY),
    }

    counts, users, projects, submissions = load_snapshot()
    files = count_files()
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    expected_email = "finance@meil-esg.in"
    runtime_emails = {u["email"] for u in users}
    missing_seed_user = expected_email not in runtime_emails

    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=A4, rightMargin=16 * mm, leftMargin=16 * mm,
        topMargin=16 * mm, bottomMargin=19 * mm,
        title="MEIL ESG Technical Architecture Report", author="MEIL ESG Platform",
    )
    story = []
    story += [Paragraph("MEIL ESG & BRSR Platform", STYLES["title"]),
              Paragraph("Full frontend, backend, architecture, workflow, RBAC, user capability, and implementation report", STYLES["subtitle"]),
              HRFlowable(width="100%", thickness=2, color=TEAL, spaceAfter=12)]
    story.append(rich(f"<b>Generated:</b> {generated}<br/><b>Repository:</b> {escape(str(ROOT))}<br/><b>Runtime database:</b> {escape(str(RUNTIME_DB))}<br/><b>Data classification:</b> illustrative/demo environment; password hashes and credentials intentionally excluded.", STYLES["body"]))
    story.append(rich("<b>Executive summary.</b> This is a full-stack Next.js App Router application for multi-entity ESG and SEBI BRSR data governance. It combines role-specific React dashboards, server-side API routes, Prisma ORM over SQLite, deterministic validation/calculation helpers, evidence management, multi-level approvals, BRSR mappings, audit history, and PDF/report generation.", STYLES["callout"]))
    story += section("1. System at a glance")
    story.append(table(["Area", "Implementation-backed detail"], [
        ("Product", "MEIL ESG & BRSR Core reporting and disclosure platform"),
        ("Frontend", "React 19, Next.js 16.1.1 App Router, TypeScript 5, Tailwind CSS 4, Radix UI/shadcn-style primitives, Recharts, Lucide, Framer Motion, Zustand/React Query utilities"),
        ("Backend", "Next.js route handlers under src/app/api, Prisma 6.11.1 client, SQLite database, bcryptjs password verification, signed HttpOnly cookie session, Zod validators"),
        ("Reporting", "Client-side jsPDF/autotable dependency plus server-side ReportLab/Python dashboard PDF generator and BRSR PDF generator"),
        ("Deployment", "Next standalone output; npm/Bun scripts; Caddy reverse-proxy configuration; Python 3.10+ for ReportLab rendering"),
        ("Current runtime snapshot", f"{len(users)} users, {len(projects)} projects, {counts.get('Submission', 0)} submissions, {counts.get('Evidence', 0)} evidence records, {counts.get('AuditLog', 0)} audit logs, {counts.get('Activity', 0)} activities"),
    ], widths=[35 * mm, 143 * mm]))

    story += section("2. Architecture and system boundaries")
    story.append(rich("<b>Logical flow</b>", STYLES["h2"]))
    story.append(rich("Browser UI → AppProvider/session bootstrap → role-specific dashboard/workspace → fetch to Next.js route handler → server session/RBAC check → Prisma query or domain helper → SQLite → audit/activity/history/notification side effects → JSON/PDF response → dashboard/report view", STYLES["center"]))
    story.append(Spacer(1, 5))
    story.append(table(["Layer", "Responsibilities", "Representative files"], [
        ("Presentation", "Welcome screen, AppShell, role dashboards, workspaces, reusable UI primitives, charts, dialogs, forms, responsive styling", "src/app/page.tsx; src/components/dashboard; src/components/modules; src/components/ui; src/app/globals.css"),
        ("Client state", "Current user, active module, role-aware navigation, submodule routing, toast/error boundary behavior", "src/lib/auth-context.tsx; src/lib/role-nav.ts; src/components/shell"),
        ("HTTP/API", "Authentication, ESG source records, evidence, submissions, validation, calculations, consolidation, BRSR, reports, audit, notifications", "src/app/api/**/route.ts"),
        ("Domain services", "Workflow transitions, audit appenders, activity/history/notifications, contributor and finance stores, BRSR resolution, level-record fallback", "src/lib/workflow.ts; src/lib/validators.ts; src/lib/brsr-resolver.ts; src/lib/contributor-store.ts; src/lib/finance-store.ts"),
        ("Persistence", "Relational organization hierarchy, RBAC, periods, source records, evidence, validation, calculations, submissions, BRSR, reports, audit", "prisma/schema.prisma; src/lib/db.ts; db/custom.db"),
        ("External/runtime boundary", "Standalone Next server; Caddy reverse proxy; local file evidence paths; Python ReportLab process for dashboard export", "next.config.ts; Caddyfile; scripts/generate_dashboard_pdf.py"),
    ], widths=[28 * mm, 82 * mm, 68 * mm]))
    story += section("Organization hierarchy", "The relational hierarchy is Group → Subsidiary → Business Unit → Project/Site. Users receive scope rows at GROUP, SUBSIDIARY, BUSINESS_UNIT, or PROJECT level. The current runtime data contains one MEIL group, two subsidiaries, three business units, and four projects.")
    story.append(table(["Group", "Subsidiary", "Business unit", "Project"], [
        (x["group_name"], x["subsidiary"], x["business_unit"], f"{x['projectCode']} — {x['projectName']} ({x['location']})") for x in projects
    ], widths=[28 * mm, 35 * mm, 38 * mm, 77 * mm]))

    story.append(PageBreak())
    story += section("3. Frontend details")
    story.append(bullet("Next.js App Router entry point is src/app/page.tsx; the page is a client boundary that wraps AppProvider, WelcomeScreen, AppShell, ErrorBoundary, role dashboard selection, and ModuleRouter."))
    story.append(bullet("Role selection is explicit: the role key selects one of 16 dashboard implementations, including Super Admin, project/site, finance, HR, EHS, procurement, CSR, compliance, three reviewer levels, ESG manager/analyst, BRSR manager, auditor, and executive."))
    story.append(bullet("Navigation is role-specific in src/lib/role-nav.ts. Each role receives a curated set of modules rather than the full application menu; module keys route to specialized workspaces in src/components/modules/module-router.tsx."))
    story.append(bullet("UI composition uses Tailwind utility classes, CSS variables, Radix primitives, custom components, charts via Recharts, icons via Lucide, animation via Framer Motion, and accessible dialog/form/table primitives."))
    story.append(bullet("Client/server trust boundary is intentional: the frontend mirrors session state for rendering, but backend authorization is enforced by server helpers before protected operations."))
    story.append(table(["Frontend capability", "Implementation evidence"], [
        ("Dashboards", f"{files['Dashboard components']} dashboard TSX files; role-specific KPI, task, trend, risk, assurance, and readiness views"),
        ("Workspaces", f"{files['Workspace modules']} module TSX files covering shared, functional, reviewer, BRSR, audit, finance, and executive workspaces"),
        ("UI system", f"{files['UI primitives']} reusable UI primitive files plus components.json and Tailwind configuration"),
        ("Interaction patterns", "Command palette, drawers, dialogs, tabs, tables, pagination, cards, date/calendar controls, validation modals, CSV import, toast notifications"),
        ("Data presentation", "Overview KPIs, monthly trends, target tracking, pipeline/submission state, anomaly/exception panels, audit trace and report previews"),
    ], widths=[38 * mm, 140 * mm]))

    story += section("4. Backend details")
    story.append(table(["Backend concern", "Observed implementation"], [
        ("Framework runtime", "Next.js 16 App Router route handlers; next.config.ts uses output: standalone and does not ignore TypeScript build errors"),
        ("Authentication", "POST /api/auth/login verifies bcrypt hash and returns a 12-hour HttpOnly, SameSite=Lax cookie named meil_esg_session; logout clears it; /api/auth/me exposes the current session projection"),
        ("Authorization", "requireUser and requirePermission load roles/scopes server-side; userHasPermission resolves RolePermission → Permission. Route handlers return 401/403 through authErrorToStatus patterns"),
        ("Validation", "Zod is installed and domain validation is implemented in validators.ts; validation results carry rule code, severity, message, field, status, resolution, and timestamps"),
        ("Persistence", "Prisma Client against SQLite; schema has organization, RBAC, period, unit/factor, ESG record, evidence, validation, calculation, submission, BRSR, report, notification, activity, and audit models"),
        ("Auditability", "appendAudit, appendActivity, appendHistory, and notifyUser persist actor, role, action, entity, state changes, reasons, comments, metadata, and links"),
        ("PDF/reporting", "BRSR generation is in src/lib/brsr-pdf-generator.ts; dashboard export route and scripts/generate_dashboard_pdf.py provide PDF output; jsPDF and jspdf-autotable are client dependencies"),
    ], widths=[38 * mm, 140 * mm]))

    story.append(PageBreak())
    story += section("5. Data model and control chain")
    story.append(rich("<b>Source-to-disclosure chain:</b> Source Data → Evidence → Validation → Calculation → Submission → BU Review → Subsidiary Review → HQ Review/Lock → Consolidation → BRSR Mapping → Report → Audit", STYLES["center"]))
    story.append(table(["Domain", "Primary models / records", "Purpose"], [
        ("Identity/RBAC", "User, Role, Permission, RolePermission, UserRole, UserScope", "Identity, role catalog, permission grants, and data boundary scopes"),
        ("Organization", "Group, Subsidiary, BusinessUnit, Project", "Multi-entity reporting hierarchy and project/site ownership"),
        ("Periods", "ReportingYear, ReportingPeriod", "Monthly/quarterly/annual period deadlines and lifecycle status"),
        ("Calculation", "UnitMaster, ConversionRule, EmissionFactor, CalculationResult", "Normalization and deterministic energy/emission/resource calculations with factor version lineage"),
        ("ESG source", "EnergyRecord, WaterRecord, WasteRecord, WorkforceRecord, SafetyRecord, TravelRecord", "Operational environment, people, safety, and travel inputs"),
        ("Controls", "Evidence, ValidationRule, ValidationResult, AnomalyEvent", "Document proof, data quality rules, exceptions, and anomaly state"),
        ("Workflow", "Submission, SubmissionStatusHistory, CorrectionRequest", "Submission package, review assignment, correction cycle, approval and lock"),
        ("Disclosure", "BrsrFramework, BrsrSection, BrsrPrinciple, BrsrQuestion, BrsrAnswer, Report", "BRSR framework content, mappings, readiness, and generated reports"),
        ("Trace", "AuditLog, Activity, Notification", "Immutable-style action history, project activity feed, and user notifications"),
    ], widths=[32 * mm, 62 * mm, 84 * mm]))
    story += section("Runtime database inventory")
    count_rows = [(name, value) for name, value in sorted(counts.items())]
    story.append(table(["SQLite table", "Rows"], count_rows, widths=[125 * mm, 35 * mm]))
    story.append(rich("The active .env points to db/custom.db. A second prisma/db/custom.db exists with a different snapshot. This is a material environment/data-consistency issue and should be resolved before production use.", STYLES["callout"]))

    story += section("6. Workflow and state machine")
    story.append(table(["Step", "State/action", "Primary actor or control"], [
        ("1", "Create source record in DRAFT", "Project, Finance, HR, EHS, Procurement, CSR, or Compliance contributor"),
        ("2", "Upload/link evidence", "Contributor uploads document metadata; reviewer can verify or reject evidence"),
        ("3", "Validate and calculate", "Validation rules flag INFO/WARNING/ERROR/BLOCKING; calculation helpers normalize units and compute results"),
        ("4", "Submit package", "Contributor submits module package; rollup stores completion, evidence count, passed checks, and errors"),
        ("5", "Review/correct", "BU reviewer reviews; correction request can return the package to DRAFT/SUBMITTED/PENDING; resubmission creates history"),
        ("6", "Approve at BU", "BU_REVIEWER advances to BU_APPROVED or rejects"),
        ("7", "Approve at subsidiary", "SUBSIDIARY_REVIEWER advances to SUBSIDIARY_APPROVED"),
        ("8", "HQ review and lock", "GROUP_REVIEWER advances through HQ_REVIEW to LOCKED; locked records are not editable through normal endpoints"),
        ("9", "Consolidate and disclose", "Group/subsidiary rollups feed BRSR mappings, readiness, report generation, and audit trace"),
    ], widths=[12 * mm, 67 * mm, 99 * mm]))
    story.append(rich("Allowed transitions implemented in workflow.ts include DRAFT → SUBMITTED/PENDING → UNDER_REVIEW → CORRECTION_REQUESTED → RESUBMITTED, and approval progression through BU_APPROVED → SUBSIDIARY_APPROVED → HQ_REVIEW → LOCKED. The implementation also supports APPROVED and ACTIVE compatibility states.", STYLES["body"]))

    story.append(PageBreak())
    story += section("7. User inventory and work capability")
    story.append(rich(f"The configured runtime database contains {len(users)} active demo users. The seed defines a 16th FINANCE_USER ({expected_email}) that is present in prisma/db/custom.db but missing from db/custom.db. All listed identities are illustrative; no password or password hash is included.", STYLES["callout"]))
    user_rows = []
    for u in users:
        user_rows.append((u["name"], u["email"], u["employeeCode"] or "—", u["role_key"] or "—", f"{u['scopeType']}: {u['scope_name']}" if u["scopeType"] else "Group-wide / unrestricted", ROLE_WORK.get(u["role_key"], "See role definition in seed.")))
    if missing_seed_user:
        user_rows.append(("Rakesh Verma", expected_email, "MEIL-FIN-001", "FINANCE_USER", "Seed-defined; scope not present in runtime DB", ROLE_WORK["FINANCE_USER"] + " (expected seed account; not in active runtime DB)"))
    story.append(table(["User", "Email", "Employee code", "Role", "Scope", "Work / ability"], user_rows, widths=[25 * mm, 36 * mm, 24 * mm, 28 * mm, 32 * mm, 33 * mm]))

    story += section("Role permissions")
    role_rows = []
    for row in db_rows(sqlite3.connect(RUNTIME_DB), 'SELECT key, name, description, phase FROM "Role" ORDER BY phase, key'):
        key, name, description, phase = row
        permissions = "all 28 permissions" if key == "SUPER_ADMIN" else ROLE_PERMISSIONS.get(key, "—")
        role_rows.append((key, f"Phase {phase}", description or "", permissions))
    story.append(table(["Role", "Phase", "Role purpose", "Effective permission set"], role_rows, widths=[32 * mm, 18 * mm, 44 * mm, 56 * mm]))

    story += section("8. API surface")
    api_rows = [
        ("Auth", "/api/auth/login, /logout, /me", "Login, logout, session projection"),
        ("ESG source", "/api/energy, /water, /waste, /workforce, /safety, /data-entry", "Create, update, list, and validate source data"),
        ("Evidence", "/api/evidence, /api/evidence/[id], /verify, /reject", "Upload metadata, read, verify, reject"),
        ("Workflow", "/api/submissions and /api/submissions/[id]/submit|review|approve|reject|resubmit|lock|history", "Submission lifecycle and status history"),
        ("BRSR", "/api/brsr/frameworks, sections, principles, questions, indicators, mappings, readiness, generate, preview", "Framework, mapping, readiness, and document generation"),
        ("Analytics", "/api/overview, /insights, /targets, /consolidation/[level], /organization/tree", "KPI, insights, target, consolidation, hierarchy data"),
        ("Reports", "/api/reports, /generate, /[id], /[id]/download, /export/dashboard-pdf", "Report catalog, generation, download, dashboard PDF export"),
        ("Governance", "/api/audit, /audit/trace/[id], /activity, /notifications, /notifications/[id]/read", "Traceability, activity feed, and notifications"),
        ("Admin/controls", "/api/calculation/run, /validation/run, /organization/tree", "Calculation, validation, organization and control operations"),
    ]
    story.append(table(["Area", "Routes", "Purpose"], api_rows, widths=[29 * mm, 86 * mm, 65 * mm]))

    story.append(PageBreak())
    story += section("9. Security and operational assessment")
    story.append(table(["Control", "Current implementation", "Assessment"], [
        ("Password handling", "bcryptjs compare against passwordHash", "Good baseline for demo; use managed identity/rotation policy for production"),
        ("Session", "Signed token in HttpOnly cookie; 12-hour max age; SameSite=Lax", "Server-side enforcement is present; token is lightweight and should be replaced with hardened secret rotation/session store in production"),
        ("Secret safety", "Production boot refuses missing SESSION_SECRET; fallback is explicitly demo-only", "Good guardrail; ensure secret is set in deployment"),
        ("RBAC", "RolePermission checks are performed server-side by protected route handlers", "Strong pattern; verify every route has scope enforcement, not only permission enforcement"),
        ("Audit", "State/action appenders persist actors, roles, old/new state, reasons and metadata", "Good traceability model; enforce append-only database policy and retention in production"),
        ("Evidence", "Evidence stores file name, type, hash, MIME, version, verification status and reviewer", "Good metadata model; file storage authorization and malware scanning should be production controls"),
        ("Environment consistency", ".env uses db/custom.db while prisma/db/custom.db contains a different seed snapshot", "High-priority issue: standardize one database path and migration/seed procedure"),
        ("Demo data", "Seed marks users demo=true and documents illustrative data", "Keep demo database isolated; rotate/remove shared demo credentials before deployment"),
    ], widths=[35 * mm, 73 * mm, 72 * mm]))
    story += section("10. Build, run, and deployment workflow")
    story.append(table(["Stage", "Command/configuration", "Result"], [
        ("Install", "bun install or npm install", "Installs Next, React, Prisma, UI, chart, report, and validation dependencies"),
        ("Database", "bun run db:generate; bun run db:push", "Generates Prisma client and applies schema to configured SQLite file"),
        ("Development", "bun run dev", "Next dev with webpack on port 3000"),
        ("Quality", "npm run lint", "ESLint over repository"),
        ("Production build", "npm run build", "Next standalone build, copies static and public assets into standalone output"),
        ("Production start", "npm run start", "Runs standalone server through Bun and writes server.log"),
        ("PDF compiler", "python scripts/generate_dashboard_pdf.py <json> <pdf>", "ReportLab dashboard snapshot; this report uses the new generator below"),
        ("Reverse proxy", "Caddyfile", "Routes public traffic to the standalone application according to deployment configuration"),
    ], widths=[35 * mm, 63 * mm, 82 * mm]))

    story += section("11. Findings and recommended next actions")
    findings = [
        "Resolve the database mismatch: the configured runtime db/custom.db has 15 users and 1 submission, while prisma/db/custom.db has 16 users and 18 submissions. Pick one canonical database path and remove ambiguity from scripts and deployment.",
        "Restore or intentionally omit the seed-defined Finance user in the runtime DB; the report marks finance@meil-esg.in as expected but absent from db/custom.db.",
        "Before production, set a strong SESSION_SECRET, remove shared demo credentials, use a real secret manager, and consider a database-backed session or established auth provider.",
        "Complete scope-level authorization checks consistently across every record query; permission checks alone do not prove that the user can access the requested project/subsidiary/group.",
        "Move evidence files to controlled object storage with signed URLs, malware scanning, content-type verification, encryption, retention policy, and access logging.",
        "Add automated integration tests for login/RBAC, each workflow transition, lock immutability, scope isolation, report generation, and database path selection.",
        "Use Prisma migrations rather than db push for controlled environments, and document backup/restore, SQLite concurrency limits, and the production database migration path.",
    ]
    for finding in findings:
        story.append(bullet(finding))
    story.append(Spacer(1, 8))
    story.append(rich("<b>Source files reviewed:</b> package.json, README.md, next.config.ts, tsconfig.json, tailwind.config.ts, prisma/schema.prisma, prisma/seed.ts, src/app/page.tsx, src/lib/session.ts, src/lib/workflow.ts, src/lib/role-nav.ts, src/components/modules/module-router.tsx, src/app/api/**/route.ts, scripts/generate_dashboard_pdf.py, Caddyfile, and the configured SQLite runtime snapshot.", STYLES["small"]))

    doc.build(story, onFirstPage=page_header_footer, onLaterPages=page_header_footer)
    return OUTPUT


if __name__ == "__main__":
    output = build_report()
    print(output)
