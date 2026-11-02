import { db } from "@/lib/db";
import { ok } from "@/lib/esg/server";
import { saHandle, requireSubsidiaryAdmin } from "@/lib/sa/server";
import type { SaBuTaskRow } from "@/lib/sa/types";

export const dynamic = "force-dynamic";

/* GET /api/sa/monitoring — receiver visibility for the Subsidiary Admin:
   tasks & deadlines raised by the subsidiary's business units (model Task,
   created on /api/ba/tasks). Read-only; BU task creation/mutation never
   happens on /api/sa/*. Newest first, capped at 20. */
export async function GET() {
  return saHandle(async () => {
    const ctx = await requireSubsidiaryAdmin();
    const now = new Date();

    const [tasks, units] = await Promise.all([
      db.task.findMany({
        where: { subsidiaryId: ctx.subsidiaryId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      db.businessUnit.findMany({
        where: { subsidiaryId: ctx.subsidiaryId },
        select: { id: true, name: true },
      }),
    ]);
    const buNames = new Map(units.map((u) => [u.id, u.name]));

    const buTasks: SaBuTaskRow[] = tasks.map((t) => ({
      id: t.id,
      ref: t.ref,
      title: t.title,
      buName: t.businessUnitId ? buNames.get(t.businessUnitId) ?? null : null,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate.toISOString(),
      overdue: t.dueDate.getTime() < now.getTime() && t.status !== "COMPLETED",
    }));

    return ok({ buTasks, total: buTasks.length });
  });
}
