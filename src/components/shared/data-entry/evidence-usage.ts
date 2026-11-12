/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG Platform — evidence usage rules for multi-source level records.

   A level record (Energy, Water, Waste, GHG …) is captured as SEVERAL source
   items — e.g. "Petrol" and "Coal" inside one Energy record. Each item
   carries its own evidence.

   Rule: ONE evidence document may support only ONE source item of a record.
   The same invoice must not be counted as the proof for two different fuels —
   the numbers would then double-count a single document, and the reviewer's
   evidence trail becomes meaningless.

   These helpers give every level form the same behaviour without duplicating
   the logic nine times.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Evidence ids already used by OTHER items of the same record. */
export function evidenceUsedByOtherItems(
  items: Array<{ id?: string; energySource?: string; sourceName?: string; evidenceId?: string; evidenceIds?: string[] }>,
  currentItemId?: string | null
): Set<string> {
  const used = new Set<string>();
  for (const item of items) {
    /* Skip the item currently being edited — its own evidence stays attached. */
    if (currentItemId && item.id === currentItemId) continue;
    for (const id of item.evidenceIds?.length ? item.evidenceIds : item.evidenceId ? [item.evidenceId] : []) {
      if (id) used.add(id);
    }
  }
  return used;
}

/** The ids of `selected` that are NOT already taken by another item. */
export function availableEvidenceIds(
  selected: string[],
  items: Array<{ id?: string; energySource?: string; sourceName?: string; evidenceId?: string; evidenceIds?: string[] }>,
  currentItemId?: string | null
): { allowed: string[]; blocked: string[] } {
  const used = evidenceUsedByOtherItems(items, currentItemId);
  const allowed: string[] = [];
  const blocked: string[] = [];
  for (const id of selected) {
    if (used.has(id)) blocked.push(id);
    else allowed.push(id);
  }
  return { allowed, blocked };
}

/** Human label of the item that already uses an evidence id. */
export function ownerOfEvidence(
  items: Array<{ id?: string; energySource?: string; sourceName?: string; name?: string; evidenceId?: string; evidenceIds?: string[] }>,
  evidenceId: string
): string | null {
  for (const item of items) {
    const ids = item.evidenceIds?.length ? item.evidenceIds : item.evidenceId ? [item.evidenceId] : [];
    if (ids.includes(evidenceId)) {
      return item.energySource || item.sourceName || item.name || "another source";
    }
  }
  return null;
}
