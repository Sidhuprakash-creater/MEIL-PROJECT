import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { saHandle, requireSubsidiaryAdmin } from "@/lib/sa/server";
import type { EvidenceDoc } from "@prisma/client";
import type { EvidenceRow, EvidenceSummary } from "@/lib/sa/types";

export const dynamic = "force-dynamic";

const num = (v: string | null, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
};

export async function GET(req: NextRequest) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim().toLowerCase();
    const buId = (sp.get("buId") ?? "").trim();
    const projectId = (sp.get("projectId") ?? "").trim();
    const type = (sp.get("type") ?? "").trim().toUpperCase();
    const status = (sp.get("status") ?? "").trim().toUpperCase();
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

    /* Summary strip: computed over the FULL subsidiary-scoped repository. */
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

    /* Filtered + paginated rows. */
    let rows = docs;
    if (q) rows = rows.filter((d) => `${d.name} ${d.submissionRef} ${d.disclosureRef} ${d.uploadedBy}`.toLowerCase().includes(q));
    if (buId) rows = rows.filter((d) => d.businessUnitId === buId);
    if (projectId) rows = rows.filter((d) => d.projectId === projectId);
    if (type) rows = rows.filter((d) => d.fileType === type);
    if (status) rows = rows.filter((d) => d.status === status);

    const total = rows.length;
    const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
    return ok({ docs: pageRows.map(toRow), total, summary, page, pageSize });
  });
}
