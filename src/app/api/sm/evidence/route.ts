import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { smHandle, requireSubsidiaryManager } from "@/lib/sm/server";
import { ensureLevelRecordsLoaded } from "@/lib/pu/level-records";
import type { EvidenceDoc } from "@prisma/client";
import type { EvidenceRow, EvidenceSummary } from "@/lib/sm/types";

export const dynamic = "force-dynamic";

const num = (v: string | null, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
};

/* GET /api/sm/evidence?q=&buId=&projectId=&type=&status=&submissionRef= —
   evidence repository for the manager's Evidence Review screen. Supports a
   submissionRef filter so the report-review drawer can show exactly the
   documents attached to the report under review. */
export async function GET(req: NextRequest) {
  return smHandle(async () => {
    const ctx = await requireSubsidiaryManager();
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim().toLowerCase();
    const buId = (sp.get("buId") ?? "").trim();
    const projectId = (sp.get("projectId") ?? "").trim();
    const type = (sp.get("type") ?? "").trim().toUpperCase();
    const status = (sp.get("status") ?? "").trim().toUpperCase();
    const submissionRef = (sp.get("submissionRef") ?? "").trim();
    const page = num(sp.get("page"), 1);
    const pageSize = Math.min(num(sp.get("pageSize"), 10), 50);

    const [docs, units, projects] = await Promise.all([
      db.evidenceDoc.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, orderBy: { uploadedAt: "desc" } }),
      db.businessUnit.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, select: { id: true, name: true } }),
      db.project.findMany({ where: { businessUnit: { subsidiaryId: ctx.subsidiaryId } }, select: { id: true, name: true } }),
    ]);
    const buNames = new Map(units.map((u) => [u.id, u.name]));
    const projectNames = new Map(projects.map((p) => [p.id, p.name]));

    const toRow = (d: EvidenceDoc): EvidenceRow => ({
      id: d.id,
      name: d.name,
      fileType: d.fileType,
      sizeKb: d.sizeKb,
      version: d.version,
      buName: d.businessUnitId ? buNames.get(d.businessUnitId) ?? null : null,
      projectName: d.projectId ? projectNames.get(d.projectId) ?? null : null,
      submissionId: d.submissionId,
      submissionRef: d.submissionRef,
      disclosureRef: d.disclosureRef,
      uploadedBy: d.uploadedBy,
      status: d.status,
      uploadedAt: d.uploadedAt.toISOString(),
    });

    /* PU contributor uploads attach evidence to LEVEL RECORDS (db.evidence
       rows referenced by recordIds → evidenceId/evidenceIds), not as
       EvidenceDoc metadata rows. When the report-review drawer filters by
       submissionRef, synthesize rows from those uploads so the Evidence tab
       shows what the contributor actually submitted instead of "No evidence
       attached". */
    let allDocs: Array<EvidenceDoc | Record<string, any>> = docs as Array<EvidenceDoc | Record<string, any>>;
    if (submissionRef) {
      try {
        const sub = await db.submission.findFirst({
          where: { ref: submissionRef },
          select: { id: true, recordIds: true },
        });
        if (sub) {
          await ensureLevelRecordsLoaded();
          const { getLevelRecordById } = await import("@/lib/pu/level-records");
          const evidenceIdSet = new Set<string>();
          for (const rid of Array.isArray(sub.recordIds) ? sub.recordIds : JSON.parse(String(sub.recordIds || "[]"))) {
            const rec = getLevelRecordById(String(rid));
            if (!rec) continue;
            if (rec.evidenceId) evidenceIdSet.add(rec.evidenceId);
            for (const eid of Array.isArray(rec.evidenceIds) ? rec.evidenceIds : []) if (eid) evidenceIdSet.add(eid);
            for (const it of Array.isArray(rec.data?.items) ? rec.data.items : []) {
              if (it?.evidenceId) evidenceIdSet.add(it.evidenceId);
              for (const eid of Array.isArray(it?.evidenceIds) ? it.evidenceIds : []) if (eid) evidenceIdSet.add(eid);
            }
          }
          if (evidenceIdSet.size) {
            const uploads = await db.evidence.findMany({ where: { id: { in: [...evidenceIdSet] } } });
            const existingDocIds = new Set(docs.map((d) => d.id));
            for (const u of uploads) {
              if (existingDocIds.has(u.id)) continue;
              allDocs = [
                ...allDocs,
                {
                  id: u.id,
                  name: u.fileName,
                  fileType: u.documentType,
                  sizeKb: Math.max(1, Math.round(u.fileSize / 1024)),
                  version: u.version,
                  subsidiaryId: ctx.subsidiaryId,
                  businessUnitId: null,
                  projectId: u.projectId,
                  submissionId: sub.id,
                  submissionRef,
                  disclosureRef: "",
                  uploadedBy: "Contributor upload",
                  status: u.status,
                  uploadedAt: u.createdAt,
                },
              ];
            }
          }
        }
      } catch (err) {
        console.error("Failed to synthesize evidence rows from level records:", (err as any)?.message || err);
      }
    }

    /* Summary strip: computed over the FULL subsidiary-scoped repository. */
    const byType = new Map<string, number>();
    for (const d of allDocs) byType.set((d as EvidenceDoc).fileType, (byType.get((d as EvidenceDoc).fileType) ?? 0) + 1);
    const summary: EvidenceSummary = {
      total: allDocs.length,
      missing: allDocs.filter((d) => (d as EvidenceDoc).status === "MISSING").length,
      expired: allDocs.filter((d) => (d as EvidenceDoc).status === "EXPIRED").length,
      byType: [...byType.entries()]
        .map(([t, count]) => ({ type: t, count }))
        .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type)),
    };

    /* Filtered + paginated rows. */
    let rows = allDocs;
    if (q) rows = rows.filter((d) => `${(d as EvidenceDoc).name} ${(d as EvidenceDoc).submissionRef} ${(d as EvidenceDoc).disclosureRef} ${(d as EvidenceDoc).uploadedBy}`.toLowerCase().includes(q));
    if (buId) rows = rows.filter((d) => (d as EvidenceDoc).businessUnitId === buId);
    if (projectId) rows = rows.filter((d) => (d as EvidenceDoc).projectId === projectId);
    if (type) rows = rows.filter((d) => (d as EvidenceDoc).fileType === type);
    if (status) rows = rows.filter((d) => (d as EvidenceDoc).status === status);
    if (submissionRef) rows = rows.filter((d) => (d as EvidenceDoc).submissionRef === submissionRef);

    const total = rows.length;
    const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
    return ok({ docs: pageRows.map((d) => toRow(d as EvidenceDoc)), total, summary, page, pageSize });
  });
}
