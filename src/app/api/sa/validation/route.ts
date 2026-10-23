import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { saHandle, requireSubsidiaryAdmin, getSubsidiaryOrThrow } from "@/lib/sa/server";
import type { ValidationRow } from "@/lib/sa/types";
import { toValidationRow } from "@/lib/sa/helpers";

export const dynamic = "force-dynamic";

/* GET /api/sa/validation — data-quality issue register for the subsidiary,
   with filter facets and a scoped health summary. */

export async function GET(req: NextRequest) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim().toLowerCase();
    const severity = sp.get("severity");
    const status = sp.get("status");
    const buId = sp.get("buId");
    const projectId = sp.get("projectId");
    const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
    const pageSize = Math.min(Math.max(1, Number(sp.get("pageSize") ?? 10) || 10), 50);

    const [issues, units, projects] = await Promise.all([
      db.validationIssue.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, orderBy: { detectedAt: "desc" } }),
      db.businessUnit.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, select: { id: true, name: true } }),
      db.project.findMany({ where: { businessUnit: { subsidiaryId: ctx.subsidiaryId } }, select: { id: true, name: true } }),
    ]);
    const buNames = new Map(units.map((u) => [u.id, u.name]));
    const prjNames = new Map(projects.map((p) => [p.id, p.name]));

    const summary = {
      open: issues.filter((i) => i.status === "OPEN").length,
      critical: issues.filter((i) => i.severity === "CRITICAL" && ["OPEN", "ASSIGNED"].includes(i.status)).length,
      assigned: issues.filter((i) => i.status === "ASSIGNED").length,
      resolved: issues.filter((i) => ["RESOLVED", "WAIVED"].includes(i.status)).length,
    };

    let rows: ValidationRow[] = issues.map((i) => toValidationRow(i, buNames, prjNames));
    if (severity && severity !== "ALL") rows = rows.filter((r) => r.severity === severity);
    if (status && status !== "ALL") rows = rows.filter((r) => r.status === status);
    if (buId && buId !== "ALL") rows = rows.filter((r) => issues.find((i) => i.id === r.id)?.businessUnitId === buId);
    if (projectId && projectId !== "ALL") rows = rows.filter((r) => issues.find((i) => i.id === r.id)?.projectId === projectId);
    if (q) {
      rows = rows.filter((r) =>
        `${r.ref} ${r.description} ${r.rule} ${r.ownerName} ${r.responsibleName} ${r.submissionRef} ${r.buName ?? ""} ${r.projectName ?? ""}`
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
