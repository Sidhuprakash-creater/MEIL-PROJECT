import { NextRequest } from "next/server";
import { ok } from "@/lib/esg/server";
import { SmError, smHandle, requireSubsidiaryManager } from "@/lib/sm/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* GET /api/sm/evidence/[id]/download — protected download endpoint.
   Authorization is enforced server-side: the document must exist AND belong
   to the manager's subsidiary or the request is refused before any bytes move.
   The sandbox has no object storage, so the response is an honest signed
   metadata receipt (what WOULD be served from private storage in production). */
export async function GET(_req: NextRequest, { params }: Params) {
  return smHandle(async () => {
    const ctx = await requireSubsidiaryManager();
    const { id } = await params;

    const d = await db.evidenceDoc.findUnique({ where: { id } });
    if (!d) throw new SmError("Evidence document not found.", 404);
    if (d.subsidiaryId !== ctx.subsidiaryId) {
      throw new SmError("Access denied — this document belongs to a different subsidiary.", 403);
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
        access: `authorized for ${ctx.name} (Subsidiary Manager) · expires in 5 min`,
        issuedAt: new Date().toISOString(),
      },
      note: "Sandbox environment: binary evidence storage is not provisioned. This receipt certifies server-side authorization succeeded.",
    });
  });
}
