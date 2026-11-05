import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { BmError, bmHandle, requireBuManager } from "@/lib/bm/server";
import type { EvidenceRow } from "@/lib/bm/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* GET /api/bm/evidence/[id] — single document metadata (BU-scope enforced).
   Returns { doc } (wrapped — the list endpoint returns { docs: [...] }). */
export async function GET(_req: NextRequest, { params }: Params) {
  return bmHandle(async () => {
    const ctx = await requireBuManager();
    const { id } = await params;

    const d = await db.evidenceDoc.findUnique({ where: { id } });
    if (!d) throw new BmError("Evidence document not found.", 404);
    if (d.businessUnitId !== ctx.businessUnitId) {
      throw new BmError("This evidence document is outside your assigned business unit.", 403);
    }

    const [bu, prj] = await Promise.all([
      db.businessUnit.findUnique({ where: { id: ctx.businessUnitId }, select: { name: true } }),
      d.projectId ? db.project.findUnique({ where: { id: d.projectId }, select: { name: true } }) : Promise.resolve(null),
    ]);

    /* Version family — same submissionRef, name prefix → ordered by version. */
    const family = await db.evidenceDoc.findMany({
      where: { businessUnitId: ctx.businessUnitId, submissionRef: d.submissionRef, name: { contains: d.name.split("_v")[0].slice(0, 24) } },
      orderBy: { version: "asc" },
      select: { id: true, name: true, version: true, uploadedAt: true, uploadedBy: true, status: true },
    });

    const doc: EvidenceRow & {
      disclosureRef: string;
      family: { id: string; name: string; version: number; uploadedAt: string; uploadedBy: string; status: string }[];
      parentReportId: string | null;
    } = {
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
      fileId: null as string | null,
      hasFile: false,
      mimeType: '',
      family: family.map((f) => ({
        id: f.id, name: f.name, version: f.version,
        uploadedAt: f.uploadedAt.toISOString(), uploadedBy: f.uploadedBy, status: f.status,
      })),
      parentReportId: d.submissionId,
    };
    return ok({ doc });
  });
}
