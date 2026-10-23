# Subsidiary Admin VIEW implementation guide (read me before writing any view)

## File contract
- One file per view: `src/components/subsidiary/views/<id>.tsx` — **default export**, `"use client"` at top.
- View ids: dashboard (done, your reference), notifications, units, projects, users, roles,
  timelines, submissions, monitoring, evidence, comms, esg, validation, analytics, activity, settings.

## State & data
```ts
import { useSaWorkspace } from "@/lib/sa/store";       // view, params, navigate, reportingYear
import { useSaApi, useMutation, apiPost, apiPatch, apiDelete, fmtDate, fmtDateTime, timeAgo, fmtNumber, daysUntil, downloadFile, toCsv } from "@/lib/sa/client";
import type { UnitRow, ProjectRow, ... } from "@/lib/sa/types";
```
- `const { data, loading, error, refetch } = useSaApi<T>("/api/sa/<x>", { deps: [reportingYear] })` — polling (15s live refresh) is built in; do NOT add your own intervals.
- The reporting-year selector lives in the shell; include it in the query string as `?period=${encodeURIComponent(reportingYear)}` and list it in `deps`.
- Read deep-link params from `useSaWorkspace((s) => s.params)`: e.g. `params.create` (timestamp → open create dialog on mount), `params.detailId` (open detail), `params.tab`, `params.statusFilter`, `params.level`, `params.q`. Consume with `useEffect` and clear them by calling `navigate("<same view>")` once handled.
- Navigation: `navigate("monitoring", { level: "BU", statusFilter: "submitted" })`. Cross-view KPI clicks MUST use these params.

## Shared UI (import from "@/components/workspace/ui")
GlassCard({strong,subtle,interactive}), PageHeader({title,description,icon:<ComponentType>,actions,breadcrumbs}),
SectionCard({title,description,icon:<ComponentType>,actions,children,noPad,subtle}),
StatusBadge({status,dot}), KpiCard({label,value,icon,tone:"blue"|"green"|"amber"|"red"|"purple",trend,hint,onClick}),
Toolbar({search,onSearch,filters:[{key,label,value,options:[{value,label}],onChange}],onReset,right,resultCount}),
DataTable<T>({columns,rows,loading,error,onRetry,pageSize,onRowClick,emptyTitle,emptyMessage,emptyAction,rowActions,mobileCard,toolbar}),
Column<T> = { key,label,className?,sortValue?:(row)=>number|string,render?:(row)=>ReactNode } (render REPLACES the cell; hide on mobile carefully),
ExportButton({filename,rows}), GlassDialog({open,onOpenChange,title,description,children,footer,wide}),
ConfirmDialog({open,onOpenChange,title,message,confirmLabel,destructive,requireReason,onConfirm(reason?),pending}),
DetailSheet/GlassTabBar({tabs:[{value,label,icon,count}],value,onChange}), Field({label,required,error,hint,children}),
Avatar({name,size}), InfoRow({label,children}), EmptyState({title,message,action,icon}), ErrorState({message,onRetry}),
LoadingBlock({rows,label}), Chip({tone:"blue"|"green"|"amber"|"red"|"purple"|"gray",children}),
GlassProgress({value,tone:"blue"|"green"|"amber"|"red"|"purple",showLabel}), CountUp({value,format}),
ActionButton({pending,...ButtonProps}), FadeList, TipIconButton({tip,...}).
Form inputs: shadcn `Input`, `Select(SelectTrigger/SelectContent/SelectItem/SelectValue)`, `Textarea`, `Switch`, `Checkbox` from "@/components/ui/*" with className "glass-subtle rounded-2xl border-white/60 text-sm" like the group views.
Toast: `const { toast } = useToast()` from "@/hooks/use-toast"; toast({ title, description }) on every mutation success/failure.

## Icons
- iOS set from "@/components/workspace/premium-icons" (UnitsIcon, ProjectsIcon, PeopleIcon, FilesIcon, CheckSealIcon, HourglassIcon, AlarmAlertIcon, TaskCheckIcon, ReportChartIcon, MegaphoneIcon, FileCheckIcon, DatabaseIcon, WorkflowIcon, TrendIcon, GaugeIcon, PulseIcon, BellIcon, NetworkIcon, ShieldIcon, GearIcon, UserPlusIcon, OrgIcon).
- lucide-react for generic glyphs (Plus, Pencil, Power, Download, Eye, MoreHorizontal, ArrowRight...).
- KPI/Section icon props want a **ComponentType** (e.g. `icon={FilesIcon}`), NOT `<FilesIcon/>` elements.

## Style rules (iOS liquid glass)
- Primary action button: `<Button className="btn-action">` (liquid green #20a779 — create/save/submit/send).
- Destructive: `variant="destructive"`; secondary: `variant="outline" className="glass-subtle rounded-2xl border-white/60"`.
- Cards: rounded-3xl default via GlassCard; consistent p-4/p-6, gap-3/gap-4.
- Long lists: wrap in `nice-scroll max-h-[420px] overflow-y-auto` (contain scrolling).
- Motion: `<motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}>` sparingly; root `<div className="view-in space-y-4 pb-6">`.
- Responsive: grid `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`; tables get mobileCard renderers.

## Functionality contract (MANDATORY)
1. Every button/menu/dropdown/tab/filter/card MUST do something real (dialog, mutation, navigation, export, filter).
2. Forms: client validation via Field error + submit through real apiPost/apiPatch; show toasts; close dialog only on success; refetch after mutations.
3. Destructive/sensitive ops (deactivate, suspend, delete, reset credential) go through ConfirmDialog (requireReason where the API demands a reason).
4. NO approve/reject/decision controls anywhere (that's the Subsidiary Manager's job) — show review decisions read-only.
5. Loading/empty/error states everywhere; ErrorState with onRetry={refetch}.
6. Exports use ExportButton/toCsv/downloadFile with the CURRENT filtered rows.
7. Detail views: open as GlassDialog or DetailSheet WITHOUT losing list context; ESC/back returns cleanly.
8. Cross-console sync: never cache write results locally — refetch() after every mutation.

## Detail data
Detail endpoints return composites (see contract). Render tabs via GlassTabBar:
Overview / Team / Projects / Submissions / Timelines / Analytics / Activity per entity as applicable.
