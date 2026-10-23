import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  SaError, saHandle, requireSubsidiaryAdmin, getSubsidiaryOrThrow,
  saLogActivity, saLogAudit, saNotify, parseJson,
} from "@/lib/sa/server";
import { toValidationRow } from "@/lib/sa/helpers";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* PATCH /api/sa/validation/[id] — assign an issue to a correction owner, or
   resolve it with REAL server-side revalidation (never a blind status flip):
   · MISSING_EVIDENCE    → the linked submission must actually carry evidence.
   · MISSING_SUBMISSION  → an APPROVED submission must exist for the org+period.
   · every other rule    → a written resolution note is mandatory.
   Failed revalidation (409) is audited as VALIDATION_RESOLVE / FAILURE. */

export async function PATCH(req: NextRequest, { params }: Params) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { action?: string; ownerName?: string; note?: string };

    const issue = await db.validationIssue.findUnique({ where: { id } });
    if (!issue) throw new SaError("Validation issue not found.", 404);
    if (issue.subsidiaryId !== ctx.subsidiaryId) {
      throw new SaError("This validation issue is outside your subsidiary.", 403);
    }

    const [units, projects] = await Promise.all([
      db.businessUnit.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, select: { id: true, name: true } }),
      db.project.findMany({ where: { businessUnit: { subsidiaryId: ctx.subsidiaryId } }, select: { id: true, name: true } }),
    ]);
    const buNames = new Map(units.map((u) => [u.id, u.name]));
    const prjNames = new Map(projects.map((p) => [p.id, p.name]));

    if (body.action === "assign") {
      const ownerName = (body.ownerName ?? "").trim();
      if (!ownerName) throw new SaError("An owner name is required to assign this issue.", 400);
      const updated = await db.validationIssue.update({
        where: { id: issue.id },
        data: { status: "ASSIGNED", ownerName },
      });
      await saNotify({
        ntype: "VALIDATION",
        title: "Data quality issue assigned",
        body: `${issue.ref} — ${issue.description} · Correction owner: ${ownerName}.`,
        severity: issue.severity,
        linkView: "validation",
        refId: issue.ref,
        subsidiaryId: ctx.subsidiaryId,
      });
      await saLogActivity(ctx, sub.name, {
        action: "VALIDATION_ASSIGN",
        targetType: "ValidationIssue",
        targetLabel: `${issue.ref} → ${ownerName}`,
        severity: issue.severity === "CRITICAL" ? "WARNING" : "INFO",
      });
      await saLogAudit(ctx, sub.code, {
        action: "VALIDATION_ASSIGN",
        targetType: "ValidationIssue",
        targetId: issue.id,
        targetLabel: issue.ref,
        before: { status: issue.status, ownerName: issue.ownerName },
        after: { status: "ASSIGNED", ownerName },
      });
      return ok({ issue: toValidationRow(updated, buNames, prjNames) });
    }

    if (body.action !== "resolve") {
      throw new SaError("Unknown action. Use assign | resolve.", 400);
    }

    const note = (body.note ?? "").trim();
    let blocked: string | null = null;

    if (issue.rule === "MISSING_EVIDENCE") {
      let hasEvidence = false;
      if (issue.submissionId) {
        const linked = await db.submission.findUnique({ where: { id: issue.submissionId } });
        if (linked && linked.subsidiaryId === ctx.subsidiaryId) {
          hasEvidence = parseJson<string[]>(linked.evidence, []).length > 0;
        }
      }
      if (!hasEvidence && issue.submissionRef) {
        const doc = await db.evidenceDoc.findFirst({
          where: { subsidiaryId: ctx.subsidiaryId, submissionRef: issue.submissionRef, status: "VALID" },
        });
        hasEvidence = !!doc;
      }
      if (!hasEvidence) {
        blocked = "Linked submission still has no evidence attached. Upload it before resolving.";
      }
    } else if (issue.rule === "MISSING_SUBMISSION") {
      const scope = issue.businessUnitId
        ? { businessUnitId: issue.businessUnitId }
        : issue.projectId
          ? { projectId: issue.projectId }
          : null;
      const approved = scope
        ? await db.submission.findFirst({
            where: { subsidiaryId: ctx.subsidiaryId, ...scope, period: issue.period, status: "APPROVED" },
          })
        : null;
      if (!approved) {
        blocked = "The underlying BU/project still has no approved submission for this period.";
      }
    } else if (!note) {
      throw new SaError("A resolution note is required for this issue type.", 400);
    }

    if (blocked) {
      await saLogAudit(ctx, sub.code, {
        action: "VALIDATION_RESOLVE",
        targetType: "ValidationIssue",
        targetId: issue.id,
        targetLabel: issue.ref,
        reason: blocked,
        outcome: "FAILURE",
      });
      throw new SaError(blocked, 409);
    }

    const updated = await db.validationIssue.update({
      where: { id: issue.id },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolveNote: note },
    });
    await saLogActivity(ctx, sub.name, {
      action: "VALIDATION_RESOLVE",
      targetType: "ValidationIssue",
      targetLabel: `${issue.ref} resolved`,
      severity: "SUCCESS",
    });
    await saLogAudit(ctx, sub.code, {
      action: "VALIDATION_RESOLVE",
      targetType: "ValidationIssue",
      targetId: issue.id,
      targetLabel: issue.ref,
      before: { status: issue.status },
      after: { status: "RESOLVED", resolveNote: note },
      outcome: "SUCCESS",
    });
    return ok({ issue: toValidationRow(updated, buNames, prjNames) });
  });
}
