import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  BaError, baHandle, requireBuAdmin,
  baLogActivity, baLogAudit, baNotify,
} from "@/lib/ba/server";
import { storeEvidenceFile, uploadErrorResponse } from "@/lib/uploads";
import type { EvidenceRow } from "@/lib/ba/types";
import type { EvidenceDoc } from "@prisma/client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* ═══════════════════════════════════════════════════════════════════════════
   POST /api/ba/submissions/[id]/evidence — attach evidence at submit time.

   multipart/form-data: { file (required), disclosureRef? }.

   Scope: the submission must live inside the admin's assigned BU, and its
   workflow state must NOT be APPROVED (approved reports are read-only).
   Storage goes through the shared storeEvidenceFile helper (bytes + metadata
   + version bump + submission evidence[] sync) — no storage logic here.
   ═══════════════════════════════════════════════════════════════════════════ */

export async function POST(req: NextRequest, { params }: Params) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const { id } = await params;

    const s = await db.submission.findUnique({
      where: { id },
      select: { businessUnitId: true, status: true, ref: true },
    });
    if (!s) throw new BaError("Submission not found.", 404);
    if (s.businessUnitId !== ctx.businessUnitId) {
      throw new BaError("This submission is outside your assigned business unit.", 403);
    }
    if (s.status === "APPROVED") {
      throw new BaError("Approved reports are read-only — evidence can no longer be attached.", 409);
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new BaError("Expected a multipart/form-data upload with a \"file\" field.", 400);
    }
    const file = form.get("file");
    if (!(file instanceof File)) throw new BaError("No file was provided.", 400);
    const disclosureRef = (form.get("disclosureRef") ?? "").toString().trim();

    let stored;
    try {
      stored = await storeEvidenceFile({
        file,
        subsidiaryId: ctx.subsidiaryId,
        businessUnitId: ctx.businessUnitId,
        submissionId: id,
        disclosureRef,
        uploadedBy: { id: ctx.userId, name: ctx.name, role: "BU_ADMIN" },
      });
    } catch (e) {
      const eResp = uploadErrorResponse(e);
      if (eResp) return eResp;
      throw e;
    }

    const [doc, bu, fresh] = await Promise.all([
      db.evidenceDoc.findUnique({ where: { id: stored.docId } }),
      db.businessUnit.findUnique({ where: { id: ctx.businessUnitId }, select: { name: true, code: true } }),
      db.submission.findUnique({ where: { id }, select: { updatedAt: true } }),
    ]);
    if (!doc) throw new BaError("Evidence document was stored but could not be read back.", 500);

    /* Broadcast + audit, mirroring the /api/ba/evidence reference route so the
       attach-on-submit flow is visible on every console bell and audit trail. */
    await baNotify({
      ntype: "EVIDENCE",
      title: `Evidence uploaded: ${doc.name}`,
      body: `${ctx.name} (BU Admin) attached ${doc.fileType} v${doc.version}${doc.sizeKb ? ` · ${doc.sizeKb} KB` : ""} to ${s.ref} (report submission).`,
      severity: "INFO",
      linkView: "evidence",
      refId: doc.id,
    });
    await Promise.all([
      baLogActivity(ctx, bu?.name ?? "", {
        action: "EVIDENCE_UPLOAD",
        targetType: "EvidenceDoc",
        targetLabel: doc.name,
        severity: "INFO",
      }),
      baLogAudit(ctx, bu?.code ?? "", {
        action: "EVIDENCE_UPLOAD",
        targetType: "EvidenceDoc",
        targetId: doc.id,
        targetLabel: doc.name,
        after: { name: doc.name, fileType: doc.fileType, version: doc.version, submissionRef: s.ref, hasFile: true },
        outcome: "SUCCESS",
      }),
    ]);

    return ok({ doc: docToResponse(doc), stored, submissionUpdatedAt: fresh?.updatedAt.toISOString() ?? null }, { status: 201 });
  });
}

function docToResponse(d: EvidenceDoc): EvidenceRow {
  return {
    id: d.id,
    name: d.name,
    fileType: d.fileType,
    sizeKb: d.sizeKb,
    version: d.version,
    buName: null, /* single BU — name implied */
    projectName: null, /* project scope comes from the linked submission */
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
