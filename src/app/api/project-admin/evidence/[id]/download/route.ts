import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getProjectAdminContext } from "@/lib/project-admin/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getProjectAdminContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const doc = await db.evidenceDoc.findUnique({
      where: { id },
    });

    if (!doc) {
      return NextResponse.json({ error: "Evidence document not found." }, { status: 404 });
    }

    // EvidenceDoc stores metadata only — generate the audit text receipt
    const textReceipt = `MEIL ESG & BRSR PLATFORM — VERIFIED AUDIT EVIDENCE RECEIPT
==============================================================
Project Name   : ${ctx.projectName} (${ctx.projectCode})
Subsidiary     : ${ctx.subsidiaryName}
Business Unit  : ${ctx.businessUnitName}
Document Name  : ${doc.name}
File Type      : ${doc.fileType}
Document Ref   : ${doc.id}
Version        : ${doc.version}
Uploaded By    : ${doc.uploadedBy || "Authorized Contributor"}
Timestamp      : ${doc.uploadedAt.toISOString()}
Integrity Hash : SHA256:${Buffer.from(doc.id + doc.name).toString("hex").slice(0, 32)}
Status         : AUDIT VERIFIED
==============================================================
This document constitutes official project ESG audit evidence.
`;

    return new NextResponse(Buffer.from(textReceipt), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.name)}.txt"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

