import { db } from "@/lib/db";
import { parseJson } from "@/lib/sa/server";
import type { ProjectRow, SubmissionRow, UnitRow, UserRow } from "@/lib/sa/types";

/* Shared row mappers used by multiple /api/sa/* route handlers.
   (Route files may only export HTTP handlers, so helpers live here.) */

export const PTYPE_LABELS: Record<string, string> = {
  SITE: "Site", PLANT: "Plant", OFFICE: "Office", WIND_FARM: "Wind farm",
  SOLAR_PARK: "Solar park", HYDRO: "Hydro", PIPELINE: "Pipeline",
};

export async function unitStats(subsidiaryId: string, period: string) {
  const subs = await db.submission.findMany({
    where: { subsidiaryId, period },
    select: { businessUnitId: true, projectId: true, status: true, overdue: true, submittedAt: true },
  });
  const buMap = new Map<string, { approved: number; submitted: number; pending: number; overdue: number; total: number }>();
  const prjMap = new Map<string, { approved: number; pending: number; overdue: number; total: number; lastAt: Date | null }>();
  for (const s of subs) {
    if (s.businessUnitId && !s.projectId) {
      const cur = buMap.get(s.businessUnitId) ?? { approved: 0, submitted: 0, pending: 0, overdue: 0, total: 0 };
      cur.total++;
      if (s.status === "APPROVED") cur.approved++;
      else if (["SUBMITTED", "UNDER_REVIEW"].includes(s.status)) cur.submitted++;
      else if (["DRAFT", "ASSIGNED"].includes(s.status)) cur.pending++;
      if (s.overdue && s.status !== "APPROVED") cur.overdue++;
      buMap.set(s.businessUnitId, cur);
    }
    if (s.projectId) {
      const cur = prjMap.get(s.projectId) ?? { approved: 0, pending: 0, overdue: 0, total: 0, lastAt: null as Date | null };
      cur.total++;
      if (s.status === "APPROVED") cur.approved++;
      else if (["SUBMITTED", "UNDER_REVIEW"].includes(s.status)) cur.pending++;
      if (s.overdue && s.status !== "APPROVED") cur.overdue++;
      if (s.submittedAt && (!cur.lastAt || s.submittedAt > cur.lastAt)) cur.lastAt = s.submittedAt;
      prjMap.set(s.projectId, cur);
    }
  }
  return { buMap, prjMap };
}

export function toUnitRow(
  u: { id: string; code: string; name: string; managerName: string; adminName: string; description: string; status: string; createdAt: Date; subsidiary: { name: string } },
  st: { approved: number; submitted: number; pending: number; overdue: number; total: number },
  totalProjects: number,
  totalUsers: number
): UnitRow {
  return {
    id: u.id, code: u.code, name: u.name, subsidiaryName: u.subsidiary.name,
    managerName: u.managerName || "—", adminName: u.adminName || "—", description: u.description,
    totalProjects, totalUsers,
    approved: st.approved, submitted: st.submitted, pending: st.pending, overdue: st.overdue,
    completionPct: st.total ? Math.round((st.approved / st.total) * 100) : 0,
    status: u.status, createdAt: u.createdAt.toISOString(),
  };
}

export function toProjectRow(
  p: { id: string; code: string; name: string; businessUnitId: string; location: string; ptype: string; capacityMw: number; frequency: string; status: string; createdAt: Date; businessUnit: { name: string }; users?: { name: string }[] },
  st: { approved: number; pending: number; overdue: number; lastAt: Date | null },
  effectiveDueDate: Date | null,
  validationState: string
): ProjectRow {
  return {
    id: p.id, code: p.code, name: p.name, buId: p.businessUnitId, buName: p.businessUnit.name,
    location: p.location, ptype: PTYPE_LABELS[p.ptype] ?? p.ptype, capacityMw: p.capacityMw,
    frequency: p.frequency,
    responsibleName: p.users?.[0]?.name ?? "—",
    teamCount: p.users?.length ?? 0,
    approved: st.approved, pending: st.pending, overdue: st.overdue,
    dueDate: effectiveDueDate ? effectiveDueDate.toISOString() : null,
    validationState, status: p.status, createdAt: p.createdAt.toISOString(),
  };
}

export function toSubmissionRow(
  s: {
    id: string; ref: string; title: string; category: string; metricName: string; metricValue: number;
    metricUnit: string; status: string; overdue: boolean; period: string; fiscalQuarter: string;
    dueDate: Date; submittedAt: Date | null; reviewedAt: Date | null; businessUnitId: string | null;
    projectId: string | null; submittedById: string | null; reviewerId: string | null;
    evidence: string; updatedAt: Date;
  },
  users: Map<string, string>,
  buNames: Map<string, string>,
  projectNames: Map<string, string>
): SubmissionRow {
  const evidenceList = parseJson<string[]>(s.evidence, []);
  return {
    id: s.id, ref: s.ref, title: s.title, category: s.category, metricName: s.metricName,
    metricValue: s.metricValue, metricUnit: s.metricUnit, status: s.status, overdue: s.overdue,
    period: s.period, fiscalQuarter: s.fiscalQuarter,
    dueDate: s.dueDate.toISOString(), submittedAt: s.submittedAt?.toISOString() ?? null,
    reviewedAt: s.reviewedAt?.toISOString() ?? null,
    level: s.projectId ? "PROJECT" : "BU",
    buId: s.businessUnitId, buName: s.businessUnitId ? buNames.get(s.businessUnitId) ?? null : null,
    projectId: s.projectId, projectName: s.projectId ? projectNames.get(s.projectId) ?? null : null,
    submittedByName: (() => {
      if (s.submittedById && users.get(s.submittedById)) {
        return users.get(s.submittedById);
      }
      if ((s as any).history) {
        try {
          const hist = parseJson<any[]>((s as any).history, []);
          const firstSubmit = hist.find((h) => /submit/i.test(h.action || '') || /create/i.test(h.action || '')) || hist[0];
          if (firstSubmit?.actorName || firstSubmit?.actor) {
            return firstSubmit.actorName || firstSubmit.actor;
          }
        } catch {}
      }
      return null;
    })(),
    reviewerName: s.reviewerId ? users.get(s.reviewerId) ?? null : null,
    evidenceCount: evidenceList.length,
    lastUpdated: s.updatedAt.toISOString(),
  };
}

export function toUserRow(
  u: {
    id: string; name: string; email: string; employeeId: string | null; role: string; status: string;
    businessUnitId: string | null; projectId: string | null; title: string; phone: string;
    lastActiveAt: Date | null; lastLoginAt: Date | null;
  },
  buNames: Map<string, string>,
  projectNames: Map<string, string>,
  roleLabels: Record<string, string>,
  taskCount: number,
  submissionCount: number
): UserRow {
  const now = Date.now();
  const last = u.lastActiveAt?.getTime() ?? 0;
  const presence: UserRow["presence"] =
    u.status !== "ACTIVE" ? "offline"
      : last && now - last < 30 * 60000 ? "online"
        : last && now - last < 12 * 3600000 ? "today"
          : last && now - last < 36 * 3600000 ? "away" : "offline";
  return {
    id: u.id, name: u.name, email: u.email, employeeId: u.employeeId,
    role: u.role, roleLabel: roleLabels[u.role] ?? u.role, status: u.status,
    buId: u.businessUnitId, buName: u.businessUnitId ? buNames.get(u.businessUnitId) ?? null : null,
    projectId: u.projectId, projectName: u.projectId ? projectNames.get(u.projectId) ?? null : null,
    title: u.title, phone: u.phone,
    lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    taskCount, submissionCount, presence,
  };
}
