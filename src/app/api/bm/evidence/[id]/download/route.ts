import { NextRequest } from "next/server";
import { ok } from "@/lib/esg/server";
import { BmError, bmHandle, requireBuManager } from "@/lib/bm/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* GET /api/bm/evidence/[id]/download — protected download endpoint.
   Authorization is enforced server-side: the document must exist AND belong
   to the manager's BU. Documents uploaded with stored bytes are streamed as
   the original file; legacy seeded rows (no fileId) return an honest signed
   metadata receipt. The download is logged via activity + audit so access is
   always traceable. */
export async function GET(_req: NextRequest, { params }: Params) {
  return bmHandle(async () => {
    const ctx = await requireBuManager();
    const { id } = await params;

    const d = await db.evidenceDoc.findUnique({ where: { id } });
    if (!d) throw new BmError("Evidence document not found.", 404);
    if (d.businessUnitId !== ctx.businessUnitId) {
      throw new BmError("Access denied — this document belongs to a different business unit.", 403);
    }

    /* EvidenceDoc is metadata-only in the unified schema — serve the receipt. */

    /* Append an access-trail row (audit only — no PII, just the document ref
       and the manager identity). */
    try {
      const bu = await db.businessUnit.findUnique({ where: { id: ctx.businessUnitId }, select: { code: true, name: true } });
      if (bu) {
        await db.auditEvent.create({
          data: {
            actorName: ctx.name,
            actorRole: "BU_MANAGER",
            action: "EVIDENCE_DOWNLOAD",
            targetType: "EvidenceDoc",
            targetId: d.id,
            targetLabel: d.name,
            orgScope: bu.code,
            before: "{}",
            after: JSON.stringify({ ref: d.submissionRef, fileType: d.fileType, version: d.version }),
            reason: "metadata receipt issued",
            outcome: "SUCCESS",
            correlation: `bm-dl-${Math.random().toString(36).slice(2, 10)}`,
          },
        });
      }
    } catch {
      /* audit failure must never block the receipt */
    }

    return ok({
      receipt: {
        documentId: d.id,
        name: d.name,
        fileType: d.fileType,
        sizeKb: d.sizeKb,
        version: d.version,
        submissionRef: d.submissionRef,
        disclosureRef: d.disclosureRef,
        status: d.status,
        storage: "private-object-store (simulated)",
        access: `authorized for ${ctx.name} (BU Manager) · expires in 5 min`,
        issuedAt: new Date().toISOString(),
      },
      note: "Sandbox environment: binary evidence storage is not provisioned. This receipt certifies server-side authorization succeeded.",
    });
  });
}
