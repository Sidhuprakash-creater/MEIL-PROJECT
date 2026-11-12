import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import {
  SaError, saHandle, requireSubsidiaryAdmin, getSubsidiaryOrThrow,
  saLogActivity, saLogAudit, saNotify, parseJson,
} from "@/lib/sa/server";

export const dynamic = "force-dynamic";

/* ═══════════════════════════════════════════════════════════════════════════
   GET  /api/sa/verification — the consolidated reports that the Subsidiary
        Manager approved and that now await the Subsidiary Admin's second
        (verification) step: a re-check of the numbers before the subsidiary
        may submit its final report to the Group.

   POST /api/sa/verification — the admin's decision on one such package:
        { submissionId, action: "verify" | "reject", reason? }
        verify → the dossier AND every disclosure folded into it become
                 APPROVED (the subsidiary may then submit to the Group)
        reject → the package goes back to the BU Manager with the remarks
   ═══════════════════════════════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const period = req.nextUrl.searchParams.get("period") ?? undefined;

    const rows = await db.submission.findMany({
      where: {
        subsidiaryId: ctx.subsidiaryId,
        status: "AWAITING_SA_VERIFICATION",
        ...(period ? { period } : {}),
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        ref: true,
        title: true,
        category: true,
        metricName: true,
        metricValue: true,
        metricUnit: true,
        values: true,
        evidenceCount: true,
        period: true,
        fiscalQuarter: true,
        projectId: true,
        businessUnitId: true,
        consolidatedReportId: true,
        inConsolidatedReport: true,
        submittedAt: true,
        updatedAt: true,
        submittedById: true,
        reviewerId: true,
        history: true,
        comments: true,
      },
    });

    /* Only the DOSSIER itself is a verification item — the disclosures folded
       into it travel with it and are shown as its members, not as separate
       verification rows. */
    const dossiers = rows.filter((r) => !r.inConsolidatedReport || !r.consolidatedReportId || r.id === r.consolidatedReportId);

    const [projects, units, users] = await Promise.all([
      db.project.findMany({ where: { businessUnit: { subsidiaryId: ctx.subsidiaryId } }, select: { id: true, name: true } }),
      db.businessUnit.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, select: { id: true, name: true } }),
      db.user.findMany({ where: { subsidiaryId: ctx.subsidiaryId }, select: { id: true, name: true } }),
    ]);
    const prjNames = new Map(projects.map((p) => [p.id, p.name]));
    const buNames = new Map(units.map((u) => [u.id, u.name]));
    const userNames = new Map(users.map((u) => [u.id, u.name]));

    /* For each dossier, list the disclosures folded into it so the admin can
       actually re-check the numbers that travelled up. */
    const dossierIds = dossiers.map((r) => r.consolidatedReportId ?? r.id);
    const folded = await db.submission.findMany({
      where: { consolidatedReportId: { in: dossierIds }, inConsolidatedReport: true },
      select: {
        id: true, ref: true, title: true, category: true, metricName: true,
        metricValue: true, metricUnit: true, status: true, projectId: true,
        submittedById: true, evidenceCount: true, reviewedAt: true,
        consolidatedReportId: true,
      },
    });

    const items = dossiers.map((r) => {
      const dossierId = r.consolidatedReportId ?? r.id;
      const members = folded.filter((f) => f.consolidatedReportId === dossierId && f.id !== dossierId);
      const byCategory = new Map<string, { category: string; label: string; value: number; unit: string; count: number }>();
      for (const m of members) {
        const key = m.category || "GENERAL";
        const g = byCategory.get(key) ?? { category: key, label: m.metricName || m.title, value: 0, unit: m.metricUnit || "", count: 0 };
        g.value += Number(m.metricValue || 0);
        g.count += 1;
        byCategory.set(key, g);
      }
      return {
        id: r.id,
        ref: r.ref,
        title: r.title,
        period: r.period,
        fiscalQuarter: r.fiscalQuarter,
        projectName: r.projectId ? prjNames.get(r.projectId) ?? "—" : "—",
        buName: r.businessUnitId ? buNames.get(r.businessUnitId) ?? "—" : "—",
        submittedBy: r.submittedById ? userNames.get(r.submittedById) ?? "—" : "—",
        reviewedBy: r.reviewerId ? userNames.get(r.reviewerId) ?? "—" : "—",
        submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
        updatedAt: r.updatedAt.toISOString(),
        evidenceCount: r.evidenceCount ?? 0,
        declarationCount: members.length,
        consolidatedValue: members.reduce((sum, m) => sum + Number(m.metricValue || 0), 0),
        categories: [...byCategory.values()].map((c) => ({
          category: c.category,
          label: c.label,
          value: Math.round(c.value * 100) / 100,
          unit: c.unit,
          count: c.count,
        })),
        members: members.map((m) => ({
          id: m.id,
          ref: m.ref,
          title: m.title,
          category: m.category,
          metricName: m.metricName,
          metricValue: m.metricValue,
          metricUnit: m.metricUnit,
          status: m.status,
          projectName: m.projectId ? prjNames.get(m.projectId) ?? "—" : "—",
          submittedBy: m.submittedById ? userNames.get(m.submittedById) ?? "—" : "—",
          evidenceCount: m.evidenceCount ?? 0,
        })),
        smComments: parseJson<{ author: string; role: string; text: string; at: string }[]>(r.comments, [])
          .filter((c) => c.role === "SUBSIDIARY_MANAGER")
          .map((c) => ({ author: c.author, text: c.text, at: c.at })),
      };
    });

    return ok({ items, total: items.length });
  });
}

export async function POST(req: NextRequest) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const sub = await getSubsidiaryOrThrow(ctx.subsidiaryId);
    const body = (await req.json().catch(() => ({}))) as {
      submissionId?: string;
      action?: string;
      reason?: string;
    };
    const submissionId = String(body.submissionId ?? "");
    const action = String(body.action ?? "");
    const reason = String(body.reason ?? "").trim();
    if (!submissionId) throw new SaError("submissionId is required.", 400);
    if (action !== "verify" && action !== "reject") {
      throw new SaError("Unknown action — use verify or reject.", 400);
    }
    if (action === "reject" && reason.length < 10) {
      throw new SaError("A meaningful reason (at least 10 characters) is mandatory when sending a package back.", 400);
    }

    const row = await db.submission.findUnique({ where: { id: submissionId } });
    if (!row) throw new SaError("Verification item not found.", 404);
    if (row.subsidiaryId !== ctx.subsidiaryId) {
      throw new SaError("This package belongs to another subsidiary.", 403);
    }
    if (row.status !== "AWAITING_SA_VERIFICATION") {
      throw new SaError(
        `This package is no longer awaiting verification — its current state is ${row.status.replace(/_/g, " ")}. Refresh the verification queue.`,
        409
      );
    }

    const now = new Date();
    const history = parseJson<{ action: string; actor: string; at: string; note?: string }[]>(row.history, []);
    const dossierId = row.consolidatedReportId ?? row.id;

    if (action === "verify") {
      /* Step 2 passed — the dossier and every disclosure folded into it become
         APPROVED, so the subsidiary's "Submit Final Report to Group" unlocks. */
      await db.submission.updateMany({
        where: { consolidatedReportId: dossierId, inConsolidatedReport: true },
        data: { status: "APPROVED", reviewedAt: now, reviewerId: ctx.userId, updatedAt: now },
      });
      await db.submission.updateMany({
        where: { id: row.id },
        data: {
          status: "APPROVED",
          reviewedAt: now,
          reviewerId: ctx.userId,
          history: JSON.stringify([
            ...history,
            {
              action: "VERIFIED_BY_SUBSIDIARY_ADMIN",
              actor: ctx.name,
              at: now.toISOString(),
              note: reason || "Consolidated numbers re-checked and verified by the Subsidiary Admin.",
            },
          ]),
          updatedAt: now,
        },
      });
      await db.report.updateMany({
        where: { id: dossierId },
        data: { status: "APPROVED" },
      });
    } else {
      await db.submission.updateMany({
        where: { consolidatedReportId: dossierId, inConsolidatedReport: true },
        data: { status: "CHANGES_REQUESTED", updatedAt: now },
      });
      await db.submission.updateMany({
        where: { id: row.id },
        data: {
          status: "CHANGES_REQUESTED",
          reviewedAt: now,
          reviewerId: ctx.userId,
          comments: JSON.stringify([
            ...parseJson<unknown[]>(row.comments, []),
            { author: ctx.name, role: "SUBSIDIARY_ADMIN", text: reason, at: now.toISOString() },
          ]),
          history: JSON.stringify([
            ...history,
            {
              action: "VERIFICATION_REJECTED_BY_SUBSIDIARY_ADMIN",
              actor: ctx.name,
              at: now.toISOString(),
              note: reason,
            },
          ]),
          updatedAt: now,
        },
      });
      await db.report.updateMany({
        where: { id: dossierId },
        data: { status: "CHANGES_REQUESTED" },
      });
    }

    await saNotify({
      ntype: "APPROVAL",
      title:
        action === "verify"
          ? `Subsidiary package verified: ${row.ref}`
          : `Subsidiary package sent back: ${row.ref}`,
      body:
        action === "verify"
          ? `${row.title} — verified by ${ctx.name} (Subsidiary Admin). The subsidiary may now submit its final report to the Group.`
          : `${row.title} — sent back by ${ctx.name} (Subsidiary Admin): ${reason.slice(0, 160)}`,
      severity: action === "verify" ? "SUCCESS" : "WARNING",
      linkView: "verification",
      refId: row.id,
      subsidiaryId: ctx.subsidiaryId,
    });

    await Promise.all([
      saLogActivity(ctx, sub.name, {
        action: action === "verify" ? "VERIFY_PACKAGE" : "REJECT_PACKAGE",
        targetType: "Consolidated Report",
        targetLabel: `${row.ref} — ${row.title}`,
        severity: action === "verify" ? "INFO" : "WARNING",
      }),
      saLogAudit(ctx, sub.code, {
        action: action === "verify" ? "PACKAGE_VERIFY" : "PACKAGE_REJECT",
        targetType: "Submission",
        targetId: row.id,
        targetLabel: `${row.ref} — ${row.title}`,
        before: { status: row.status },
        after: { status: action === "verify" ? "APPROVED" : "CHANGES_REQUESTED" },
        reason: reason || undefined,
      }),
    ]);

    return ok({
      success: true,
      status: action === "verify" ? "APPROVED" : "CHANGES_REQUESTED",
      message:
        action === "verify"
          ? `${row.ref} verified — the consolidated numbers are confirmed. "Submit Final Report to Group" is now unlocked.`
          : `${row.ref} sent back to the Business Unit with your remarks.`,
    });
  });
}
