import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { bmHandle, requireBuManager } from "@/lib/bm/server";
import { toValidationRow } from "@/lib/sa/helpers";
import type { ValidationRow } from "@/lib/sa/types";

export const dynamic = "force-dynamic";

/* GET /api/bm/validation?q=&severity=&status=&projectId=
   data-quality issue register for the BU. The BU Manager sees the same
   validation rules as the Subsidiary Admin (open / assigned / resolved), but
   cannot alter submitted values — only annotate via comments on the
   decision endpoint (return / reject with instructions). */
export async function GET(req: NextRequest) {
  return bmHandle(async () => {
    const ctx = await requireBuManager();
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim().toLowerCase();
    const severity = sp.get("severity");
    const status = sp.get("status");
    const projectId = sp.get("projectId");
    const rule = sp.get("rule");
    const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
    const pageSize = Math.min(Math.max(1, Number(sp.get("pageSize") ?? 50) || 50), 100);

    const [issues, projects] = await Promise.all([
      db.validationIssue.findMany({
        where: { businessUnitId: ctx.businessUnitId },
        orderBy: { detectedAt: "desc" },
      }),
      db.project.findMany({ where: { businessUnitId: ctx.businessUnitId }, select: { id: true, name: true } }),
    ]);
    const projectNames = new Map(projects.map((p) => [p.id, p.name]));
    const buNames = new Map<string, string>(); // implicit — manager knows their BU

    const summary = {
      open: issues.filter((i) => i.status === "OPEN").length,
      critical: issues.filter((i) => i.severity === "CRITICAL" && ["OPEN", "ASSIGNED"].includes(i.status)).length,
      assigned: issues.filter((i) => i.status === "ASSIGNED").length,
      resolved: issues.filter((i) => ["RESOLVED", "WAIVED"].includes(i.status)).length,
    };

    let rows: ValidationRow[] = issues.map((i) => toValidationRow(i, buNames, projectNames));
    if (severity && severity !== "ALL") rows = rows.filter((r) => r.severity === severity);
    if (status && status !== "ALL") rows = rows.filter((r) => r.status === status);
    if (rule && rule !== "ALL") rows = rows.filter((r) => issues.find((i) => i.id === r.id)?.rule === rule);
    if (projectId && projectId !== "ALL") rows = rows.filter((r) => issues.find((i) => i.id === r.id)?.projectId === projectId);
    if (q) {
      rows = rows.filter((r) =>
        `${r.ref} ${r.description} ${r.rule} ${r.ownerName} ${r.responsibleName} ${r.submissionRef} ${r.projectName ?? ""}`
          .toLowerCase()
          .includes(q)
      );
    }

    const total = rows.length;
    return ok({
      issues: rows.slice((page - 1) * pageSize, page * pageSize),
      total,
      page,
      pageSize,
      summary,
    });
  });
}
