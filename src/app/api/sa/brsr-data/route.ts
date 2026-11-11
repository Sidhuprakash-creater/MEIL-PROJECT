import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { saHandle, requireSubsidiaryAdmin, saLogActivity } from "@/lib/sa/server";
import { BRSR_SECTIONS, countFilledFields, type BrsrSectionsData } from "@/lib/brsr/sections";

export const dynamic = "force-dynamic";

const DEFAULT_PERIOD = "FY 2025-26";

/* GET /api/sa/brsr-data?period= — this subsidiary's BRSR data capture form. */
export async function GET(req: NextRequest) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const period = req.nextUrl.searchParams.get("period")?.trim() || DEFAULT_PERIOD;

    const row = await db.brsrSubsidiaryData.findUnique({
      where: { subsidiaryId_period: { subsidiaryId: ctx.subsidiaryId, period } },
    });

    const sections: BrsrSectionsData = row ? safeParse(row.sections) : {};
    const filledFields = countFilledFields(sections);
    const totalFields = BRSR_SECTIONS.reduce((n, s) => n + s.fields.length, 0);

    return ok({
      period,
      status: row?.status ?? "DRAFT",
      submittedAt: row?.submittedAt ? row.submittedAt.toISOString() : null,
      submittedBy: row?.submittedBy || "",
      sections,
      completeness: {
        filledFields,
        totalFields,
        pct: totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0,
      },
      updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
    });
  });
}

/* POST /api/sa/brsr-data — save (DRAFT) or submit (SUBMITTED) the form. */
export async function POST(req: NextRequest) {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const sub = await db.subsidiary.findUnique({ where: { id: ctx.subsidiaryId }, select: { name: true } });

    const body = (await req.json()) as { sections?: BrsrSectionsData; submit?: boolean; period?: string };
    const period = body.period?.trim() || DEFAULT_PERIOD;
    const incoming = body.sections ?? {};

    /* Keep only registry-known keys so the payload can't smuggle junk. */
    const clean: BrsrSectionsData = {};
    for (const section of BRSR_SECTIONS) {
      const fields = incoming[section.key] ?? {};
      clean[section.key] = {};
      for (const field of section.fields) {
        const v = fields[field.key];
        if (typeof v === "string") clean[section.key][field.key] = v.slice(0, 4000);
      }
    }

    const submitted = body.submit === true;
    const filledFields = countFilledFields(clean);
    const totalFields = BRSR_SECTIONS.reduce((n, s) => n + s.fields.length, 0);
    if (submitted && filledFields === 0) {
      throw Object.assign(new Error("Fill at least one field before submitting."), { status: 400 });
    }

    const row = await db.brsrSubsidiaryData.upsert({
      where: { subsidiaryId_period: { subsidiaryId: ctx.subsidiaryId, period } },
      create: {
        subsidiaryId: ctx.subsidiaryId,
        subsidiaryName: sub?.name ?? "",
        period,
        status: submitted ? "SUBMITTED" : "DRAFT",
        sections: JSON.stringify(clean),
        submittedAt: submitted ? new Date() : null,
        submittedBy: submitted ? ctx.name : "",
      },
      update: {
        sections: JSON.stringify(clean),
        status: submitted ? "SUBMITTED" : "DRAFT",
        submittedAt: submitted ? new Date() : undefined,
        submittedBy: submitted ? ctx.name : undefined,
        subsidiaryName: sub?.name ?? "",
      },
    });

    if (submitted) {
      await saLogActivity(ctx, sub?.name ?? "", {
        action: "BRSR_DATA_SUBMITTED",
        targetType: "BrsrSubsidiaryData",
        targetLabel: `${period} BRSR data — ${filledFields}/${totalFields} fields`,
        severity: "SUCCESS",
      });
    }

    return ok({
      status: row.status,
      submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
      completeness: {
        filledFields,
        totalFields,
        pct: totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0,
      },
    });
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
