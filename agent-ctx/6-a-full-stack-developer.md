# Task ID: 6-a — full-stack-developer (views 1-6)

## Work record

Implemented Screens 01-06 of the MEIL ESG & BRSR Group Admin Workspace as drop-in default-export `"use client"` components at `src/components/workspace/views/`:

| # | File | Screen |
|---|------|--------|
| 1 | `dashboard.tsx` | 01 Group Command Center |
| 2 | `notifications.tsx` | 02 Notifications & Alerts |
| 3 | `hierarchy.tsx` | 03 Organization Hierarchy |
| 4 | `subsidiaries.tsx` | 04 Subsidiary Management |
| 5 | `units.tsx` | 05 Business Unit Management |
| 6 | `projects.tsx` | 06 Project & Site Management |

### Key decisions
- **Contract adherence**: only shared components from `@/components/workspace/ui`, navigation via `useWorkspace` (`navigate` / `openDetail`), data via `useApi` / `useMutation` / `apiPost|Patch|Delete` from `@/lib/esg/client`, types from `@/lib/esg/types`. No cross-view imports.
- **Detail mode**: `params.detailId` + fresh list fetch + `find(id)`; tabs rendered with `GlassTabBar`; remount keyed by `${id}:${detailTab}` so `params.detailTab` is honored as the initial tab without setState-in-effect lint errors.
- **Forms**: keyed form components mounted inside GlassDialog children initialize state from the editing row on mount (no effects); validation (name required min 2; parent required for BU/project) with inline Field errors.
- **Mutations**: `useMutation.run` + success toast + `refetch()`; server errors surfaced through effect-watched `mut.error` → destructive toast (shows exact server refusals, e.g. "Cannot deactivate: … has business units"); PATCH `warning` surfaced as a second toast.
- **Charts**: Recharts in `ResponsiveContainer` with glass custom tooltips; dashboard line chart uses dual Y axes (emissions left, renewable % right); project Metrics tab uses a horizontal BarChart of submissions per category.
- **Hierarchy**: recursive tree with descendant-aware search filtering, status filter, expand/collapse-all, AnimatePresence height animation, per-node stats chips and cross-module openDetail.

### Verification
- `bunx tsc --noEmit`: 0 errors in the 6 files.
- `bun run lint`: 0 problems in the 6 files (remaining repo issues are in `roles.tsx`/`tasks.tsx` — other agents' scope).
- curl smoke tests: `/` plus all consumed endpoints (`dashboard`, `org?type=subsidiaries|business-units|projects` (+`&light=1`), `users`, `submissions`, `hierarchy`, `notifications`) → HTTP 200 with payload shapes matching `types.ts`.

### Handoff notes / API observations
- `dashboard.orgProgress` has no entity id → subsidiary drill-down resolved via name→id match against the decorated subsidiaries list (fallback: navigate to list).
- `notifications.linkView` is a bare view id → row click navigates to the view root (refId not passed as detailId to avoid wrong-detail behavior in foreign views).
- `PATCH /api/esg/org` may return `warning` — handled and shown.
- Notifications PATCH/POST actions: `read | unread | read-all | dismiss` all work as documented.

Full details appended to `worklog.md` under "Task ID: 6-a".
