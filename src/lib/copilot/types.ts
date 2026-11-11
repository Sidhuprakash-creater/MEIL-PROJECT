// MEIL Intelligence — shared contracts between the copilot API, the tool
// registry, and the adaptive response renderer. Every structured block the
// model is allowed to emit must match one of these types; the renderer falls
// back to safe text for anything else.

/* ── Content blocks (Phase 21 structured-response protocol) ─────────────────── */

export type ContentBlockType =
  | "text"
  | "executive_summary"
  | "kpi"
  | "data_table"
  | "chart"
  | "comparison"
  | "entity_profile"
  | "submission"
  | "approval_timeline"
  | "evidence"
  | "activity_timeline"
  | "recommendation"
  | "action_preview"
  | "confirmation"
  | "follow_ups";

export type RiskLevel = "L0" | "L1" | "L2" | "L3" | "L4";

export interface KpiItem {
  label: string;
  value: string;
  unit?: string;
  delta?: string; // e.g. "+4.2%"
  deltaDirection?: "up" | "down" | "flat";
  hint?: string; // scope/period context
}

export interface KpiBlock {
  type: "kpi";
  title?: string;
  period?: string;
  scope?: string;
  items: KpiItem[];
}

export interface TableRow {
  cells: (string | number | null)[];
}

export interface DataTableBlock {
  type: "data_table";
  title?: string;
  columns: { key: string; label: string; align?: "left" | "right" | "center" }[];
  rows: TableRow[];
  note?: string; // data-source note, e.g. "Source: Submission ledger, FY 2025-26"
}

export interface ChartSeries {
  name: string;
  points: { label: string; value: number }[];
}

export interface ChartBlock {
  type: "chart";
  title?: string;
  chartType: "bar" | "line" | "donut" | "scatter";
  unit?: string;
  period?: string;
  scope?: string;
  calculationBasis?: string;
  series: ChartSeries[];
  /** Optional drill target: navigating clicking a chart point to a view. */
  drillView?: "submissions" | "analytics" | "approvals" | "consolidation";
}

export interface ComparisonBlock {
  type: "comparison";
  title?: string;
  entityLabels: string[];
  metrics: { label: string; unit?: string; values: (number | null)[]; winner?: number }[];
  period?: string;
}

export interface ExecutiveSummaryBlock {
  type: "executive_summary";
  title?: string;
  period?: string;
  scope?: string;
  summary: string;
  highlights: string[];
}

export interface EntityProfileBlock {
  type: "entity_profile";
  entityType: "subsidiary" | "business_unit" | "project" | "user" | "group";
  entityId: string;
  name: string;
  code?: string;
  status?: string;
  subtitle?: string;
  fields: { label: string; value: string }[];
  navView?: ViewNav;
}

export interface SubmissionRefBlock {
  type: "submission";
  submissionId: string;
  ref: string;
  title: string;
  status: string;
  deadlineStatus?: string; // kept separate from workflow status (Phase 18)
  period?: string;
  entity?: string;
  submittedAt?: string;
  submittedBy?: string;
  reviewer?: string;
  dueDate?: string;
  overdue?: boolean;
  metric?: { name: string; value: number; unit: string };
  navView?: ViewNav;
}

export interface ApprovalTimelineBlock {
  type: "approval_timeline";
  title?: string;
  submissionRef?: string;
  events: {
    actor: string;
    role?: string;
    action: string;
    decision?: "APPROVED" | "REJECTED" | "RETURNED" | "REVIEW" | "SUBMITTED" | "RESUBMITTED" | "NOTE";
    comment?: string;
    at: string;
  }[];
}

export interface EvidenceRefBlock {
  type: "evidence";
  evidenceId: string;
  name: string;
  docType?: string;
  status?: string;
  fileType?: string;
  version?: number;
  uploadedBy?: string;
  uploadedAt?: string;
  submissionRef?: string;
  entity?: string;
}

export interface ActivityTimelineBlock {
  type: "activity_timeline";
  title?: string;
  events: { actor: string; role?: string; action: string; target?: string; at: string }[];
}

export interface RecommendationBlock {
  type: "recommendation";
  recommendationId: string;
  title: string;
  explanation: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  scope?: string;
  period?: string;
  supportingRecords?: { label: string; view: ViewNav; refId?: string }[];
  whyItMatters?: string;
  suggestedAction?: { label: string; view?: ViewNav; prompt?: string };
  /** "data" = derived directly from records; "estimate"/"ai" = AI interpretation. */
  basis: "data" | "estimate" | "ai";
}

export interface ActionPreviewBlock {
  type: "action_preview";
  actionName: string;
  title: string;
  explanation: string;
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
  confirmationId?: string;
  summary?: string;
  affected?: string[];
  params?: Record<string, unknown>;
  expiresAt?: string;
}

export interface ConfirmationBlock {
  type: "confirmation";
  confirmationId: string;
  title: string;
  explanation: string;
  riskLevel: RiskLevel;
  affected?: string[];
  recipients?: string[];
  impact?: string;
  params?: Record<string, unknown>;
  expiresAt?: string;
}

export interface FollowUpsBlock {
  type: "follow_ups";
  questions: string[];
}

export type ContentBlock =
  | { type: "text"; text: string }
  | ExecutiveSummaryBlock
  | KpiBlock
  | DataTableBlock
  | ChartBlock
  | ComparisonBlock
  | EntityProfileBlock
  | SubmissionRefBlock
  | ApprovalTimelineBlock
  | EvidenceRefBlock
  | ActivityTimelineBlock
  | RecommendationBlock
  | ActionPreviewBlock
  | ConfirmationBlock
  | FollowUpsBlock;

/* ── Navigation: where a card action can send the admin ─────────────────────── */

export interface ViewNav {
  view: string; // Group workspace ViewId
  detailId?: string;
  detailTab?: string;
  label?: string;
}

/* ── Source traceability (Phase 22) ─────────────────────────────────────────── */

export interface SourceReference {
  kind: "submission" | "evidence" | "activity" | "audit" | "brsr" | "record" | "task" | "package" | "timeline" | "user";
  id: string;
  label: string;
  entity?: string;
  period?: string;
  detailView?: ViewNav;
  updatedAt?: string;
}

/* ── Streaming envelope (SSE events) ───────────────────────────────────────── */

export type ChatStreamEvent =
  | { kind: "status"; state: AvatarState; label: string }
  | { kind: "activity"; id: string; tool: string; label: string; status: "RUNNING" | "COMPLETED" | "FAILED"; detail?: string; startedAt: string; finishedAt?: string; error?: string }
  | { kind: "delta"; text: string }
  | { kind: "block"; block: ContentBlock }
  | { kind: "sources"; sources: SourceReference[] }
  | { kind: "message_done"; messageId: string; avatarState: AvatarState }
  | { kind: "error"; message: string; code?: string; retryAfter?: number }
  | { kind: "done" };

export type AvatarState =
  | "idle"
  | "excited"
  | "listening"
  | "thinking"
  | "searching"
  | "retrieving"
  | "analyzing"
  | "generating"
  | "success"
  | "warning"
  | "error"
  | "waiting"
  | "confirmation"
  | "cancelled"
  | "offline";

/* ── Tool registry types ────────────────────────────────────────────────────── */

export interface ToolParamSchema {
  type: "string" | "number" | "boolean" | "enum" | "array";
  description?: string;
  enum?: string[];
  optional?: boolean;
  items?: ToolParamSchema;
}

export interface ToolDefinition {
  name: string;
  description: string;
  riskLevel: RiskLevel; // read tools are L0; prepare_* tools are L2/L3
  params: Record<string, ToolParamSchema>;
}

export interface ToolResult {
  summary: string; // concise execution summary for the activity panel
  data?: unknown; // JSON-safe payload handed back to the model
  blocks?: ContentBlock[]; // structured blocks to append to the response
  sources?: SourceReference[];
  error?: string;
}

export type ToolHandler = (args: Record<string, unknown>, ctx: CopilotRequestContext) => Promise<ToolResult>;

/* ── Request context ────────────────────────────────────────────────────────── */

export interface CopilotRequestContext {
  userId: string;
  userName: string;
  userRole: string;
  conversationId: string;
  reportingYear: string;
}

/* ── Confirmation lifecycle ─────────────────────────────────────────────────── */

export interface PreparedAction {
  actionName: string;
  title: string;
  explanation: string;
  riskLevel: RiskLevel;
  summary: string;
  affected?: string[];
  recipients?: string[];
  impact?: string;
  params: Record<string, unknown>;
}

export interface PreparedActionResult {
  block: ActionPreviewBlock | ConfirmationBlock;
  sources?: SourceReference[];
}

/* ── Conversation persistence shapes ───────────────────────────────────────── */

export interface ConversationSummary {
  id: string;
  title: string;
  pinned: boolean;
  lastAt: string;
  messageCount: number;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  blocks: ContentBlock[];
  sources: SourceReference[];
  createdAt: string;
  meta?: Record<string, unknown>;
}

export interface ConversationContext {
  viewId?: string;
  reportingYear?: string;
  orgScope?: string;
}
