import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  BaError, baHandle, requireBuAdmin, getBuOrThrow,
  baLogActivity, baLogAudit, baNotify,
} from "@/lib/ba/server";
import { toPackageRow, loadConsolidationSources, packageSummary, readinessPctOf, makeRef } from "@/lib/sa/helpers";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* POST /api/ba/esg/packages/[id] — submit a BU reporting package to the
   subsidiary. If [id] is "new" or the package doesn't exist, the request is
   treated as a fresh submission: a new DRAFT row is created with the supplied
   title+period, then immediately marked SUBMITTED with the BU's current
   approved sources consolidated into the snapshot. */

export async function POST(req: NextRequest, { params }: Params) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { title?: string; period?: string };

    const period = (body.period ?? "").trim() || "FY 2025-26";
    const title = (body.title ?? "").trim() || `${bu.name} — ${period} BU Reporting Package`;

    /* Recompute readiness + summary from the BU's current approved records. */
    const snap = await loadConsolidationSources(ctx.subsidiaryId, period, undefined);
    const buSubRefs = (await db.submission.findMany({
      where: { businessUnitId: ctx.businessUnitId, status: "APPROVED", period },
      select: { ref: true },
    })).map((s) => s.ref);
    if (buSubRefs.length === 0) {
      throw new BaError("There are no approved BU records to include yet. Approve at least one BU report first.", 400);
    }
    const buApprovedSources = snap.approved.filter((s) => buSubRefs.includes(s.ref));
    const summary = packageSummary(buApprovedSources, snap.pending.length, snap.missingCategories.length);
    const readiness = readinessPctOf(buApprovedSources.length, snap.totalNonDraft);

    let pkg = id === "new" ? null : await db.reportingPackage.findUnique({ where: { id } });
    if (pkg && pkg.subsidiaryId !== ctx.subsidiaryId) {
      throw new BaError("This package is outside your assigned subsidiary.", 403);
    }
    if (pkg && (pkg.status === "SUBMITTED" || pkg.status === "APPROVED")) {
      throw new BaError("This package has already been submitted.", 409);
    }

    if (pkg) {
      pkg = await db.reportingPackage.update({
        where: { id: pkg.id },
        data: {
          title, period,
          status: "SUBMITTED",
          readinessPct: readiness,
          summary: JSON.stringify(summary),
          sourceRefs: JSON.stringify(buSubRefs),
          submittedAt: new Date(),
          submittedBy: ctx.name,
        },
      });
    } else {
      pkg = await db.reportingPackage.create({
        data: {
          ref: makeRef("PKG"),
          title, period,
          subsidiaryId: ctx.subsidiaryId,
          subsidiaryName: bu.subsidiary.name,
          status: "SUBMITTED",
          readinessPct: readiness,
          summary: JSON.stringify(summary),
          sourceRefs: JSON.stringify(buSubRefs),
          submittedAt: new Date(),
          submittedBy: ctx.name,
          groupFeedback: "",
        },
      });
    }

    /* Cross-console notifications — broadcast to subsidiary + group + BU bells. */
    await baNotify({
      ntype: "PACKAGE", title: "BU reporting package submitted",
      body: `${bu.name} submitted ${pkg.title} for subsidiary consolidation.`,
      severity: "INFO", linkView: "esg", refId: pkg.ref,
    });
    await baNotify({
      ntype: "PACKAGE", title: "Package submitted to Subsidiary",
      body: `Your ${period} reporting package (${pkg.ref}) with ${summary.approved} approved sources is now with the Subsidiary for consolidation.`,
      severity: "SUCCESS", linkView: "esg", refId: pkg.ref,
    });

    await baLogActivity(ctx, bu.name, {
      action: "PACKAGE_SUBMIT",
      targetType: "ReportingPackage",
      targetLabel: `${pkg.ref} · ${pkg.title}`,
    });
    await baLogAudit(ctx, bu.code, {
      action: "PACKAGE_SUBMIT",
      targetType: "ReportingPackage",
      targetId: pkg.id,
      targetLabel: pkg.ref,
      after: { title: pkg.title, period, status: "SUBMITTED", readinessPct: readiness, sourceCount: buSubRefs.length },
    });

    return ok({ package: toPackageRow(pkg) }, { status: 201 });
  });
}
