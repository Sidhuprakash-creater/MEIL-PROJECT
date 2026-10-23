import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { SmError, smHandle, requireSubsidiaryManager } from "@/lib/sm/server";
import type { EvidenceRow } from "@/lib/sm/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* GET /api/sm/evidence/[id] — single document metadata (scope-enforced).
   Returns { doc } (wrapped — the list endpoint returns { docs: [...] }). */
export async function GET(_req: NextRequest, { params }: Params) {
  return smHandle(async () => {
    const ctx = await requireSubsidiaryManager();
    const { id } = await params;

    const d = await db.evidenceDoc.findUnique({ where: { id } });
    if (!d) throw new SmError("Evidence document not found.", 404);
    if (d.subsidiaryId !== ctx.subsidiaryId) {
      throw new SmError("This evidence document is outside your assigned subsidiary.", 403);
    }

    const [bu, prj] = await Promise.all([
      d.businessUnitId ? db.businessUnit.findUnique({ where: { id: d.businessUnitId }, select: { name: true } }) : Promise.resolve(null),
      d.projectId ? db.project.findUnique({ where: { id: d.projectId }, select: { name: true } }) : Promise.resolve(null),
    ]);

    /* Version history: same logical file family (name prefix before versioned suffix)
       within the subsidiary — ordered by version. */
    const family = await db.evidenceDoc.findMany({
      where: { subsidiaryId: ctx.subsidiaryId, submissionRef: d.submissionRef, name: { contains: d.name.split("_v")[0].slice(0, 24) } },
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
      family: family.map((f) => ({
        id: f.id, name: f.name, version: f.version,
        uploadedAt: f.uploadedAt.toISOString(), uploadedBy: f.uploadedBy, status: f.status,
      })),
      parentReportId: d.submissionId,
    };
    return ok({ doc });
  });
}
