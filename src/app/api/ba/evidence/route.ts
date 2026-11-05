import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { assertProjectInBuScope, baHandle, baLogActivity, baLogAudit, baNotify, BaError, requireBuAdmin } from "@/lib/ba/server";
import { storeEvidenceFile, uploadErrorResponse } from "@/lib/uploads";
import type { EvidenceRow, EvidenceSummary } from "@/lib/ba/types";
import type { EvidenceDoc } from "@prisma/client";

export const dynamic = "force-dynamic";

const num = (v: string | null, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
};

export async function GET(req: NextRequest) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim().toLowerCase();
    const projectId = (sp.get("projectId") ?? "").trim();
    const type = (sp.get("type") ?? "").trim().toUpperCase();
    const typeFilter = type === "ALL" ? "" : type;  // view sentinel must not filter
    const status = (sp.get("status") ?? "").trim().toUpperCase();
    const statusFilter = status === "ALL" ? "" : status;  // view sentinel must not filter
    const submissionId = (sp.get("submissionId") ?? "").trim();
    const page = num(sp.get("page"), 1);
    const pageSize = Math.min(num(sp.get("pageSize"), 10), 50);

    const [docs, projects] = await Promise.all([
      db.evidenceDoc.findMany({ where: { businessUnitId: ctx.businessUnitId }, orderBy: { uploadedAt: "desc" } }),
      db.project.findMany({ where: { businessUnitId: ctx.businessUnitId }, select: { id: true, name: true } }),
    ]);
    const projectNames = new Map(projects.map((p) => [p.id, p.name]));

    const toRow = (d: EvidenceDoc): EvidenceRow => ({
      id: d.id,
      name: d.name,
      fileType: d.fileType,
      sizeKb: d.sizeKb,
      version: d.version,
      buName: null, /* single BU — name implied */
      projectName: d.projectId ? projectNames.get(d.projectId) ?? null : null,
      submissionId: d.submissionId,
      submissionRef: d.submissionRef,
      disclosureRef: d.disclosureRef,
      uploadedBy: d.uploadedBy,
      status: d.status,
      uploadedAt: d.uploadedAt.toISOString(),
      fileId: null as string | null,
      hasFile: false,
      mimeType: '',
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
    if (submissionId) rows = rows.filter((d) => d.submissionId === submissionId);
    if (typeFilter) rows = rows.filter((d) => d.fileType === typeFilter);
    if (statusFilter) rows = rows.filter((d) => d.status === statusFilter);

    const total = rows.length;
    const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
    return ok({ docs: pageRows.map(toRow), total, summary, page, pageSize });
  });
}

/* POST /api/ba/evidence — multipart/form-data upload.
   Fields: file (required), submissionId?, projectId?, disclosureRef?.
   The stored bytes land in EvidenceFile; the repository metadata in
   EvidenceDoc; the linked submission's evidence[] list is synced by the
   shared storeEvidenceFile helper. Scope: submission / project must be
   inside the admin's assigned business unit. */
export async function POST(req: NextRequest) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new BaError("Expected a multipart/form-data upload with a \"file\" field.", 400);
    }
    const file = form.get("file");
    if (!(file instanceof File)) throw new BaError("No file was provided.", 400);
    const submissionId = (form.get("submissionId") ?? "").toString().trim() || null;
    const projectId = (form.get("projectId") ?? "").toString().trim() || null;
    const disclosureRef = (form.get("disclosureRef") ?? "").toString().trim();

    /* Scope assertions before any bytes move. */
    if (submissionId) {
      const s = await db.submission.findUnique({ where: { id: submissionId }, select: { businessUnitId: true } });
      if (!s) throw new BaError("Linked submission was not found.", 404);
      if (s.businessUnitId !== ctx.businessUnitId) {
        throw new BaError("This submission is outside your assigned business unit.", 403);
      }
    }
    if (projectId) await assertProjectInBuScope(projectId, ctx.businessUnitId);

    let stored;
    try {
      stored = await storeEvidenceFile({
        file,
        subsidiaryId: ctx.subsidiaryId,
        businessUnitId: ctx.businessUnitId,
        projectId,
        submissionId,
        disclosureRef,
        uploadedBy: { id: ctx.userId, name: ctx.name, role: "BU_ADMIN" },
      });
    } catch (e) {
      const eResp = uploadErrorResponse(e);
      if (eResp) return eResp;
      throw e;
    }

    const [doc, bu] = await Promise.all([
      db.evidenceDoc.findUnique({ where: { id: stored.docId } }),
      db.businessUnit.findUnique({ where: { id: ctx.businessUnitId }, select: { name: true, code: true } }),
    ]);
    if (!doc) throw new BaError("Evidence document was stored but could not be read back.", 500);

    const scopeLabel = stored.submissionRef || (projectId ? "project repository" : "BU repository");
    await baNotify({
      ntype: "EVIDENCE",
      title: `Evidence uploaded: ${doc.name}`,
      body: `${ctx.name} (BU Admin) uploaded ${doc.fileType} v${doc.version}${doc.sizeKb ? ` · ${doc.sizeKb} KB` : ""} for ${scopeLabel}.`,
      severity: "INFO",
      linkView: "evidence",
      refId: doc.id,
    });
    await baLogActivity(ctx, bu?.name ?? "", {
      action: "EVIDENCE_UPLOAD",
      targetType: "EvidenceDoc",
      targetLabel: doc.name,
      severity: "INFO",
    });
    await baLogAudit(ctx, bu?.code ?? "", {
      action: "EVIDENCE_UPLOAD",
      targetType: "EvidenceDoc",
      targetId: doc.id,
      targetLabel: doc.name,
      after: { name: doc.name, fileType: doc.fileType, version: doc.version, submissionRef: doc.submissionRef, hasFile: true },
      outcome: "SUCCESS",
    });

    return ok({ doc: docToResponse(doc, null), stored }, { status: 201 });
  });
}

function docToResponse(d: EvidenceDoc, projectName: string | null): EvidenceRow {
  return {
    id: d.id,
    name: d.name,
    fileType: d.fileType,
    sizeKb: d.sizeKb,
    version: d.version,
    buName: null,
    projectName,
    submissionId: d.submissionId,
    submissionRef: d.submissionRef,
    disclosureRef: d.disclosureRef,
    uploadedBy: d.uploadedBy,
    status: d.status,
    uploadedAt: d.uploadedAt.toISOString(),
      fileId: null as string | null,
      hasFile: false,
      mimeType: '',
  };
}
