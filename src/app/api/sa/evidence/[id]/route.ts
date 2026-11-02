import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { SaError, saHandle, requireSubsidiaryAdmin } from "@/lib/sa/server";
import type { EvidenceRow } from "@/lib/sa/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const { id } = await params;
    const d = await db.evidenceDoc.findUnique({ where: { id } });
    if (!d) throw new SaError("Evidence document not found.", 404);
    if (d.subsidiaryId !== ctx.subsidiaryId) {
      throw new SaError("This evidence document is outside your assigned subsidiary.", 403);
    }

    const [bu, prj] = await Promise.all([
      d.businessUnitId
        ? db.businessUnit.findUnique({ where: { id: d.businessUnitId }, select: { name: true } })
        : Promise.resolve(null),
      d.projectId
        ? db.project.findUnique({ where: { id: d.projectId }, select: { name: true } })
        : Promise.resolve(null),
    ]);

    /* Stable demo fingerprint of the record metadata (honest — no file bytes stored). */
    const contentHash = createHash("sha256")
      .update(`${d.name}${d.uploadedAt.toISOString()}`)
      .digest("hex")
      .slice(0, 10);

    const doc: EvidenceRow & { previewAvailable: boolean; contentHash: string } = {
      id: d.id,
      name: d.name,
      fileType: d.fileType,
      sizeKb: d.sizeKb,
      version: d.version,
      buName: bu?.name ?? null,
      projectName: prj?.name ?? null,
      submissionId: d.submissionId,
      submissionRef: d.submissionRef,
      disclosureRef: d.disclosureRef,
      uploadedBy: d.uploadedBy,
      status: d.status,
      uploadedAt: d.uploadedAt.toISOString(),
      previewAvailable: false, // no file storage is provisioned in this demo environment
      contentHash,
    };
    return ok({ doc });
  });
}
