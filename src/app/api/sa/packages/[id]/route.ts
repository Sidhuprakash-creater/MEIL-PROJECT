import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  SaError, saHandle, requireSubsidiaryAdmin, getSubsidiaryOrThrow,
  saLogActivity, saLogAudit, saNotify,
} from "@/lib/sa/server";
import { loadConsolidationSources, packageSummary, readinessPctOf, toPackageRow } from "@/lib/sa/helpers";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* PATCH /api/sa/packages/[id] — resubmit a CHANGES_REQUESTED package to Group.
   Decision ownership stays with the Group Admin: the subsidiary may only push
   the package back into the SUBMITTED queue (never approve/reject it). */

export async function PATCH(req: NextRequest, { params }: Params) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { action?: string; sourceRefs?: string[] };

    const pkg = await db.reportingPackage.findUnique({ where: { id } });
    if (!pkg) throw new SaError("Reporting package not found.", 404);
    if (pkg.subsidiaryId !== ctx.subsidiaryId) {
      throw new SaError("This reporting package belongs to another subsidiary.", 403);
    }
    if (body.action !== "resubmit") {
      throw new SaError('Unknown action. Only "resubmit" is available for reporting packages.', 400);
    }
    if (pkg.status !== "CHANGES_REQUESTED") {
      throw new SaError("Only packages with requested changes can be resubmitted.", 409);
    }

    const sourceRefs = Array.isArray(body.sourceRefs) ? body.sourceRefs.filter((r) => typeof r === "string") : undefined;
    let summaryJson = pkg.summary;
    let refsJson = pkg.sourceRefs;
    let readiness = pkg.readinessPct;

    if (sourceRefs) {
      const snap = await loadConsolidationSources(ctx.subsidiaryId, pkg.period, sourceRefs);
      if (snap.approved.length === 0) {
        throw new SaError("There are no approved records to include yet.", 400);
      }
      readiness = readinessPctOf(snap.approvedAllCount, snap.totalNonDraft);
      summaryJson = JSON.stringify(packageSummary(snap.approved, snap.pending.length, snap.missingCategories.length));
      refsJson = JSON.stringify(snap.approved.map((s) => s.ref));
    }

    const updated = await db.reportingPackage.update({
      where: { id: pkg.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        submittedBy: ctx.name,
        readinessPct: readiness,
        summary: summaryJson,
        sourceRefs: refsJson,
      },
    });

    await saNotify({
      ntype: "PACKAGE",
      title: "Subsidiary reporting package resubmitted",
      body: `${sub.name} resubmitted ${pkg.title} for Group consolidation after addressing requested changes.`,
      subsidiaryId: null,
      severity: "INFO",
      linkView: "consolidation",
      refId: pkg.ref,
    });
    await saNotify({
      ntype: "PACKAGE",
      title: "Package resubmitted to Group",
      body: `${pkg.ref} is back with Group for consolidation. You will be notified when the review completes.`,
      subsidiaryId: ctx.subsidiaryId,
      severity: "INFO",
      linkView: "esg",
      refId: pkg.ref,
    });

    await saLogActivity(ctx, sub.name, {
      action: "PACKAGE_RESUBMIT",
      targetType: "ReportingPackage",
      targetLabel: `${pkg.ref} · ${pkg.title}`,
    });
    await saLogAudit(ctx, sub.code, {
      action: "PACKAGE_RESUBMIT",
      targetType: "ReportingPackage",
      targetId: pkg.id,
      targetLabel: pkg.ref,
      before: { status: pkg.status },
      after: { status: "SUBMITTED" },
    });

    return ok({ package: toPackageRow(updated) });
  });
}
