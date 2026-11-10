/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG — BU MANAGER · Consolidated rollup (section sums across projects)

   WHAT THIS SOLVES
   A Business Unit receives approved disclosures from SEVERAL projects
   (e.g. Kaleswaram Lift Irrigation + one more project). Every project
   reports its own Energy / Water / Safety numbers with its own evidence.
   The BU must be able to see ONE consolidated picture per section:

     Energy  3000 (Project A) + 2000 (Project B)  →  5000 total
     Evidence  2 files from A, 2 files from B     →  both listed separately

   The rollup is therefore built per SECTION (category) and, inside a
   section, per PROJECT — so the numbers add up across projects while the
   evidence and the soft copies stay attributable to their project.

   Two value buckets are kept apart:
     • confirmedValue — reports the BU Manager has APPROVED (BU_APPROVED)
     • pendingValue   — reports handed over but still awaiting the BU decision
   Only confirmed numbers travel into the final report to the Subsidiary.
   ═══════════════════════════════════════════════════════════════════════════ */

import { db } from "@/lib/db";
import type {
  BuRollup,
  BuRollupDossier,
  BuRollupEvidenceFile,
  BuRollupProject,
  BuRollupReport,
  BuRollupSection,
} from "@/lib/bm/rollup-types";

export type {
  BuRollup,
  BuRollupDossier,
  BuRollupEvidenceFile,
  BuRollupProject,
  BuRollupReport,
  BuRollupSection,
} from "@/lib/bm/rollup-types";

const SECTION_LABELS: Record<string, string> = {
  ENVIRONMENT: "Environment",
  ENERGY: "Energy",
  EMISSIONS: "Emissions",
  WATER: "Water",
  WASTE: "Waste",
  SAFETY: "Safety / EHS",
  WORKFORCE: "Workforce / HR",
  PROCUREMENT: "Procurement",
  CSR: "CSR / Community",
  COMPLIANCE: "Compliance",
  FINANCE: "Finance",
};

const sectionLabel = (category: string) =>
  SECTION_LABELS[category] || category.charAt(0) + category.slice(1).toLowerCase();

const nowIso = () => new Date().toISOString();

/**
 * Build the BU rollup.
 * @param businessUnitId BU scope
 * @param subsidiaryId   parent subsidiary (for the final report)
 * @param period         reporting period filter ("" = every period)
 */
export async function buildBuRollup(params: {
  businessUnitId: string;
  subsidiaryId: string;
  period?: string | null;
  buName?: string;
  subsidiaryName?: string;
  /** Projects of THIS business unit — the rollup never aggregates another
   *  BU's projects (that was the group-wide leak in the review queue). */
  buProjectIds?: string[];
}): Promise<BuRollup> {
  const { businessUnitId, subsidiaryId } = params;
  const period = params.period ?? "";

  /* ── 1. Reports handed over to this BU ───────────────────────────────── */
  const candidates = await db.submission.findMany({
    where: {
      OR: [
        { businessUnitId },
        ...(params.buProjectIds?.length ? [{ projectId: { in: params.buProjectIds } }] : []),
      ],
      ...(period ? { period } : {}),
    },
    select: {
      id: true,
      ref: true,
      title: true,
      category: true,
      module: true,
      metricName: true,
      metricValue: true,
      metricUnit: true,
      status: true,
      period: true,
      projectId: true,
      businessUnitId: true,
      forwardedToBu: true,
      inConsolidatedReport: true,
      evidenceCount: true,
      evidence: true,
      forwardedToBuAt: true,
      submittedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const projectIds = [...new Set(candidates.map((s) => s.projectId).filter((id): id is string => !!id))];

  /* Round 2 — everything that only depends on the project set runs in ONE
     parallel round (the remote DB costs ~2s per round-trip). */
  const [projects, evidenceDocs, dossiers, storedEvidence, dossierSubmissions] = await Promise.all([
    projectIds.length
      ? db.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, name: true } })
      : Promise.resolve([] as { id: string; name: string }[]),
    db.evidenceDoc.findMany({
      where: { businessUnitId },
      select: {
        id: true, name: true, fileType: true, sizeKb: true, uploadedAt: true,
        projectId: true, submissionId: true, submissionRef: true,
      },
    }),
    projectIds.length
      ? db.report.findMany({
          where: { scopeType: "PROJECT", scopeId: { in: projectIds } },
          select: { id: true, scopeId: true, scopeName: true, fileName: true, fileType: true, status: true, createdAt: true, version: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([] as any[]),
    projectIds.length
      ? db.evidence.findMany({
          where: { projectId: { in: projectIds } },
          select: {
            id: true, fileName: true, documentType: true, filePath: true,
            fileSize: true, projectId: true, module: true, createdAt: true,
          },
        })
      : Promise.resolve([] as any[]),
    /* The dossier SUBMISSION row carries the human ref (DOS-…). */
    projectIds.length
      ? db.submission.findMany({
          where: { category: "CONSOLIDATED", projectId: { in: projectIds } },
          select: { id: true, ref: true, projectId: true },
        })
      : Promise.resolve([] as { id: string; ref: string; projectId: string | null }[]),
  ]);

  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  /* Soft copy of each project's own consolidated dossier (latest wins). */
  const dossierByProject = new Map<string, any>();
  for (const d of dossiers) {
    if (!d.scopeId) continue;
    if (!dossierByProject.has(d.scopeId)) dossierByProject.set(d.scopeId, d);
  }
  const dossierRef = new Map(
    dossierSubmissions
      .filter((s) => s.projectId)
      .map((s) => [s.id, s.ref]),
  );

  /* ── 2. Only the reports this BU actually received ──────────────────────
     A report reaches the rollup when it was handed over (forwardedToBu) or
     already sits in a consolidated package, and it always stays inside the
     BU's own scope (its project belongs to this BU). */
  const eligible = candidates.filter(
    (s) =>
      (s.forwardedToBu || s.inConsolidatedReport) &&
      s.category !== "CONSOLIDATED" &&
      (s.status === "BU_APPROVED" || s.status === "APPROVED" || s.status === "BU_REVIEW_PENDING"),
  );

  /* Evidence resolution — TWO repositories, because both are in use:
       · db.Evidence      → the files the Project User Portal actually stores
                            (fileName + filePath, linked through the
                            submission's `evidence` JSON array)
       · db.EvidenceDoc   → the BU evidence repository (submission-linked)
     A submission that only references a file name (no stored copy) still
     shows up — flagged as "reference only" instead of a broken download. */
  const evidenceBySubmission = new Map<string, BuRollupEvidenceFile[]>();
  const generalEvidenceByProject = new Map<string, BuRollupEvidenceFile[]>();
  for (const doc of evidenceDocs) {
    const file: BuRollupEvidenceFile = {
      id: doc.id,
      name: doc.name,
      fileType: doc.fileType,
      sizeKb: doc.sizeKb,
      uploadedAt: doc.uploadedAt.toISOString(),
      submissionRef: doc.submissionRef || "",
      filePath: `/api/bm/evidence/${doc.id}/download`,
      hasFile: true,
    };
    if (doc.submissionId) {
      if (!evidenceBySubmission.has(doc.submissionId)) evidenceBySubmission.set(doc.submissionId, []);
      evidenceBySubmission.get(doc.submissionId)!.push(file);
    } else if (doc.projectId) {
      if (!generalEvidenceByProject.has(doc.projectId)) generalEvidenceByProject.set(doc.projectId, []);
      generalEvidenceByProject.get(doc.projectId)!.push(file);
    }
  }

  /* Stored evidence files of every project in scope (name → file). */
  const norm = (s: string) => s.trim().toLowerCase().replace(/\.[^/.]+$/, "");
  const storedByProject = new Map<string, typeof storedEvidence>();
  for (const e of storedEvidence) {
    if (!e.projectId) continue;
    if (!storedByProject.has(e.projectId)) storedByProject.set(e.projectId, []);
    storedByProject.get(e.projectId)!.push(e);
  }
  const findStored = (projectId: string, fileName: string) => {
    const pool = storedByProject.get(projectId) ?? [];
    const target = norm(fileName);
    return (
      pool.find((e) => norm(e.fileName) === target) ??
      pool.find((e) => norm(e.fileName).includes(target) || target.includes(norm(e.fileName))) ??
      null
    );
  };

  /* ── 3. Group by section, then by project inside the section ─────────── */
  const sections = new Map<string, BuRollupSection>();

  for (const sub of eligible) {
    const category = sub.category || "GENERAL";
    if (!sections.has(category)) {
      sections.set(category, {
        category,
        label: sectionLabel(category),
        confirmedValue: 0,
        pendingValue: 0,
        unit: sub.metricUnit || null,
        reportCount: 0,
        projectCount: 0,
        reports: [],
        projects: [],
      });
    }
    const section = sections.get(category)!;
    const confirmed = sub.status === "BU_APPROVED";
    const value = Number(sub.metricValue) || 0;

    if (confirmed) section.confirmedValue += value;
    else section.pendingValue += value;
    section.reportCount += 1;
    if (!section.unit && sub.metricUnit) section.unit = sub.metricUnit;

    /* Reports filed at BU level (no project) roll up under the business unit
       itself, so they are never lost. */
    const pid = sub.projectId || `BU-LEVEL:${businessUnitId}`;
    let project = section.projects.find((p) => p.projectId === pid);
    if (!project) {
      const dossier = dossierByProject.get(pid);
      project = {
        projectId: pid,
        projectName: projectName.get(pid) || (sub.projectId ? "Unnamed project" : "Business unit (direct)"),
        confirmedValue: 0,
        pendingValue: 0,
        unit: sub.metricUnit || null,
        reportCount: 0,
        reportRefs: [],
        evidenceFiles: [],
        generalEvidence: generalEvidenceByProject.get(pid) ?? [],
        dossier: dossier
          ? {
              id: dossier.id,
              ref: dossierRef.get(dossier.id) || dossier.id,
              fileName: dossier.fileName || "Consolidated report",
              status: dossier.status,
              createdAt: new Date(dossier.createdAt).toISOString(),
            }
          : null,
      };
      section.projects.push(project);
    }
    if (confirmed) project.confirmedValue += value;
    else project.pendingValue += value;
    project.reportCount += 1;
    project.reportRefs.push(sub.ref);

    const files = evidenceBySubmission.get(sub.id) ?? [];
    for (const f of files) if (!project.evidenceFiles.some((e) => e.id === f.id)) project.evidenceFiles.push(f);

    /* Evidence referenced by the report itself (Project User Portal uploads):
       resolve each file name against the stored evidence of THIS project so
       every project's evidence stays listed separately. */
    let referenced: string[] = [];
    try {
      const parsed = typeof sub.evidence === "string" ? JSON.parse(sub.evidence) : sub.evidence;
      if (Array.isArray(parsed)) referenced = parsed.filter(Boolean).map(String);
    } catch {}
    for (const name of referenced) {
      const stored = findStored(pid, name);
      const file: BuRollupEvidenceFile = stored
        ? {
            id: stored.id,
            name: stored.fileName,
            fileType: stored.documentType || "FILE",
            sizeKb: stored.fileSize ? Math.max(1, Math.round(stored.fileSize / 1024)) : 0,
            uploadedAt: stored.createdAt ? new Date(stored.createdAt).toISOString() : nowIso(),
            submissionRef: sub.ref,
            filePath: stored.filePath,
            hasFile: true,
          }
        : {
            id: `${sub.id}::${name}`,
            name,
            fileType: "FILE",
            sizeKb: 0,
            uploadedAt: nowIso(),
            submissionRef: sub.ref,
            filePath: null,
            hasFile: false,
          };
      if (!project.evidenceFiles.some((e) => e.name === file.name || (e.id && e.id === file.id))) {
        project.evidenceFiles.push(file);
      }
    }

    section.reports.push({
      id: sub.id,
      ref: sub.ref,
      title: sub.title,
      category: sub.category,
      projectId: sub.projectId,
      projectName: (sub.projectId && projectName.get(sub.projectId)) || null,
      metricName: sub.metricName,
      metricValue: Number(sub.metricValue) || 0,
      metricUnit: sub.metricUnit,
      status: sub.status,
      confirmed,
      evidenceCount: sub.evidenceCount ?? files.length + referenced.length,
      forwardedToBuAt: sub.forwardedToBuAt ? new Date(sub.forwardedToBuAt).toISOString() : null,
    });
  }

  const sectionList = [...sections.values()]
    .map((s) => ({ ...s, projectCount: s.projects.length }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const allProjects = new Set<string>();
  for (const s of sectionList) for (const p of s.projects) allProjects.add(p.projectId);

  const confirmedSubmissionIds = eligible.filter((s) => s.status === "BU_APPROVED").map((s) => s.id);

  return {
    buId: businessUnitId,
    buName: params.buName ?? "",
    subsidiaryId,
    subsidiaryName: params.subsidiaryName ?? "",
    period: period || "ALL",
    sections: sectionList,
    totals: {
      sections: sectionList.length,
      projects: allProjects.size,
      reports: sectionList.reduce((n, s) => n + s.reportCount, 0),
      confirmedReports: sectionList.reduce((n, s) => n + s.reports.filter((r) => r.confirmed).length, 0),
      pendingReports: sectionList.reduce((n, s) => n + s.reports.filter((r) => !r.confirmed).length, 0),
      confirmedValue: sectionList.reduce((n, s) => n + s.confirmedValue, 0),
    },
    confirmedSubmissionIds,
  };
}
