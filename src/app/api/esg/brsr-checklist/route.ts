import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { BRSR_SECTIONS, countFilledFields, countFilledSections, type BrsrSectionsData } from "@/lib/brsr/sections";

export const dynamic = "force-dynamic";

/* GET /api/esg/brsr-checklist?period= — Group Admin view: which subsidiaries
   have supplied the BRSR template data, section-wise completion and what is
   still missing. Consumed by the "BRSR Data Checklist" view. */
export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period")?.trim() || "FY 2025-26";
  const totalFields = BRSR_SECTIONS.reduce((n, s) => n + s.fields.length, 0);

  const [subsidiaries, rows] = await Promise.all([
    db.subsidiary.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, code: true, region: true }, orderBy: { name: "asc" } }),
    db.brsrSubsidiaryData.findMany({ where: { period } }),
  ]);
  const bySub = new Map(rows.map((r) => [r.subsidiaryId, r]));

  const subsidiariesOut = subsidiaries.map((s) => {
    const row = bySub.get(s.id);
    const sections: BrsrSectionsData = row ? safeParse(row.sections) : {};
    const filledFields = countFilledFields(sections);
    const completedSections = countFilledSections(sections);
    const sectionStatus = BRSR_SECTIONS.map((sec) => ({
      key: sec.key,
      title: sec.title,
      completed: sec.fields.every((f) => (sections[sec.key]?.[f.key] ?? "").trim() !== ""),
      started: sec.fields.some((f) => (sections[sec.key]?.[f.key] ?? "").trim() !== ""),
    }));
    return {
      subsidiaryId: s.id,
      subsidiaryName: s.name,
      subsidiaryCode: s.code,
      region: s.region,
      status: row?.status ?? "NOT_STARTED",
      submittedAt: row?.submittedAt ? row.submittedAt.toISOString() : null,
      submittedBy: row?.submittedBy || "",
      completeness: {
        filledFields,
        totalFields,
        pct: totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0,
        completedSections,
        totalSections: BRSR_SECTIONS.length,
      },
      sectionStatus,
    };
  });

  const submitted = subsidiariesOut.filter((s) => s.status === "SUBMITTED").length;
  const started = subsidiariesOut.filter((s) => s.completeness.filledFields > 0).length;

  return ok({
    period,
    totalFields,
    summary: {
      subsidiaries: subsidiariesOut.length,
      submitted,
      started,
      notStarted: subsidiariesOut.length - started,
    },
    subsidiaries: subsidiariesOut,
  });
}

function safeParse(json: string): BrsrSectionsData {
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
