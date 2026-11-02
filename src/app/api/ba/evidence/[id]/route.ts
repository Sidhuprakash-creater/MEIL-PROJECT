import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { BaError, baHandle, requireBuAdmin } from "@/lib/ba/server";
import type { EvidenceRow } from "@/lib/ba/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const { id } = await params;
    const d = await db.evidenceDoc.findUnique({ where: { id } });
    if (!d) throw new BaError("Evidence document not found.", 404);
    if (d.businessUnitId !== ctx.businessUnitId) {
      throw new BaError("This evidence document is outside your assigned business unit.", 403);
    }

    const prj = d.projectId
      ? await db.project.findUnique({ where: { id: d.projectId }, select: { name: true } })
      : null;

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
      buName: null,
      projectName: prj?.name ?? null,
      submissionId: d.submissionId,
      submissionRef: d.submissionRef,
      disclosureRef: d.disclosureRef,
      uploadedBy: d.uploadedBy,
      status: d.status,
      uploadedAt: d.uploadedAt.toISOString(),
      fileId: d.fileId,
      hasFile: !!d.fileId,
      mimeType: d.mimeType,
      previewAvailable: !!d.fileId, // real bytes can be downloaded; legacy rows are metadata-only
      contentHash,
    };
    return ok({ doc });
  });
}
