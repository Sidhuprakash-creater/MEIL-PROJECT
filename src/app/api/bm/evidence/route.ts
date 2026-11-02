import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { bmHandle, requireBuManager } from "@/lib/bm/server";
import type { EvidenceDoc } from "@prisma/client";
import type { EvidenceRow, EvidenceSummary } from "@/lib/bm/types";

export const dynamic = "force-dynamic";

const num = (v: string | null, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
};

/* GET /api/bm/evidence?q=&projectId=&type=&status=&submissionRef=
   evidence repository for the BU Manager's Evidence Review screen. Supports
   a submissionRef filter so the report-review drawer shows exactly the
   documents attached to the report under review. */
export async function GET(req: NextRequest) {
  return bmHandle(async () => {
    const ctx = await requireBuManager();
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim().toLowerCase();
    const projectId = (sp.get("projectId") ?? "").trim();
    const type = (sp.get("type") ?? "").trim().toUpperCase();
    const typeFilter = type === "ALL" ? "" : type;  // view sentinel must not filter
    const status = (sp.get("status") ?? "").trim().toUpperCase();
    const statusFilter = status === "ALL" ? "" : status;  // view sentinel must not filter
    const submissionRef = (sp.get("submissionRef") ?? "").trim();
    const page = num(sp.get("page"), 1);
    const pageSize = Math.min(num(sp.get("pageSize"), 50), 100);

    const [docs, projects] = await Promise.all([
      db.evidenceDoc.findMany({
        where: { businessUnitId: ctx.businessUnitId },
        orderBy: { uploadedAt: "desc" },
      }),
      db.project.findMany({ where: { businessUnitId: ctx.businessUnitId }, select: { id: true, name: true } }),
    ]);
    const projectNames = new Map(projects.map((p) => [p.id, p.name]));

    const toRow = (d: EvidenceDoc): EvidenceRow => ({
      id: d.id,
      name: d.name,
      fileType: d.fileType,
      sizeKb: d.sizeKb,
      version: d.version,
      buName: null, // always this BU — implicit; the FE knows the scope
      projectName: d.projectId ? projectNames.get(d.projectId) ?? null : null,
      submissionId: d.submissionId,
      submissionRef: d.submissionRef,
      disclosureRef: d.disclosureRef,
      uploadedBy: d.uploadedBy,
      status: d.status,
      uploadedAt: d.uploadedAt.toISOString(),
      fileId: d.fileId,
      hasFile: !!d.fileId,
      mimeType: d.mimeType,
    });

    const byType = new Map<string, number>();
    for (const d of docs) byType.set(d.fileType, (byType.get(d.fileType) ?? 0) + 1);
    const summary: EvidenceSummary = {
      total: docs.length,
      missing: docs.filter((d) => d.status === "MISSING").length,
      expired: docs.filter((d) => d.status === "EXPIRED").length,
      byType: [...byType.entries()]
        .map(([t, count]) => ({ type: t, count }))
        .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type)),
    };

    let rows = docs;
    if (q) rows = rows.filter((d) => `${d.name} ${d.submissionRef} ${d.disclosureRef} ${d.uploadedBy}`.toLowerCase().includes(q));
    if (projectId) rows = rows.filter((d) => d.projectId === projectId);
    if (typeFilter) rows = rows.filter((d) => d.fileType === typeFilter);
    if (statusFilter) rows = rows.filter((d) => d.status === statusFilter);
    if (submissionRef) rows = rows.filter((d) => d.submissionRef === submissionRef);

    const total = rows.length;
    const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
    return ok({ docs: pageRows.map(toRow), total, summary, page, pageSize });
  });
}
