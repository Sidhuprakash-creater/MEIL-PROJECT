# TODO — Batch #3 (2026-11-06): Motion Loader + Project Admin Review Screen + Task Assignment check

## Task list
- [ ] T1. Unique motion-animated loader component (shared) — branded, well-designed (MEIL ring/
      or liquid-glass shimmer, framer-motion), used where screens/data load
      (submissions list, data entry root, dashboards, admin data-collection status).
- [ ] T2. Project Admin "Data Collection Status" screen upgrades:
  - [ ] 2a. Verify submissions data shows properly (list correctness).
  - [ ] 2b. Replace small popup card with a full-window review screen opening phase-by-phase
        cards: 1) submitted-by user header, 2) project info, 3) submission data grouped
        emission-level → sources (fully detailed) → evidences tagged to their source/emission,
        repeating per emission level. Everything clickable, nothing editable.
  - [ ] 2c. Rejection flow — admin multi-selects items/sources/data (turns red), optional
        per-selection clarification text, "Submit Rejection" → existing reject endpoint with
        structured field identifiers.
  - [ ] 2d. Rejection mirror for the submission user — same full-window layout, selected/
        rejected items marked red with the admin's per-item clarification + general comment.
  - [ ] 2e. Evidence split-view — evidence preview opens in the same window (data panel shrinks
        left, evidence panel right) so admin sees both at once; includes Download.
  - [ ] 2f. Refinements/polish of the above (glass aesthetic, keyboard Esc close, sticky action
        bar, selection summary counter).
- [ ] T3. Verify task assignment works for every user (find the assignment flow, test endpoint
      and assignment routes, fix if broken).

Execution order: T2a survey first (mid grounding), T1 loader early (used inside T2 screens),
then T2b→2e, then T3 audit.
