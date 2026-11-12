import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handle, ok, fail, body, parseJson, logActivity, logAudit, ACTOR } from "@/lib/esg/server";
import type { BrsrReport, BrsrSection, BrsrDisclosure, BrsrSignoff } from "@/lib/esg/types";
import { ANNEXURE_I } from "@/lib/brsr/annexure1";

const STATUSES = ["DRAFT", "CONSOLIDATION", "VALIDATION", "REVIEW", "SIGNOFF", "FINALIZED"];

async function decorate(
  r: Awaited<ReturnType<typeof db.brsrReport.findMany>>[number],
  counts?: [number, number]
): Promise<BrsrReport> {
  const scopeRaw = parseJson<Partial<{ subsidiaryIds: string[]; businessUnitIds: string[]; projectIds: string[] }>>(r.scope, {});
  const scope = {
    subsidiaryIds: scopeRaw.subsidiaryIds ?? [],
    businessUnitIds: scopeRaw.businessUnitIds ?? [],
    projectIds: scopeRaw.projectIds ?? [],
  };
  const disclosures = parseJson<BrsrDisclosure[]>(r.disclosures, []);
  const sections = parseJson<BrsrSection[]>(r.sections, []);
  /* Source-data totals are global (not per-report): callers that already
     fetched them pass `counts` so no extra round-trip happens here. */
  const [srcCount, approvedCount] = counts ?? (await Promise.all([
    db.submission.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] } } }),
    db.submission.count({ where: { status: "APPROVED" } }),
  ]));
  const mappedCount = disclosures.filter((d) => d.mapped).length;
  const validatedCount = disclosures.filter((d) => d.status === "VALIDATED").length;
  const completionPct = disclosures.length
    ? Math.round(((mappedCount * 0.4 + validatedCount * 0.4 + Math.min(sections.length, 5) * 0.04) / Math.max(disclosures.length, 1)) * 100)
    : Math.round(Math.min(sections.length, 5) * 4);
  return {
    ...r,
    scope,
    sections,
    disclosures,
    signoffs: parseJson<BrsrSignoff[]>(r.signoffs, []),
    exports: parseJson(r.exports, []),
    versions: parseJson(r.versions, []),
    periodStart: r.periodStart?.toISOString() ?? null,
    periodEnd: r.periodEnd?.toISOString() ?? null,
    finalizedAt: r.finalizedAt?.toISOString() ?? null,
    completionPct,
    sourceSubmissionCount: srcCount,
    approvedSubmissionCount: approvedCount,
  };
}

async function consolidateForReport(report: Awaited<ReturnType<typeof db.brsrReport.findUniqueOrThrow>>) {
  /* Aggregate approved submissions (eligibility: APPROVED only — never silently include unapproved data) */
  const approved = await db.submission.findMany({ where: { status: "APPROVED" } });
  const byCategory: Record<string, number> = {};
  for (const s of approved) {
    byCategory[s.category] = (byCategory[s.category] ?? 0) + s.metricValue;
  }
  return { approved, byCategory };
}

export async function GET(req: NextRequest) {
  return handle(async () => {
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const [r, srcCount, approvedCount] = await Promise.all([
        db.brsrReport.findUnique({ where: { id } }),
        db.submission.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] } } }),
        db.submission.count({ where: { status: "APPROVED" } }),
      ]);
      if (!r) return fail("Report not found.", 404);
      return ok({ report: await decorate(r, [srcCount, approvedCount]) });
    }
    const [reports, catalog, missing, subs, srcCount, approvedCount] = await Promise.all([
      db.brsrReport.findMany({ orderBy: { createdAt: "desc" } }),
      db.disclosure.findMany({ orderBy: { code: "asc" } }),
      db.submission.findMany({ where: { status: { in: ["ASSIGNED", "SUBMITTED"] }, overdue: true }, take: 8 }),
      db.subsidiary.findMany({ select: { id: true, name: true } }),
      db.submission.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] } } }),
      db.submission.count({ where: { status: "APPROVED" } }),
    ]);
    const subMap = new Map(subs.map((s) => [s.id, s.name]));
    const decorated = await Promise.all(reports.map((r) => decorate(r, [srcCount, approvedCount])));
    const byYear: Record<string, { total: number; finalized: number; draft: number }> = {};
    for (const r of decorated) {
      (byYear[r.financialYear] ??= { total: 0, finalized: 0, draft: 0 });
      byYear[r.financialYear].total++;
      if (r.status === "FINALIZED") byYear[r.financialYear].finalized++;
      else byYear[r.financialYear].draft++;
    }
    return ok({
      reports: decorated,
      byYear: Object.entries(byYear).map(([year, v]) => ({ year, ...v })),
      catalog,
      missingSubmissions: missing.map((m) => ({
        ref: m.ref,
        title: m.title,
        org: m.subsidiaryId ? subMap.get(m.subsidiaryId) ?? "" : "",
        status: m.overdue ? "OVERDUE" : m.status,
      })),
      validationExceptions: decorated.reduce((a, r) => a + r.disclosures.filter((d) => d.status === "EXCEPTION").length, 0),
      pendingSignoffs: decorated.filter((r) => r.status === "SIGNOFF" || (r.status === "REVIEW" && r.signoffs.length < 2)).length,
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const b = await body<Record<string, string>>(req);

    /* Create new draft (wizard step 1) */
    if (b.action === "create") {
      if (!b.title?.trim()) return fail("Report title is required.");
      if (!b.financialYear) return fail("Reporting financial year is required.");
      const count = await db.brsrReport.count();
      const ref = `BRSR-${b.financialYear.replace(/\s/g, "").replace(/-/g, "")}-d${count + 1}`;
      const r = await db.brsrReport.create({
        data: {
          ref,
          title: b.title.trim(),
          financialYear: b.financialYear,
          framework: b.framework || "SEBI BRSR Core v1.0",
          periodStart: b.periodStart ? new Date(b.periodStart) : null,
          periodEnd: b.periodEnd ? new Date(b.periodEnd) : null,
          description: b.description || "",
          ownerName: ACTOR.name,
          status: "DRAFT",
          wizardStep: 2,
          versions: JSON.stringify([{ version: 1, at: new Date().toISOString(), by: ACTOR.name, note: "Wizard draft created." }]),
        },
      });
      await Promise.all([
        logActivity({ actorName: ACTOR.name, action: "REPORT_CREATE", targetType: "BRSR Report", targetLabel: `${r.ref} — ${r.title}` }),
        logAudit({ actorName: ACTOR.name, action: "BRSR_CREATE", targetType: "BrsrReport", targetId: r.id, targetLabel: r.ref, after: { status: "DRAFT", year: r.financialYear } }),
      ]);
      return ok({ report: await decorate(r) }, { status: 201 });
    }

    if (!b.id) return fail("Report id is required.");
    const r = await db.brsrReport.findUnique({ where: { id: b.id } });
    if (!r) return fail("Report not found.", 404);

    /* Lifecycle transitions */
    if (b.action === "transition") {
      const target = b.to as string;
      if (!STATUSES.includes(target)) return fail("Unknown lifecycle state.");
      const validNext: Record<string, string[]> = {
        DRAFT: ["CONSOLIDATION"],
        CONSOLIDATION: ["VALIDATION"],
        VALIDATION: ["REVIEW"],
        REVIEW: ["SIGNOFF"],
        SIGNOFF: ["FINALIZED"],
      };
      if (r.status !== "FINALIZED" && !validNext[r.status]?.includes(target)) {
        return fail(`Cannot move from ${r.status} to ${target}. Follow the workflow: Draft → Consolidation → Validation → Review → Sign-off → Finalized.`);
      }
      if (r.status === "FINALIZED") return fail("This report is finalized. Use a controlled revision to make changes.");

      const after: Record<string, unknown> = { status: target };
      if (target === "FINALIZED") {
        /* Finalization requirements: all disclosures validated or documented, ≥1 signoff */
        const disclosures = parseJson<BrsrDisclosure[]>(r.disclosures, []);
        const signoffs = parseJson<BrsrSignoff[]>(r.signoffs, []);
        const unresolved = disclosures.filter((d) => d.mapped && d.status !== "VALIDATED" && !d.note);
        if (unresolved.length > 0) return fail(`Cannot finalize: ${unresolved.length} disclosure(s) have unresolved validation issues. Resolve or document each exception first.`);
        if (signoffs.filter((s) => s.decision === "APPROVED").length < 1) return fail("Cannot finalize: at least one recorded sign-off is required.");
        after.finalizedAt = new Date();
      }
      const versions = parseJson<{ version: number; at: string; by: string; note: string }[]>(r.versions, []);
      const updated = await db.brsrReport.update({
        where: { id: r.id },
        data: {
          ...after,
          wizardStep: Math.max(r.wizardStep, STATUSES.indexOf(target) + 1),
          versions: JSON.stringify([...versions, { version: versions.length + 1, at: new Date().toISOString(), by: ACTOR.name, note: `Status → ${target}` }]),
          version: versions.length + 1,
        },
      });
      await Promise.all([
        logActivity({ actorName: ACTOR.name, action: target === "FINALIZED" ? "EXPORT" : "DATA_EDIT", targetType: "BRSR Report", targetLabel: `${r.ref} → ${target}`, severity: target === "FINALIZED" ? "SUCCESS" : "INFO" }),
        logAudit({ actorName: ACTOR.name, action: `BRSR_TRANSITION_${target}`, targetType: "BrsrReport", targetId: r.id, targetLabel: r.ref, before: { status: r.status }, after }),
      ]);
      return ok({ report: await decorate(updated), message: `Report moved to ${target}.` });
    }

    /* Record a sign-off */
    if (b.action === "signoff") {
      if (!b.role || !b.name || !b.decision) return fail("Sign-off role, name, and decision are required.");
      const signoffs = parseJson<BrsrSignoff[]>(r.signoffs, []);
      if (signoffs.some((s) => s.role === b.role)) return fail(`A sign-off for "${b.role}" is already recorded.`);
      signoffs.push({ role: b.role, name: b.name, decision: b.decision, at: new Date().toISOString(), comment: b.comment || "" });
      const updated = await db.brsrReport.update({ where: { id: r.id }, data: { signoffs: JSON.stringify(signoffs) } });
      await logAudit({ actorName: ACTOR.name, action: "BRSR_SIGNOFF", targetType: "BrsrReport", targetId: r.id, targetLabel: r.ref, after: { role: b.role, decision: b.decision } });
      return ok({ report: await decorate(updated), message: `Sign-off recorded for ${b.role}.` });
    }

    /* Recompute consolidation from approved source data */
    if (b.action === "recompute") {
      if (r.status === "FINALIZED") return fail("Finalized reports are locked. Revisions create a new controlled version instead.");
      const { byCategory } = await consolidateForReport(r);
      const catalog = await db.disclosure.findMany({ orderBy: { code: "asc" } });
      const existing = parseJson<BrsrDisclosure[]>(r.disclosures, []);

      /* Annexure I — the nine SEBI BRSR Core attributes. Their values are the
         roll-up of what the subsidiaries submitted through their BRSR Data
         forms (not the platform's category ledger), so they are read from the
         subsidiary data rows and rolled up exactly as SEBI prescribes:
         absolute quantities are summed, rates / percentages / intensities are
         averaged, and worst-case figures (LTIFR, days payable) take the max. */
      const annexureRows = await db.brsrSubsidiaryData.findMany({ where: { period: r.financialYear } });
      const annexureAgg = new Map<string, number[]>();
      const annexureText = new Map<string, string>();
      const ANNEXURE_PARAM_BY_KEY: Record<string, string> = {};
      for (const attr of ANNEXURE_I) {
        for (const p of attr.parameters) ANNEXURE_PARAM_BY_KEY[p.key] = p.aggregation;
      }
      for (const row of annexureRows) {
        const sections = safeParseSections(row.sections);
        for (const [secKey, values] of Object.entries(sections)) {
          if (!secKey.startsWith("annexure1.")) continue;
          for (const [k, v] of Object.entries(values)) {
            const raw = String(v).trim();
            if (!raw) continue;
            const n = Number(raw.replace(/,/g, ""));
            if (Number.isFinite(n)) {
              annexureAgg.set(k, [...(annexureAgg.get(k) ?? []), n]);
            } else if (!annexureText.has(k)) {
              /* A narrative parameter (waste recovered/disposed, RPT detail) —
                 the group's statement is the first subsidiary's, kept verbatim. */
              annexureText.set(k, raw);
            }
          }
        }
      }
      /* Annexure I parameter key → the group disclosure code it reports to. */
      const ANNEXURE_CODE: Record<string, string> = {
        scope1: "BRSR-A1-GHG-S1", scope2: "BRSR-A1-GHG-S2", ghgIntensityTurnover: "BRSR-A1-GHG-INT",
        waterConsumption: "BRSR-A1-WAT-CONS", waterIntensityTurnover: "BRSR-A1-WAT-INT",
        energyConsumed: "BRSR-A1-ENE-TOT", renewableShare: "BRSR-A1-ENE-REN", energyIntensityTurnover: "BRSR-A1-ENE-INT",
        plasticWaste: "BRSR-A1-WST-PLAS", ewaste: "BRSR-A1-WST-EWST", biomedicalWaste: "BRSR-A1-WST-BIO",
        cdWaste: "BRSR-A1-WST-CD", batteryWaste: "BRSR-A1-WST-BAT", radioactiveWaste: "BRSR-A1-WST-RAD",
        otherHazardousWaste: "BRSR-A1-WST-OH", otherNonHazardousWaste: "BRSR-A1-WST-ONH",
        totalWasteGenerated: "BRSR-A1-WST-TOT", wasteIntensityTurnover: "BRSR-A1-WST-INT",
        wellbeingSpend: "BRSR-A1-SAF-WB", ltifr: "BRSR-A1-SAF-LTIFR", fatalities: "BRSR-A1-SAF-FAT",
        femaleWageShare: "BRSR-A1-GEN-FWAGE", poshComplaints: "BRSR-A1-GEN-POSH",
        msmeProcurement: "BRSR-A1-INC-MSME", smallerTownWages: "BRSR-A1-INC-TOWN",
        dataBreachShare: "BRSR-A1-FAIR-DP", accountsPayableDays: "BRSR-A1-FAIR-DPO",
      };
      const annexureByCode = new Map<string, number>();
      for (const [paramKey, nums] of annexureAgg) {
        const code = ANNEXURE_CODE[paramKey];
        if (!code || !nums.length) continue;
        const mode = ANNEXURE_PARAM_BY_KEY[paramKey] ?? "sum";
        const value =
          mode === "avg"
            ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
            : mode === "max"
              ? Math.max(...nums)
              : Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100;
        annexureByCode.set(code, value);
      }
      /* Narrative parameters carry the group's statement as the value. */
      const ANNEXURE_TEXT_CODE: Record<string, string> = {
        wasteRecovered: "BRSR-A1-WST-REC", wasteDisposed: "BRSR-A1-WST-DSP",
        tradingHousePurchases: "BRSR-A1-OPEN-TH", rptShare: "BRSR-A1-OPEN-RPT",
      };
      const annexureTextByCode = new Map<string, string>();
      for (const [paramKey, text] of annexureText) {
        const code = ANNEXURE_TEXT_CODE[paramKey];
        if (code) annexureTextByCode.set(code, text);
      }

      const mapping: Record<string, string[]> = {
        "BRSR-ENV-01": ["ENERGY"],
        "BRSR-ENV-02": ["ENERGY"],
        "BRSR-ENV-04": ["EMISSIONS"],
        "BRSR-ENV-05": ["EMISSIONS"],
        "BRSR-ENV-06": ["WATER"],
        "BRSR-ENV-08": ["WASTE"],
        "BRSR-SOC-01": ["SAFETY"],
        "BRSR-SOC-02": ["WORKFORCE"],
        "BRSR-GOV-01": ["COMPLIANCE"],
        "BRSR-GOV-02": ["PROCUREMENT"],
        /* BRSR Core (C2) disclosure codes — same category aggregations. */
        "BRSR-C2-GEN-01": ["EMISSIONS"],
        "BRSR-C2-GEN-02": ["EMISSIONS"],
        "BRSR-C2-GEN-03": ["ENERGY"],
        "BRSR-C2-ENV-01": ["WATER"],
        "BRSR-C2-ENV-03": ["WASTE"],
        "BRSR-C2-SOC-01": ["WORKFORCE"],
        "BRSR-C2-SOC-02": ["WORKFORCE"],
        "BRSR-C2-SOC-07": ["CSR"],
        "BRSR-C2-SOC-08": ["CSR"],
        "BRSR-C2-GOV-01": ["COMPLIANCE"],
      };
      const disclosures: BrsrDisclosure[] = catalog.map((d) => {
        const prev = existing.find((e) => e.code === d.code);
        const cats = mapping[d.code];
        /* Annexure I codes carry the subsidiary data-form roll-up. */
        const annexureValue = annexureByCode.get(d.code);
        const value = annexureValue !== undefined
          ? annexureValue
          : cats
            ? cats.reduce((a, c) => a + (byCategory[c] ?? 0), 0)
            : null;
        /* A narrative Annexure I parameter (waste recovered/disposed, RPT
           detail) has no single number — the group's statement travels in the
           note so the disclosure still reads as reported. */
        const annexureNote = annexureTextByCode.get(d.code);
        return {
          code: d.code,
          title: d.title,
          mapped: prev?.mapped ?? false,
          status: value !== null && value > 0 ? "VALIDATED" : prev?.status === "EXCEPTION" ? "EXCEPTION" : prev?.mapped ? "PENDING" : prev?.status ?? "NOT_MAPPED",
          value,
          unit: d.unit,
          note: annexureNote ?? prev?.note ?? "",
        };
      });
      const updated = await db.brsrReport.update({
        where: { id: r.id },
        data: { disclosures: JSON.stringify(disclosures), status: r.status === "DRAFT" ? "CONSOLIDATION" : r.status, wizardStep: Math.max(r.wizardStep, 4) },
      });
      await logAudit({ actorName: ACTOR.name, action: "BRSR_RECOMPUTE", targetType: "BrsrReport", targetId: r.id, targetLabel: r.ref, after: { approvedSources: approvedCountSafe(byCategory) } });
      return ok({ report: await decorate(updated), message: "Consolidation recomputed from approved source submissions only." });
    }

    /* Export — record and return file content */
    if (b.action === "export") {
      const format = (b.format || "CSV").toUpperCase();
      if (!["CSV", "JSON", "TXT", "PDF"].includes(format)) return fail("Unsupported export format. Supported: CSV, JSON, TXT, PDF.");
      const d = await decorate(r);
      const exportsList = parseJson<{ format: string; at: string; by: string }[]>(r.exports, []);
      const rec = { format, at: new Date().toISOString(), by: ACTOR.name };
      await db.brsrReport.update({ where: { id: r.id }, data: { exports: JSON.stringify([...exportsList, rec]) } });
      await Promise.all([
        logActivity({ actorName: ACTOR.name, action: "EXPORT", targetType: "BRSR Report", targetLabel: `${r.ref} (${format})` }),
        logAudit({ actorName: ACTOR.name, action: "BRSR_EXPORT", targetType: "BrsrReport", targetId: r.id, targetLabel: r.ref, after: { format } }),
      ]);
      const meta = {
        ref: d.ref, title: d.title, financialYear: d.financialYear, framework: d.framework, status: d.status, version: d.version,
        period: { start: d.periodStart, end: d.periodEnd },
        scope: d.scope,
        disclosures: d.disclosures,
        sections: d.sections,
        signoffs: d.signoffs,
        exportedAt: rec.at, exportedBy: rec.by,
      };
      return ok({ report: d, export: rec, file: meta });
    }

    return fail(`Unknown action: ${b.action}`);
  });
}

function approvedCountSafe(byCategory: Record<string, number>) {
  return Object.entries(byCategory).map(([k, v]) => `${k}:${+v.toFixed(2)}`);
}

/** Parse a subsidiary's stored BRSR data sections. */
function safeParseSections(json: string): Record<string, Record<string, string>> {
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, Record<string, string>> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        out[k] = v as Record<string, string>;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const b = await body<Record<string, unknown>>(req);
    if (!b.id) return fail("Report id is required.");
    const r = await db.brsrReport.findUnique({ where: { id: String(b.id) } });
    if (!r) return fail("Report not found.", 404);
    if (r.status === "FINALIZED" && b.action !== "revise") return fail("Finalized reports are locked. Use a controlled revision.");

    const data: Record<string, unknown> = {};
    if (b.title !== undefined) data.title = String(b.title).trim() || r.title;
    if (b.description !== undefined) data.description = String(b.description);
    if (b.wizardStep !== undefined) data.wizardStep = Math.max(1, Math.min(9, parseInt(String(b.wizardStep), 10) || 1));
    if (b.scope !== undefined) data.scope = JSON.stringify(b.scope);
    if (b.sections !== undefined) data.sections = JSON.stringify(b.sections);
    if (b.disclosures !== undefined) data.disclosures = JSON.stringify(b.disclosures);

    /* Controlled revision of a finalized report */
    if (b.action === "revise") {
      const versions = parseJson<{ version: number; at: string; by: string; note: string }[]>(r.versions, []);
      data.status = "REVIEW";
      data.finalizedAt = null;
      data.version = versions.length + 1;
      data.versions = JSON.stringify([
        ...versions,
        { version: versions.length + 1, at: new Date().toISOString(), by: ACTOR.name, note: String(b.reason || "Controlled revision reopened the report."), snapshot: r.sections },
      ]);
    } else if (r.status === "DRAFT" || r.status === "CONSOLIDATION" || r.status === "VALIDATION" || r.status === "REVIEW") {
      const versions = parseJson<{ version: number; at: string; by: string; note: string }[]>(r.versions, []);
      if (b.sections !== undefined || b.disclosures !== undefined) {
        const note = b.sections !== undefined ? "Report builder content saved." : "Disclosure mapping updated.";
        const last = versions[versions.length - 1];
        if (!last || last.note !== note) {
          data.versions = JSON.stringify([...versions, { version: versions.length + 1, at: new Date().toISOString(), by: ACTOR.name, note }]);
          data.version = versions.length + 1;
        }
      }
    }

    const updated = await db.brsrReport.update({ where: { id: r.id }, data });
    await logAudit({
      actorName: ACTOR.name,
      action: b.action === "revise" ? "BRSR_REVISE" : "BRSR_UPDATE",
      targetType: "BrsrReport",
      targetId: r.id,
      targetLabel: r.ref,
      before: { status: r.status, wizardStep: r.wizardStep },
      after: { status: (data.status as string) ?? r.status, wizardStep: (data.wizardStep as number) ?? r.wizardStep },
      reason: typeof b.reason === "string" ? b.reason : undefined,
    });
    return ok({ report: await decorate(updated) });
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const b = await body<{ id?: string; reason?: string }>(req);
    if (!b.id) return fail("Report id is required.");
    const r = await db.brsrReport.findUnique({ where: { id: b.id } });
    if (!r) return fail("Report not found.", 404);
    if (r.status === "FINALIZED") return fail("Finalized reports cannot be deleted. They are part of the permanent reporting record.");
    await db.brsrReport.delete({ where: { id: r.id } });
    await logAudit({ actorName: ACTOR.name, action: "BRSR_DISCARD", targetType: "BrsrReport", targetId: r.id, targetLabel: r.ref, before: { status: r.status }, reason: b.reason ?? "Draft discarded by Group Admin" });
    return ok({ success: true });
  });
}
