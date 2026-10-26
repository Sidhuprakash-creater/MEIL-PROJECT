import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  BaError, baHandle, requireBuAdmin, getBuOrThrow,
  baLogActivity, baLogAudit, baNotify,
} from "@/lib/ba/server";
import { toValidationRow } from "@/lib/sa/helpers";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* PATCH /api/ba/validation/[id] — assign an issue / notify responsible user.
   Resolution (RESOLVED / WAIVED) is the BU Manager's authority — the BU Admin
   may only notify / assign correction owners. */

export async function PATCH(req: NextRequest, { params }: Params) {
  return baHandle(async () => {
    const ctx = await requireBuAdmin();
    const bu = await getBuOrThrow(ctx.businessUnitId);
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { action?: string; ownerName?: string; note?: string };

    const issue = await db.validationIssue.findUnique({ where: { id } });
    if (!issue) throw new BaError("Validation issue not found.", 404);
    if (issue.businessUnitId !== ctx.businessUnitId) {
      throw new BaError("This validation issue is outside your business unit.", 403);
    }

    const [units, projects] = await Promise.all([
      db.businessUnit.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, select: { id: true, name: true } }),
      db.project.findMany({ where: { businessUnitId: ctx.businessUnitId }, select: { id: true, name: true } }),
    ]);
    const buNames = new Map(units.map((u) => [u.id, u.name]));
    const prjNames = new Map(projects.map((p) => [p.id, p.name]));

    if (body.action !== "assign" && body.action !== "notify") {
      throw new BaError("Unknown action. Use assign | notify (resolution belongs to the BU Manager).", 400);
    }

    const ownerName = (body.ownerName ?? "").trim();
    if (!ownerName) throw new BaError("An owner name is required to assign or notify.", 400);

    const updated = await db.validationIssue.update({
      where: { id: issue.id },
      data: { status: "ASSIGNED", ownerName },
    });

    await baNotify({
      ntype: "VALIDATION", title: "Data quality issue assigned",
      body: `${issue.ref} — ${issue.description} · Correction owner: ${ownerName}.`,
      severity: issue.severity, linkView: "validation", refId: issue.ref,
    });
    await baLogActivity(ctx, bu.name, {
      action: "VALIDATION_ASSIGN",
      targetType: "ValidationIssue",
      targetLabel: `${issue.ref} → ${ownerName}`,
      severity: issue.severity === "CRITICAL" ? "WARNING" : "INFO",
    });
    await baLogAudit(ctx, bu.code, {
      action: "VALIDATION_ASSIGN",
      targetType: "ValidationIssue",
      targetId: issue.id,
      targetLabel: issue.ref,
      before: { status: issue.status, ownerName: issue.ownerName },
      after: { status: "ASSIGNED", ownerName },
      reason: body.note,
    });
    return ok({ issue: toValidationRow(updated, buNames, prjNames) });
  });
}
