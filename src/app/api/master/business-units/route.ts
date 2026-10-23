import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/* GET /api/master/business-units?subsidiaryId=…
   Returns ONLY the active business units belonging to the requested
   subsidiary — the dependent dropdown never sees cross-subsidiary rows. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subsidiaryId = searchParams.get("subsidiaryId");

  if (!subsidiaryId) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION", message: "subsidiaryId is required." },
      { status: 400 }
    );
  }

  const subsidiary = await db.subsidiary.findUnique({
    where: { id: subsidiaryId },
    select: { id: true, status: true },
  });

  if (!subsidiary || subsidiary.status !== "ACTIVE") {
    return NextResponse.json(
      { ok: false, code: "NOT_FOUND", message: "Subsidiary not found." },
      { status: 404 }
    );
  }

  const businessUnits = await db.businessUnit.findMany({
    where: { subsidiaryId: subsidiary.id, status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, subsidiaryId: true },
  });

  return NextResponse.json({ ok: true, businessUnits });
}
