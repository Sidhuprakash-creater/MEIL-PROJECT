import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SaError, saHandle, requireSubsidiaryAdmin } from "@/lib/sa/server";

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

    const lines = [
      "MEIL ESG — Evidence document receipt (demo)",
      "===========================================",
      "",
      `Document name : ${d.name}`,
      `Submission ref: ${d.submissionRef || "—"}`,
      `Disclosure ref: ${d.disclosureRef || "—"}`,
      `File type     : ${d.fileType}`,
      `Version       : v${d.version}`,
      `Uploaded by   : ${d.uploadedBy || "—"}`,
      `Uploaded at   : ${d.uploadedAt.toISOString()}`,
      `Status        : ${d.status}`,
      `Business unit : ${bu?.name ?? "—"}`,
      `Project       : ${prj?.name ?? "—"}`,
      "",
      "Note: file storage is not provisioned in this demo environment; this receipt certifies the record metadata.",
      "",
    ];

    const base = d.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9\-_ ]/g, "").trim().replace(/\s+/g, "-") || "evidence";
    const filename = `${base}-receipt.txt`;
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
