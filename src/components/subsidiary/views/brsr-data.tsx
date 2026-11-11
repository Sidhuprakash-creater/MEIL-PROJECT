"use client";

// ── SUBSIDIARY ADMIN · BRSR Data Capture ─────────────────────────────────
// One structured form per reporting period covering everything the Group
// Admin's consolidated BRSR report needs from this subsidiary beyond the
// regular ESG disclosures (entity profile, workforce, policies, methodology,
// emission factors, exclusions...).

import { useEffect, useState } from "react";
import { CheckCircle2, FileText, RefreshCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Chip, EmptyState, ErrorState, GlassCard, GlassProgress, LoadingBlock, PageHeader, SectionCard,
} from "@/components/workspace/ui";
import { useSaWorkspace } from "@/lib/sa/store";
import { apiPost, useSaApi } from "@/lib/sa/client";
import { BRSR_SECTIONS, type BrsrSectionsData } from "@/lib/brsr/sections";

type BrsrDataResp = {
  period: string;
  status: string;
  submittedAt: string | null;
  submittedBy: string;
  sections: BrsrSectionsData;
  completeness: { filledFields: number; totalFields: number; pct: number };
  updatedAt: string | null;
};

type SaveResp = { status: string; submittedAt: string | null; completeness: BrsrDataResp["completeness"] };

export default function BrsrDataView() {
  const { reportingYear } = useSaWorkspace();
  const { toast } = useToast();
  const { data, loading, error, refetch } = useSaApi<BrsrDataResp>(
    `/api/sa/brsr-data?period=${encodeURIComponent(reportingYear)}`,
    { deps: [reportingYear] }
  );

  const [values, setValues] = useState<BrsrSectionsData>({});
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);
  const [hydrated, setHydrated] = useState<string | null>(null);

  /* Hydrate the local form whenever fresh server data lands for a period. */
  useEffect(() => {
    if (data && hydrated !== `${reportingYear}:${data.updatedAt ?? "empty"}`) {
      setValues(data.sections ?? {});
      setHydrated(`${reportingYear}:${data.updatedAt ?? "empty"}`);
    }
  }, [data, reportingYear, hydrated]);

  const set = (sectionKey: string, fieldKey: string, value: string) =>
    setValues((v) => ({ ...v, [sectionKey]: { ...(v[sectionKey] ?? {}), [fieldKey]: value } }));

  const save = async (submit: boolean) => {
    setSaving(submit ? "submit" : "draft");
    try {
      const res = await apiPost<SaveResp>("/api/sa/brsr-data", { sections: values, submit, period: reportingYear });
      toast({
        title: submit ? "BRSR data submitted to Group Admin" : "Draft saved",
        description: `${res.completeness.filledFields}/${res.completeness.totalFields} fields completed.`,
      });
      await refetch();
    } catch (err: any) {
      toast({ title: submit ? "Submit failed" : "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  if (loading && !data) return <div className="view-in space-y-4 pb-6"><LoadingBlock rows={6} label="Loading BRSR data form…" /></div>;
  if (error && !data) return <div className="view-in space-y-4 pb-6"><ErrorState message={error} onRetry={refetch} /></div>;
  if (!data) return null;

  const submitted = data.status === "SUBMITTED";
  const pct = data.completeness.pct;

  return (
    <div className="view-in space-y-4 pb-6">
      <PageHeader
        title="BRSR Data"
        description={`${reportingYear} · Everything the Group Admin's consolidated BRSR report needs from your subsidiary beyond the regular disclosures.`}
        icon={FileText}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
              <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => save(false)} disabled={saving !== null || submitted}>
              {saving === "draft" ? "Saving…" : "Save Draft"}
            </Button>
            <Button size="sm" onClick={() => save(true)} disabled={saving !== null || submitted}>
              <Send className="mr-1.5 h-3.5 w-3.5" /> {saving === "submit" ? "Submitting…" : "Submit to Group"}
            </Button>
          </div>
        }
      />

      {/* ── completion hero ── */}
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--ink-faint)]">
              Template completeness — {reportingYear}
            </div>
            <h2 className="mt-1 text-[19px] font-bold tracking-tight text-[color:var(--ink)]">
              {data.completeness.filledFields}/{data.completeness.totalFields} fields completed
            </h2>
            {submitted ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-[#1d6b40]">
                <CheckCircle2 className="h-3.5 w-3.5" /> Submitted to the Group Admin&apos;s BRSR workflow.
              </p>
            ) : (
              <p className="mt-1.5 text-[12px] text-[color:var(--ink-faint)]">
                Save a draft anytime — submit once every section that applies to you is filled.
              </p>
            )}
          </div>
          {submitted && <Chip tone="green">SUBMITTED</Chip>}
        </div>
        <div className="mt-4">
          <GlassProgress value={pct} tone={pct >= 80 ? "green" : pct >= 40 ? "blue" : "amber"} />
        </div>
      </GlassCard>

      {/* ── section forms ── */}
      {BRSR_SECTIONS.map((section) => {
        const secValues = values[section.key] ?? {};
        const filledInSection = section.fields.filter((f) => (secValues[f.key] ?? "").trim() !== "").length;
        return (
          <SectionCard
            key={section.key}
            title={section.title}
            description={section.description}
            icon={FileText}
            actions={<Chip tone={filledInSection === section.fields.length ? "green" : filledInSection > 0 ? "amber" : "gray"}>{filledInSection}/{section.fields.length}</Chip>}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {section.fields.map((field) => (
                <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                  <label className="mb-1.5 block text-[12px] font-semibold text-[color:var(--ink-soft)]">
                    {field.label}
                    {field.hint && <span className="ml-1.5 font-normal text-[color:var(--ink-faint)]">({field.hint})</span>}
                  </label>
                  {field.type === "textarea" ? (
                    <Textarea
                      className="min-h-[76px] text-[13px]"
                      value={secValues[field.key] ?? ""}
                      onChange={(e) => set(section.key, field.key, e.target.value)}
                      disabled={submitted}
                      placeholder="Enter response…"
                    />
                  ) : (
                    <Input
                      className="text-[13px]"
                      type={field.type === "number" ? "number" : "text"}
                      value={secValues[field.key] ?? ""}
                      onChange={(e) => set(section.key, field.key, e.target.value)}
                      disabled={submitted}
                      placeholder="Enter value…"
                    />
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        );
      })}

      {submitted && (
        <EmptyState
          title="Data already submitted"
          message="This period's BRSR data has been submitted to the Group Admin. Contact the Group office if a correction is needed."
          icon={CheckCircle2}
        />
      )}
    </div>
  );
}
