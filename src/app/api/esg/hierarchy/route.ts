import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handle, ok } from "@/lib/esg/server";
import type { HierarchyNode } from "@/lib/esg/types";

export async function GET() {
  return handle(async () => {
    const [subs, units, projects, users, submissions] = await Promise.all([
      db.subsidiary.findMany({ orderBy: { name: "asc" } }),
      db.businessUnit.findMany({ orderBy: { name: "asc" } }),
      db.project.findMany({ include: { businessUnit: true }, orderBy: { name: "asc" } }),
      db.user.findMany({ select: { id: true, subsidiaryId: true, businessUnitId: true, projectId: true } }),
      db.submission.findMany({ select: { subsidiaryId: true, businessUnitId: true, projectId: true } }),
    ]);

    const nodes: HierarchyNode[] = subs.map((s) => {
      const sUnits = units.filter((u) => u.subsidiaryId === s.id);
      const subProjects = projects.filter((p) => p.businessUnit.subsidiaryId === s.id);
      const sSubs = submissions.filter((x) => x.subsidiaryId === s.id);
      return {
        id: s.id,
        type: "subsidiary",
        code: s.code,
        name: s.name,
        status: s.status,
        meta: `${s.sector} · ${s.city}, ${s.region}`,
        manager: s.managerName,
        stats: { users: users.filter((u) => u.subsidiaryId === s.id).length, projects: subProjects.length, submissions: sSubs.length },
        children: sUnits.map((u) => {
          const uProjects = projects.filter((p) => p.businessUnitId === u.id);
          const uSubs = submissions.filter((x) => x.businessUnitId === u.id);
          return {
            id: u.id,
            type: "unit",
            code: u.code,
            name: u.name,
            status: u.status,
            meta: `Business Unit of ${s.name}`,
            manager: u.managerName,
            stats: { users: users.filter((x) => x.businessUnitId === u.id).length, projects: uProjects.length, submissions: uSubs.length },
            children: uProjects.map((p) => ({
              id: p.id,
              type: "project" as const,
              code: p.code,
              name: p.name,
              status: p.status,
              meta: `${p.ptype.replaceAll("_", " ")} · ${p.location}${p.capacityMw ? ` · ${p.capacityMw} MW` : ""}`,
              manager: "",
              stats: { users: users.filter((x) => x.projectId === p.id).length, projects: 0, submissions: submissions.filter((x) => x.projectId === p.id).length },
            })),
          };
        }),
      };
    });

    return ok({ nodes });
  });
}
