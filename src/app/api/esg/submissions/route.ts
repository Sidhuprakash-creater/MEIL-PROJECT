import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handle, ok, fail, body, parseJson, logActivity, logAudit, ACTOR } from "@/lib/esg/server";
import { ROLE_LABELS } from "@/lib/esg/types";
import type { Submission } from "@/lib/esg/types";

async function decorate(ids?: { id: string }): Promise<Submission[]> {
  const [subs, units, projects, users] = await Promise.all([
    db.subsidiary.findMany({ select: { id: true, name: true } }),
    db.businessUnit.findMany({ select: { id: true, name: true } }),
    db.project.findMany({ select: { id: true, name: true } }),
    db.user.findMany({ select: { id: true, name: true, role: true } }),
  ]);
  const subMap = new Map(subs.map((s) => [s.id, s.name]));
  const unitMap = new Map(units.map((u) => [u.id, u.name]));
  const projMap = new Map(projects.map((p) => [p.id, p.name]));
  const userMap = new Map(users.map((u) => [u.id, u]));
  const rows = ids?.id
    ? await db.submission.findMany({ where: { id: ids.id } })
    : await db.submission.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map((s) => {
    const submitter = s.submittedById ? userMap.get(s.submittedById) : null;
    const reviewer = s.reviewerId ? userMap.get(s.reviewerId) : null;
    return {
      ...s,
      subsidiaryName: s.subsidiaryId ? subMap.get(s.subsidiaryId) : null,
      businessUnitName: s.businessUnitId ? unitMap.get(s.businessUnitId) : null,
      projectName: s.projectId ? projMap.get(s.projectId) : null,
      submittedByName: submitter?.name ?? null,
      submittedByRole: submitter?.role ?? null,
      reviewerName: reviewer?.name ?? null,
      values: parseJson(s.values, []),
      evidence: parseJson(s.evidence, []),
      comments: parseJson(s.comments, []),
      history: parseJson(s.history, []),
      dueDate: s.dueDate.toISOString(),
      submittedAt: s.submittedAt?.toISOString() ?? null,
      reviewedAt: s.reviewedAt?.toISOString() ?? null,
    } as Submission;
  });
}

export async function GET(req: NextRequest) {
  return handle(async () => {
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const list = await decorate({ id });
      if (!list.length) return fail("Submission not found.", 404);
      return ok({ submission: list[0] });
    }
    return ok({ submissions: await decorate() });
  });
}

/** Workflow transitions for a submission. */
const TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  approve: { from: ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"], to: "APPROVED" },
  reject: { from: ["SUBMITTED", "UNDER_REVIEW"], to: "REJECTED" },
  request_changes: { from: ["SUBMITTED", "UNDER_REVIEW"], to: "CHANGES_REQUESTED" },
  return: { from: ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"], to: "ASSIGNED" },
  reopen: { from: ["APPROVED", "REJECTED"], to: "UNDER_REVIEW" },
  start_review: { from: ["SUBMITTED"], to: "UNDER_REVIEW" },
};

export async function POST(req: NextRequest) {
  return handle(async () => {
    const b = await body<Record<string, string | string[] | undefined>>(req);

    /* Bulk or single review decision */
    const action = String(b.action ?? "");
    if (["approve", "reject", "request_changes", "return", "reopen", "start_review"].includes(action)) {
      const ids = Array.isArray(b.ids) ? b.ids : b.id ? [String(b.id)] : [];
      if (!ids.length) return fail("No submissions selected.");
      const reason = typeof b.reason === "string" ? b.reason : "";
      const comment = typeof b.comment === "string" ? b.comment : "";
      if (["reject", "request_changes", "return"].includes(action) && (!reason || reason.trim().length < 4)) {
        return fail("A reason of at least 4 characters is required for this decision.");
      }
      const results: { id: string; ok: boolean; error?: string }[] = [];
      const t = TRANSITIONS[action];
      for (const id of ids) {
        const s = await db.submission.findUnique({ where: { id } });
        if (!s) {
          results.push({ id, ok: false, error: "Not found" });
          continue;
        }
        if (!t.from.includes(s.status)) {
          results.push({ id, ok: false, error: `Cannot ${action.replace("_", " ")} from ${s.status}` });
          continue;
        }
        const comments = parseJson<{ author: string; role: string; text: string; at: string }[]>(s.comments, []);
        const history = parseJson<{ action: string; actor: string; at: string }[]>(s.history, []);
        const now = new Date();
        const newComment =
          reason || comment
            ? [...comments, { author: ACTOR.name, role: "GROUP_ADMIN", text: reason || comment || "", at: now.toISOString() }]
            : comments;
        await db.submission.update({
          where: { id },
          data: {
            status: t.to,
            reviewedAt: now,
            reviewerId: s.reviewerId ?? "admin",
            comments: JSON.stringify(newComment),
            history: JSON.stringify([
              ...history,
              { action: `${action.replace("_", " ")} by ${ACTOR.name}`, actor: ACTOR.name, at: now.toISOString() },
            ]),
          },
        });
        await db.notification.create({
          data: {
            ntype: "APPROVAL",
            title: `Submission ${action.replace("_", " ")}: ${s.ref}`,
            body: `${s.title} — decision recorded by Group Admin${reason ? `: ${reason.slice(0, 80)}` : ""}.`,
            severity: action === "approve" ? "SUCCESS" : action === "reject" ? "CRITICAL" : "WARNING",
            linkView: "submissions",
            refId: id,
          },
        });
        await Promise.all([
          logActivity({
            actorName: ACTOR.name,
            action: action === "approve" ? "APPROVE" : action === "reject" ? "REJECT" : "DATA_EDIT",
            targetType: "Submission",
            targetLabel: `${s.ref} — ${s.title}`,
            severity: action === "approve" ? "INFO" : "WARNING",
          }),
          logAudit({
            actorName: ACTOR.name,
            action: `SUBMISSION_${action.toUpperCase()}`,
            targetType: "Submission",
            targetId: id,
            targetLabel: `${s.ref} — ${s.title}`,
            before: { status: s.status },
            after: { status: t.to },
            reason: reason || undefined,
          }),
        ]);
        results.push({ id, ok: true });
      }
      const failed = results.filter((r) => !r.ok);
      return ok({
        results,
        success: failed.length === 0,
        message:
          failed.length === 0
            ? `${results.length} submission${results.length > 1 ? "s" : ""} ${action === "approve" ? "approved" : "updated"} successfully.`
            : `${results.length - failed.length} updated, ${failed.length} failed: ${failed.map((f) => f.error).join("; ")}`,
      });
    }

    /* Bulk flag overdue recompute (scheduler-like utility) */
    if (action === "recompute_overdue") {
      const now = Date.now();
      const open = await db.submission.findMany({ where: { status: { in: ["ASSIGNED", "SUBMITTED", "UNDER_REVIEW"] } } });
      let count = 0;
      for (const s of open) {
        const shouldBe = s.dueDate.getTime() < now;
        if (shouldBe !== s.overdue) {
          await db.submission.update({ where: { id: s.id }, data: { overdue: shouldBe } });
          count++;
        }
      }
      return ok({ message: `Recomputed overdue flags on ${count} submissions.` });
    }

    /* Create submission */
    if (action === "create") {
      const title = typeof b.title === "string" ? b.title : "";
      if (!title.trim()) return fail("Submission title is required.");
      const count = await db.submission.count();
      const ref = `SUB-2526-${String(count + 1).padStart(3, "0")}`;
      const s = await db.submission.create({
        data: {
          ref,
          title: title.trim(),
          category: (typeof b.category === "string" && b.category) || "ENVIRONMENT",
          metricName: (typeof b.metricName === "string" && b.metricName) || "",
          metricValue: parseFloat(String(b.metricValue ?? "0")) || 0,
          metricUnit: (typeof b.metricUnit === "string" && b.metricUnit) || "",
          status: "SUBMITTED",
          period: (typeof b.period === "string" && b.period) || "FY 2025-26",
          dueDate: typeof b.dueDate === "string" && b.dueDate ? new Date(b.dueDate) : new Date(Date.now() + 14 * 86400000),
          submittedAt: new Date(),
          subsidiaryId: (typeof b.subsidiaryId === "string" && b.subsidiaryId) || null,
          businessUnitId: (typeof b.businessUnitId === "string" && b.businessUnitId) || null,
          projectId: (typeof b.projectId === "string" && b.projectId) || null,
          submittedById: (typeof b.submittedById === "string" && b.submittedById) || null,
          values: JSON.stringify(Array.isArray(b.values) ? b.values : []),
          evidence: JSON.stringify(Array.isArray(b.evidence) ? b.evidence : []),
          history: JSON.stringify([{ action: `Created & submitted by ${ACTOR.name}`, actor: ACTOR.name, at: new Date().toISOString() }]),
        },
      });
      await Promise.all([
        logActivity({ actorName: ACTOR.name, action: "SUBMIT", targetType: "Submission", targetLabel: `${s.ref} — ${s.title}` }),
        logAudit({ actorName: ACTOR.name, action: "SUBMISSION_CREATE", targetType: "Submission", targetId: s.id, targetLabel: s.ref, after: { status: "SUBMITTED" } }),
      ]);
      return ok({ submission: s }, { status: 201 });
    }

    return fail(`Unknown action: ${action}`);
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const b = await body<Record<string, string>>(req);
    if (!b.id) return fail("id is required.");
    const s = await db.submission.findUnique({ where: { id: b.id } });
    if (!s) return fail("Submission not found.", 404);
    if (["APPROVED"].includes(s.status)) return fail("Approved submissions cannot be discarded — they are part of the reporting record.");
    if (s.status !== "DRAFT") return fail("Only draft submissions can be discarded. Use review actions for submitted data.");
    await db.submission.delete({ where: { id: b.id } });
    await logAudit({ actorName: ACTOR.name, action: "SUBMISSION_DISCARD", targetType: "Submission", targetId: s.id, targetLabel: `${s.ref} — ${s.title}`, before: { status: s.status }, reason: b.reason });
    return ok({ success: true });
  });
}

void ROLE_LABELS;
