import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { BmError, bmHandle, requireBuManager, parseJson } from "@/lib/bm/server";
import {
  toBmSubmissionRow, resolveReviewDeadline,
  loadBmUserNames, loadBmProjectNames,
} from "@/lib/bm/rows";
import { toSubmissionRow } from "@/lib/sa/rows";
import type { SubmissionDetail } from "@/lib/sa/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* GET /api/bm/submissions/[id] — full report detail for the review workspace.
   Returns { submission, updatedAt, version } (wrapped — the list endpoint
   returns the flat array). `updatedAt` powers the stale-version guard: the
   review workspace sends it back with the decision so the server can refuse
   decisions made against a report that changed after it was opened. */
export async function GET(_req: NextRequest, { params }: Params) {
  return bmHandle(async () => {
    const ctx = await requireBuManager();
    const { id } = await params;

    const s = await db.submission.findUnique({ where: { id } });
    if (!s) throw new BmError("Submission not found.", 404);
    const isForwarded = s.forwardedToBu || (s as any).inConsolidatedReport;
    if (s.businessUnitId !== ctx.businessUnitId && !isForwarded) {
      throw new BmError("This submission is outside your assigned business unit.", 403);
    }

    const [issues, userNames, projectNames, reviewCtx] = await Promise.all([
      db.validationIssue.findMany({
        where: { submissionId: id },
        select: { ref: true, severity: true, description: true, status: true, rule: true },
      }),
      loadBmUserNames(ctx.businessUnitId, ctx.subsidiaryId),
      loadBmProjectNames(ctx.businessUnitId),
      resolveReviewDeadline(s, ctx.businessUnitId, ctx.subsidiaryId),
    ]);
    const bu = await db.businessUnit.findUnique({ where: { id: ctx.businessUnitId }, select: { id: true, name: true } });
    if (!bu) throw new BmError("Your assigned business unit was not found.", 403);

    const allBus = await db.businessUnit.findMany({ select: { id: true, name: true } });
    const buNames = new Map(allBus.map((b) => [b.id, b.name]));
    const base = toSubmissionRow(s, userNames, buNames, projectNames);

    let resolvedValues = parseJson<{ label: string; value: any; unit?: string }[]>(s.values, []);

    // Enrich with underlying LevelRecord store data if present
    if (s.recordIds) {
      try {
        const { getLevelRecordById } = await import("@/lib/so/level-records");
        const rids = parseJson<string[]>(s.recordIds, []);
        const enriched: Array<{ label: string; value: any; unit: string }> = [];
        for (const rid of rids) {
          const lr = getLevelRecordById(rid);
          if (lr) {
            if (lr.calculation && lr.calculation.calculatedValue != null) {
              enriched.push({
                label: `${lr.levelName || lr.module} — Total Calculated`,
                value: lr.calculation.calculatedValue,
                unit: lr.calculation.resultUnit || "",
              });
            }
            if (Array.isArray((lr.data as any)?.items)) {
              for (const it of (lr.data as any).items) {
                const label = it.energySource || it.waterSource || it.emissionSource || it.wasteCategory || it.permitConsentType || it.title || "Item";
                const val = it.consumptionQuantity ?? it.waterQuantity ?? it.activityQuantity ?? it.quantityGenerated ?? "—";
                enriched.push({
                  label: `${lr.levelName || lr.module} — ${label}`,
                  value: val,
                  unit: it.unit || "",
                });
              }
            } else if (lr.data && typeof lr.data === "object") {
              const skip = new Set(["items", "evidenceId", "evidenceIds", "viewStep", "stagedAt"]);
              for (const [k, v] of Object.entries(lr.data)) {
                if (skip.has(k) || v === "" || v === null || v === undefined) continue;
                enriched.push({
                  label: `${lr.levelName || lr.module} — ${k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}`,
                  value: String(v),
                  unit: "",
                });
              }
            }
          }
        }
        if (enriched.length > 0) {
          const seen = new Set(resolvedValues.map((v) => v.label.toLowerCase()));
          for (const item of enriched) {
            if (!seen.has(item.label.toLowerCase())) {
              resolvedValues.push(item);
              seen.add(item.label.toLowerCase());
            }
          }
        }
      } catch (err) {
        console.warn("Could not enrich level records for submission detail:", err);
      }
    }

    // If this is a consolidated dossier, aggregate child submissions
    if (s.category === "CONSOLIDATED" || s.module === "CONSOLIDATED" || (s as any).inConsolidatedReport) {
      try {
        const childSubs = await db.submission.findMany({
          where: {
            consolidatedReportId: s.id,
            id: { not: s.id },
          },
          select: { id: true, title: true, category: true, values: true },
        });
        for (const child of childSubs) {
          const childVals = parseJson<{ label: string; value: any; unit?: string }[]>(child.values, []);
          for (const cv of childVals) {
            const compositeLabel = `[${child.category}] ${cv.label}`;
            if (!resolvedValues.some((v) => v.label.toLowerCase() === compositeLabel.toLowerCase())) {
              resolvedValues.push({
                label: compositeLabel,
                value: cv.value,
                unit: cv.unit || "",
              });
            }
          }
        }
      } catch (err) {
        console.warn("Could not aggregate child submissions for consolidated dossier:", err);
      }
    }

    const submission: SubmissionDetail & Pick<
      ReturnType<typeof toBmSubmissionRow>,
      "reviewDeadline" | "reviewDeadlineLabel" | "isResubmission" | "daysRemaining" | "forwardedToBu" | "forwardedToBuAt" | "forwardedByName"
    > & { inConsolidatedReport?: boolean } = {
      ...toBmSubmissionRow(
        base,
        reviewCtx.reviewDeadline,
        reviewCtx.sourceLabel,
        s.dueDate.toISOString(),
        s.history,
        { forwardedToBu: s.forwardedToBu, forwardedToBuAt: s.forwardedToBuAt },
      ),
      inConsolidatedReport: Boolean((s as any).inConsolidatedReport),
      values: resolvedValues.map((v) => ({ label: v.label, value: v.value as any, unit: v.unit || "" })),
      evidence: parseJson<string[]>(s.evidence, []),
      comments: parseJson<{ author: string; role: string; text: string; at: string }[]>(s.comments, []),
      history: parseJson<{ action: string; actor: string; at: string; note?: string; priorValues?: unknown }[]>(s.history, []),
      validationIssues: issues,
    };
    return ok({
      submission,
      updatedAt: s.updatedAt.toISOString(),
      version: parseJson<unknown[]>(s.history, []).length + 1,
    });
  });
}
