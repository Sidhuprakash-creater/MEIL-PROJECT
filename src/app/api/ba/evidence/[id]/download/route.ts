import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BaError, baHandle, requireBuAdmin } from "@/lib/ba/server";
import { serveEvidenceBytes } from "@/lib/uploads";

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

    const bu = await db.businessUnit.findUnique({ where: { id: ctx.businessUnitId }, select: { name: true } });
    const prj = d.projectId
      ? await db.project.findUnique({ where: { id: d.projectId }, select: { name: true } })
      : null;

    /* Real bytes when the document was uploaded with stored content — legacy
       seeded rows (no fileId) fall through to the metadata receipt. */
    if (d.fileId) {
      const resp = await serveEvidenceBytes(d.fileId, d.name);
      if (resp) return resp;
    }

    const lines = [
      "MEIL ESG — BU Evidence document receipt (demo)",
      "==============================================",
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
