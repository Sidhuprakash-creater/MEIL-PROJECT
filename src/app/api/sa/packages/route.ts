import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  SaError, saHandle, requireSubsidiaryAdmin, getSubsidiaryOrThrow,
  saLogActivity, saLogAudit, saNotify,
} from "@/lib/sa/server";
import type { PackageRow } from "@/lib/sa/types";
import { loadConsolidationSources, makeRef, packageSummary, readinessPctOf, toPackageRow } from "@/lib/sa/helpers";

export const dynamic = "force-dynamic";

/* GET  /api/sa/packages        — reporting-package register (subsidiary-scoped).
   POST /api/sa/packages        — consolidate approved submissions into a
                                  package and submit it to Group. */

export async function GET(req: NextRequest) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const period = req.nextUrl.searchParams.get("period");
    const packages = await db.reportingPackage.findMany({
      where: { subsidiaryId: ctx.subsidiaryId, ...(period ? { period } : {}) },
      orderBy: { createdAt: "desc" },
    });
    const rows: PackageRow[] = packages.map(toPackageRow);
    return ok({ packages: rows });
  });
}

export async function POST(req: NextRequest) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const body = (await req.json().catch(() => ({}))) as { title?: string; period?: string; sourceRefs?: string[] };

    const period = (body.period ?? "").trim() || "FY 2025-26";
    const title = (body.title ?? "").trim() || `${sub.name} — ${period} ESG Reporting Package`;
    const sourceRefs = Array.isArray(body.sourceRefs) ? body.sourceRefs.filter((r) => typeof r === "string") : undefined;

    /* consolidation snapshot: approved sources only; pending flagged in summary */
    const snap = await loadConsolidationSources(ctx.subsidiaryId, period, sourceRefs);
    if (snap.approved.length === 0) {
      throw new SaError("There are no approved records to include yet.", 400);
    }
    const readiness = readinessPctOf(snap.approvedAllCount, snap.totalNonDraft);
    const summary = packageSummary(snap.approved, snap.pending.length, snap.missingCategories.length);
    const selectedRefs = snap.approved.map((s) => s.ref);

    const pkg = await db.reportingPackage.create({
      data: {
        ref: makeRef("PKG"),
        title,
        subsidiaryId: ctx.subsidiaryId,
        subsidiaryName: sub.name,
        period,
        status: "SUBMITTED",
        readinessPct: readiness,
        summary: JSON.stringify(summary),
        sourceRefs: JSON.stringify(selectedRefs),
        submittedAt: new Date(),
        submittedBy: ctx.name,
        groupFeedback: "",
      },
    });

    /* Group Admin's bell (subsidiaryId: null = group-wide) + scoped copy */
    await saNotify({
      ntype: "PACKAGE",
      title: "Subsidiary reporting package submitted",
      body: `${sub.name} submitted ${title} for Group consolidation.`,
      subsidiaryId: null,
      severity: "INFO",
      linkView: "consolidation",
      refId: pkg.ref,
    });
    await saNotify({
      ntype: "PACKAGE",
      title: "Package submitted to Group",
      body: `Your ${period} reporting package (${pkg.ref}) with ${summary.approved} approved sources is now with Group for consolidation.`,
      subsidiaryId: ctx.subsidiaryId,
      severity: "SUCCESS",
      linkView: "esg",
      refId: pkg.ref,
    });

    await saLogActivity(ctx, sub.name, {
      action: "PACKAGE_SUBMIT",
      targetType: "ReportingPackage",
      targetLabel: `${pkg.ref} · ${title}`,
    });
    await saLogAudit(ctx, sub.code, {
      action: "PACKAGE_SUBMIT",
      targetType: "ReportingPackage",
      targetId: pkg.id,
      targetLabel: pkg.ref,
      after: { title, period, status: "SUBMITTED", readinessPct: readiness, sourceCount: selectedRefs.length },
    });

    return ok({ package: toPackageRow(pkg) }, { status: 201 });
  });
}
