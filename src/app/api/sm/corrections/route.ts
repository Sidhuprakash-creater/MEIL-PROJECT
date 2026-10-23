import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { smHandle, requireSubsidiaryManager, parseJson } from "@/lib/sm/server";
import type { CorrectionsResponse, CorrectionRow } from "@/lib/sm/types";

export const dynamic = "force-dynamic";

/* GET /api/sm/corrections — the Corrections & Rejections screen dataset.
   · corrections:    REJECTED / CHANGES_REQUESTED reports with their rejection
                     details (reviewer, reason, instructions, affected window)
   · resubmissions:  corrected reports that re-entered review (SUBMITTED /
                     UNDER_REVIEW whose history records a resubmission)
   Rejection reason extraction: the latest comment authored by a reviewer
   (SUBSIDIARY_MANAGER / GROUP_ADMIN), falling back to the last history note. */
export async function GET() {
  return smHandle(async () => {
    const ctx = await requireSubsidiaryManager();

    const [all, units, projects, users] = await Promise.all([
      db.submission.findMany({
        where: { subsidiaryId: ctx.subsidiaryId },
        orderBy: { updatedAt: "desc" },
      }),
      db.businessUnit.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, select: { id: true, name: true } }),
      db.project.findMany({ where: { businessUnit: { subsidiaryId: ctx.subsidiaryId } }, select: { id: true, name: true } }),
      db.user.findMany({ select: { id: true, name: true } }),
    ]);
    const buNames = new Map(units.map((u) => [u.id, u.name]));
    const projectNames = new Map(projects.map((p) => [p.id, p.name]));
    const userNames = new Map(users.map((u) => [u.id, u.name]));

    const REVIEWER_ROLES = new Set(["SUBSIDIARY_MANAGER", "GROUP_ADMIN"]);

    const buildRow = (s: (typeof all)[number]): CorrectionRow => {
      const comments = parseJson<{ author: string; role: string; text: string; at: string }[]>(s.comments, []);
      const history = parseJson<{ action: string; actor: string; at: string; note?: string }[]>(s.history, []);
      const reviewComment = [...comments].reverse().find((c) => REVIEWER_ROLES.has(c.role));
      const reviewHistory = [...history].reverse().find((h) => /reject/i.test(h.action) || (h.note ?? "").length > 0 && /reject/i.test(`${h.action} ${h.note ?? ""}`));
      const reason = reviewComment?.text ?? reviewHistory?.note ?? "";
      const instructions = reviewComment && reviewComment.text.includes("Correction instructions:")
        ? reviewComment.text.split("Correction instructions:")[1]?.trim() ?? ""
        : "";
      const hasResub = history.some((h) => `${h.action ?? ""} ${h.note ?? ""}`.toLowerCase().includes("resubmit"));
      return {
        id: s.id,
        ref: s.ref,
        title: s.title,
        level: s.projectId ? "PROJECT" : "BU",
        buName: s.businessUnitId ? buNames.get(s.businessUnitId) ?? null : null,
        projectName: s.projectId ? projectNames.get(s.projectId) ?? null : null,
        status: s.status,
        rejectedAt: s.reviewedAt?.toISOString() ?? null,
        reviewerName: s.reviewerId ? userNames.get(s.reviewerId) ?? null : null,
        reason,
        instructions,
        responsibleName: s.submittedById ? userNames.get(s.submittedById) ?? null : null,
        resubmittedAt: hasResub ? s.submittedAt?.toISOString() ?? s.updatedAt.toISOString() : null,
        isResubmission: hasResub && ["SUBMITTED", "UNDER_REVIEW"].includes(s.status),
        correctionDueDate: s.dueDate.toISOString(),
        lastUpdated: s.updatedAt.toISOString(),
      };
    };

    const rejectedRows = all
      .filter((s) => ["REJECTED", "CHANGES_REQUESTED"].includes(s.status))
      .map(buildRow);
    const resubmittedRows = all
      .filter((s) => ["SUBMITTED", "UNDER_REVIEW"].includes(s.status))
      .filter((s) => parseJson<{ action?: string; note?: string }[]>(s.history, []).some((h) => `${h.action ?? ""} ${h.note ?? ""}`.toLowerCase().includes("resubmit")))
      .map(buildRow);

    const response: CorrectionsResponse = {
      corrections: rejectedRows,
      resubmissions: resubmittedRows,
      counts: {
        rejected: rejectedRows.length,
        awaitingCorrection: rejectedRows.filter((r) => !r.isResubmission).length,
        resubmitted: resubmittedRows.length,
      },
    };
    return ok(response);
  });
}
