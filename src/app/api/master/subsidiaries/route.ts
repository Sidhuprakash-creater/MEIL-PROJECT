import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/* GET /api/master/subsidiaries — active subsidiaries for the portal picker.
   Sourced from the database master data (see prisma/seed.ts, configurable). */
export async function GET() {
  const subsidiaries = await db.subsidiary.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });

  return NextResponse.json({ ok: true, subsidiaries });
}
