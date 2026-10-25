import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/* GET /api/master/projects
   Active projects for the Project User Portal selector — includes the parent
   business unit + subsidiary names for scoping context. */
export async function GET() {
  const projects = await db.project.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      location: true,
      ptype: true,
      businessUnit: {
        select: {
          id: true,
          code: true,
          name: true,
          subsidiary: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json({
    projects: projects.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      location: p.location,
      ptype: p.ptype,
      businessUnitId: p.businessUnit.id,
      businessUnitName: p.businessUnit.name,
      subsidiaryId: p.businessUnit.subsidiary.id,
      subsidiaryName: p.businessUnit.subsidiary.name,
    })),
  });
}
