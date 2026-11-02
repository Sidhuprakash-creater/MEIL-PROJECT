import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { bmHandle, requireBuManager, parseJson } from "@/lib/bm/server";
import type { CorrectionsResponse, CorrectionRow } from "@/lib/bm/types";

export const dynamic = "force-dynamic";

/* GET /api/bm/corrections — the Corrections & Rejections screen dataset.
   · corrections:   REJECTED / CHANGES_REQUESTED reports with their rejection
                    details (reviewer, reason, instructions, correction window)
   · resubmissions: corrected reports that re-entered review (SUBMITTED /
                    UNDER_REVIEW / CHANGES_REQUESTED whose history records a
                    resubmission after rejection)
   Rejection reason extraction: the latest comment authored by a reviewer
   (BU_MANAGER / SUBSIDIARY_MANAGER / GROUP_ADMIN), falling back to the last
   history note. The full reviewer comment (reason + instructions + affected
   fields) is preserved in `reason` for the corrections detail card; the
   `instructions` field carries the actionable correction portion. */
export async function GET() {
  return bmHandle(async () => {
    const ctx = await requireBuManager();

    const [all, users, projects] = await Promise.all([
      db.submission.findMany({
        where: { businessUnitId: ctx.businessUnitId },
        orderBy: { updatedAt: "desc" },
      }),
      db.user.findMany({ select: { id: true, name: true } }),
      db.project.findMany({ where: { businessUnitId: ctx.businessUnitId }, select: { id: true, name: true } }),
    ]);
    const userNames = new Map(users.map((u) => [u.id, u.name]));
    const projectNames = new Map(projects.map((p) => [p.id, p.name]));

    const REVIEWER_ROLES = new Set(["BU_MANAGER", "SUBSIDIARY_MANAGER", "GROUP_ADMIN"]);

    const buildRow = (s: (typeof all)[number]): CorrectionRow => {
      const comments = parseJson<{ author: string; role: string; text: string; at: string }[]>(s.comments, []);
      const history = parseJson<{ action: string; actor: string; at: string; note?: string }[]>(s.history, []);
      const reviewComment = [...comments].reverse().find((c) => REVIEWER_ROLES.has(c.role));
      const reviewHistory = [...history].reverse().find((h) => /reject|return/i.test(h.action) || (h.note ?? "").length > 0 && /reject|return/i.test(`${h.action} ${h.note ?? ""}`));
      const fullText = reviewComment?.text ?? reviewHistory?.note ?? "";
      const reasonText = fullText.split("Correction instructions:")[0]?.trim() || fullText || "";
      const instructionsPart = fullText.includes("Correction instructions:")
        ? fullText.split("Correction instructions:")[1]?.trim() ?? ""
        : "";
      const hasResub = history.some((h) => `${h.action ?? ""} ${h.note ?? ""}`.toLowerCase().includes("resubmit"));
      const responsibleName = s.submittedById ? userNames.get(s.submittedById) ?? null : null;
      const projectName = s.projectId ? projectNames.get(s.projectId) ?? null : null;
      return {
        id: s.id,
        ref: s.ref,
        title: s.title,
        level: s.projectId ? "PROJECT" : "BU",
        projectName,
        status: s.status,
        rejectedAt: s.reviewedAt?.toISOString() ?? null,
        reviewerName: s.reviewerId ? userNames.get(s.reviewerId) ?? null : null,
        reason: reasonText,
        instructions: instructionsPart,
        responsibleName,
        resubmittedAt: hasResub ? s.submittedAt?.toISOString() ?? s.updatedAt.toISOString() : null,
        isResubmission: hasResub && ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"].includes(s.status),
        correctionDueDate: s.dueDate.toISOString(),
        lastUpdated: s.updatedAt.toISOString(),
      };
    };

    const rejectedRows = all
      .filter((s) => ["REJECTED", "CHANGES_REQUESTED"].includes(s.status))
      .map(buildRow);
    const resubmittedRows = all
      .filter((s) => ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"].includes(s.status))
      .filter((s) => parseJson<{ action?: string; note?: string }[]>(s.history, []).some((h) => `${h.action ?? ""} ${h.note ?? ""}`.toLowerCase().includes("resubmit")))
      .map(buildRow)
      .filter((r) => !rejectedRows.some((x) => x.id === r.id));

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
