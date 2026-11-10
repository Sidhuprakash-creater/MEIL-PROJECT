"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG — Project User Portal · organisation tree (database backed)

   The static portfolio (lib/pu/meil-portfolio.ts) only carries presentation
   details (icons, colours, descriptions) — its ids are legacy seed ids that
   do NOT exist in the database. Picking a project from it therefore produced
   an id the server could not resolve, and the portal silently fell back to
   the contributor's own project while the header showed somebody else's.

   This hook loads the REAL tree from /api/pu/organization/tree and merges
   the presentation attributes onto it (matched by CODE), so every selection
   resolves to a real project.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { MEIL_BUSINESS_UNITS, type MeilBusinessUnit } from "@/lib/pu/meil-portfolio";

export function useOrgTree() {
  const [dbTree, setDbTree] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/pu/organization/tree")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setDbTree(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const businessUnits = useMemo<MeilBusinessUnit[]>(() => {
    const groups = dbTree?.groups ?? [];
    if (!groups.length) return MEIL_BUSINESS_UNITS;
    const out: MeilBusinessUnit[] = [];
    for (const g of groups) {
      for (const sub of g.subsidiaries ?? []) {
        for (const bu of sub.businessUnits ?? []) {
          const stat = MEIL_BUSINESS_UNITS.find((b) => b.code === bu.code);
          out.push({
            ...((stat ?? {}) as any),
            id: bu.id,
            code: bu.code,
            name: bu.name,
            shortName: stat?.shortName ?? bu.name,
            subsidiaryCode: sub.code,
            subsidiaryName: sub.name,
            sector: stat?.sector ?? sub.sector ?? "",
            iconName: stat?.iconName ?? "Building2",
            accentColor: stat?.accentColor ?? "#0EA5E9",
            gradient: stat?.gradient ?? "from-sky-500 to-cyan-600",
            description: stat?.description ?? "",
            projects: (bu.projects ?? []).map((p: any) => {
              const code = p.projectCode ?? p.code;
              const st = stat?.projects.find((sp) => sp.code === code);
              return {
                ...((st ?? {}) as any),
                id: p.id,
                code,
                name: p.projectName ?? p.name,
                buId: bu.id,
                buName: bu.name,
                location: p.location ?? st?.location ?? "",
                stateOrCountry: st?.stateOrCountry ?? "",
                category: st?.category ?? "",
                status: (st?.status ?? "ACTIVE") as any,
                esgScore: st?.esgScore ?? 0,
                brsrCore: st?.brsrCore ?? false,
                reportingOwner: st?.reportingOwner ?? "",
                description: st?.description ?? "",
              };
            }),
          });
        }
      }
    }
    return out.length ? out : MEIL_BUSINESS_UNITS;
  }, [dbTree]);

  const findBu = useCallback(
    (id: string) => businessUnits.find((b) => b.id === id || b.code === id),
    [businessUnits],
  );

  const busOfSub = useCallback(
    (subCode: string) => businessUnits.filter((b) => b.subsidiaryCode === subCode),
    [businessUnits],
  );

  return { businessUnits, findBu, busOfSub, loading: !dbTree };
}
