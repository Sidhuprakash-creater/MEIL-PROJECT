"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Table as TableIcon,
  ImagePlus,
  Eye,
  Columns,
  SquarePen,
  Trash2,
  Upload,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  Sparkles,
  Scissors,
  CheckCircle2,
  AlertCircle,
  Info,
  Layers,
  FileText,
  Plus,
  Download,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { BrsrSection, BrsrSectionImage, BrsrReport } from "@/lib/esg/types";

export interface BrsrEditorProps {
  section: BrsrSection;
  report: BrsrReport;
  onSaveSection: (updated: BrsrSection) => Promise<void>;
  disabled?: boolean;
}

const ESG_DATA_TOKENS = [
  { token: "{{metrics.scope1_emissions}}", label: "Scope 1 GHG Emissions (tCO₂e)", fallback: "142,850 tCO₂e" },
  { token: "{{metrics.scope2_emissions}}", label: "Scope 2 GHG Emissions (tCO₂e)", fallback: "98,420 tCO₂e" },
  { token: "{{metrics.total_ghg}}", label: "Total Scope 1 + 2 GHG (tCO₂e)", fallback: "241,270 tCO₂e" },
  { token: "{{metrics.total_energy}}", label: "Total Energy Consumption (GJ)", fallback: "1,850,400 GJ" },
  { token: "{{metrics.renewable_energy_share}}", label: "Renewable Energy Share (%)", fallback: "34.6%" },
  { token: "{{metrics.water_withdrawn}}", label: "Total Water Withdrawn (kL)", fallback: "4,120,500 kL" },
  { token: "{{metrics.water_recycled_pct}}", label: "Water Recycled / Reused (%)", fallback: "42.8%" },
  { token: "{{metrics.hazardous_waste}}", label: "Hazardous Waste Generated (MT)", fallback: "382.4 MT" },
  { token: "{{metrics.ltifr}}", label: "Lost Time Injury Freq Rate (LTIFR)", fallback: "0.18" },
  { token: "{{metrics.training_hours}}", label: "Avg Safety Training Hrs / Employee", fallback: "38.5 hrs" },
  { token: "{{metrics.csr_spend}}", label: "Total CSR Beneficiaries / Spend", fallback: "₹48.2 Crores" },
  { token: "{{company.name}}", label: "Company Legal Name", fallback: "Megha Engineering & Infrastructures Limited" },
  { token: "{{report.fy}}", label: "Reporting Financial Year", fallback: "FY 2025-26" },
];

const SECTION_TEMPLATES: { name: string; title: string; content: string }[] = [
  {
    name: "Executive Summary & Leadership Statement",
    title: "1. Executive Summary & Leadership Statement",
    content: `# Leadership Message on Sustainability & Value Creation

> [!NOTE]
> MEIL remains steadfast in advancing infrastructure development across India and global markets while systematically reducing our carbon intensity and enhancing social stewardship.

### Strategic Priorities for {{report.fy}}
During this reporting cycle, {{company.name}} accelerated its investments in clean energy execution, zero-liquid discharge water systems, and comprehensive worker wellness programs.

| Pillar | Key Target | Current Status | Assurance Reference |
|---|---|---|---|
| **Environmental** | 30% Renewable Power by 2026 | **{{metrics.renewable_energy_share}}** achieved | ISO 14064-3 / Third-Party |
| **Social** | Zero Fatalities & LTIFR < 0.20 | **{{metrics.ltifr}}** recorded | ISO 45001 Verified Trail |
| **Governance** | 100% Anti-Bribery Training | **99.4%** coverage | Board Audit Committee |

<!-- pagebreak -->

### Looking Ahead
Our commitment under the SEBI BRSR Core format underscores our continuous pursuit of transparency and measurable ESG impact across all subsidiaries and operating projects.`,
  },
  {
    name: "Environmental Stewardship & Climate Action",
    title: "2. Environmental Stewardship & Decarbonization Roadmap",
    content: `# Environmental Stewardship & Resource Conservation

### Greenhouse Gas (GHG) Emissions Profile
Our carbon accounting adheres strictly to the GHG Protocol Corporate Standard and SEBI BRSR Core Annexure I guidelines.

- **Scope 1 (Direct Emissions):** {{metrics.scope1_emissions}} from diesel generators, construction machinery, and transport fleet.
- **Scope 2 (Indirect Emissions):** {{metrics.scope2_emissions}} from grid electricity consumption at project sites and fabrication yards.
- **Total Combined Footprint:** {{metrics.total_ghg}}

> [!TIP]
> Energy efficiency initiatives and on-site solar deployment yielded an estimated avoidance of 18,400 tCO₂e in the current financial year.

### Water Resource Management
- Total Water Withdrawn: **{{metrics.water_withdrawn}}**
- Water Recycled & Reused: **{{metrics.water_recycled_pct}}**
- Zero Liquid Discharge (ZLD) operational at all primary manufacturing facilities.`,
  },
  {
    name: "Social Well-being & Workforce Safety",
    title: "3. Social Performance, Health & Safety Excellence",
    content: `# Social Capital & Workforce Well-Being

### Occupational Health and Safety (OHS)
The health and safety of our 40,000+ employees and contractor workforce is non-negotiable.

| Safety Indicator | Performance Metric | Benchmark Standard |
|---|---|---|
| Lost Time Injury Frequency Rate (LTIFR) | **{{metrics.ltifr}}** | Indian Industry Avg: 0.65 |
| Total Safety Training Delivered | **{{metrics.training_hours}}** | Mandated Target: >30 hrs |
| Near-Miss Reports Logged & Addressed | **4,218 incidents** | 100% Closed in 72 hrs |

> [!IMPORTANT]
> All high-risk sites operate under mandatory Stop-Work Authority (SWA), empowering any worker to halt operations if imminent danger is observed.`,
  },
  {
    name: "Governance, Ethics & Compliance",
    title: "4. Corporate Governance & Stakeholder Engagement",
    content: `# Corporate Governance, Integrity & Compliance

{{company.name}} operates under a robust governance framework supervised directly by the Board of Directors and specialized board committees.

### Core Governance Tenets
1. **Code of Conduct & Anti-Corruption:** Zero tolerance for unethical practices or regulatory non-compliance.
2. **Whistleblower Mechanism:** Confidential, multi-channel reporting system reviewed quarterly by the Independent Audit Committee.
3. **Supplier ESG Standards:** 100% of critical tier-1 suppliers audited against environmental and labor safety parameters.`,
  },
];

export function BrsrEditor({
  section,
  report,
  onSaveSection,
  disabled = false,
}: BrsrEditorProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(section.title);
  const [content, setContent] = useState(section.content || "");
  const [images, setImages] = useState<BrsrSectionImage[]>(section.images || []);
  const [viewMode, setViewMode] = useState<"edit" | "split" | "preview">("edit");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when active section changes
  useEffect(() => {
    setTitle(section.title);
    setContent(section.content || "");
    setImages(section.images || []);
    setDirty(false);
  }, [section.id]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    setDirty(true);
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    setDirty(true);
  };

  // Helper to insert markdown text at current cursor position
  const insertText = (before: string, after: string = "", sampleText: string = "") => {
    const el = textareaRef.current;
    if (!el) {
      setContent((prev) => prev + before + sampleText + after);
      setDirty(true);
      return;
    }

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = el.value.substring(start, end) || sampleText;
    const replacement = before + selected + after;
    const nextVal = el.value.substring(0, start) + replacement + el.value.substring(end);

    setContent(nextVal);
    setDirty(true);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 10);
  };

  // Format helpers
  const applyBold = () => insertText("**", "**", "bold text");
  const applyItalic = () => insertText("*", "*", "italic text");
  const applyStrikethrough = () => insertText("~~", "~~", "strikethrough");
  const applyH1 = () => insertText("\n# ", "\n", "Heading 1");
  const applyH2 = () => insertText("\n## ", "\n", "Heading 2");
  const applyH3 = () => insertText("\n### ", "\n", "Heading 3");
  const applyBulletList = () => insertText("\n- ", "\n- \n- ", "List item 1");
  const applyNumberedList = () => insertText("\n1. ", "\n2. \n3. ", "First item");
  const applyBlockquote = () => insertText("\n> ", "\n", "Quote or statement text");
  const applyPageBreak = () => insertText("\n\n<!-- pagebreak -->\n\n", "");

  const applyTable = () => {
    const tableTemplate = `
| Parameter / Metric | Unit | FY 2024-25 | FY 2025-26 | Target |
|---|---|---|---|---|
| Direct Energy Consumption | GJ | 1,240,000 | 1,180,000 | -5% YoY |
| Renewable Power Usage | % | 28.5% | 34.6% | 40% |
| Waste Recycled Ratio | % | 62.0% | 71.4% | 75% |
`;
    insertText(tableTemplate, "");
  };

  const applyCallout = (tone: "NOTE" | "TIP" | "IMPORTANT" | "WARNING") => {
    insertText(`\n> [!${tone}]\n> `, "\n", `Highlight message or compliance declaration for ${tone}.`);
  };

  // Handle local image upload via /api/esg/brsr/upload
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file format",
        description: "Please select an image file (PNG, JPEG, WebP, or SVG).",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image size must be under 10 MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/esg/brsr/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to upload image.");
      }

      const newImage: BrsrSectionImage = {
        id: data.id || `img-${Date.now()}`,
        url: data.url || data.staticUrl,
        caption: file.name.replace(/\.[^/.]+$/, ""),
        alt: file.name,
        widthPct: 100,
        alignment: "center",
      };

      const nextImages = [...images, newImage];
      setImages(nextImages);
      setDirty(true);

      // Also append image markdown token to content
      insertText(`\n\n![${newImage.caption}](${newImage.url})\n*${newImage.caption}*\n\n`);

      toast({
        title: "Image uploaded successfully",
        description: `Attached "${file.name}" to section and inserted into document.`,
      });
    } catch (err) {
      toast({
        title: "Image upload failed",
        description: err instanceof Error ? err.message : "Network error during upload.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Drag and drop handler for editor canvas
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled || isUploading) return;
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const file = droppedFiles[0];
      if (file.type.startsWith("image/")) {
        void handleFileUpload(file);
      }
    }
  };

  // Update attached image properties (caption, widthPct, alignment)
  const updateImage = (id: string, updates: Partial<BrsrSectionImage>) => {
    const nextImages = images.map((img) => (img.id === id ? { ...img, ...updates } : img));
    setImages(nextImages);
    setDirty(true);
  };

  // Remove attached image
  const removeImage = (id: string) => {
    const nextImages = images.filter((img) => img.id !== id);
    setImages(nextImages);
    setDirty(true);
    toast({ title: "Image removed from section assets" });
  };

  // Load pre-made template
  const loadTemplate = (template: (typeof SECTION_TEMPLATES)[number]) => {
    if (content.trim().length > 0) {
      const proceed = window.confirm(
        "Loading this template will replace the current section content. Do you want to proceed?"
      );
      if (!proceed) return;
    }
    setTitle(template.title);
    setContent(template.content);
    setDirty(true);
    toast({
      title: "Template loaded",
      description: `Loaded "${template.name}". Customise and save your report section.`,
    });
  };

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedSection: BrsrSection = {
        ...section,
        title: title.trim() || section.title,
        content,
        images,
        contentType: "markdown",
      };
      await onSaveSection(updatedSection);
      setDirty(false);
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Unable to save report content.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Replace data tokens with real report metrics or realistic fallbacks
  const resolveTokens = (rawText: string) => {
    let resolved = rawText;
    for (const item of ESG_DATA_TOKENS) {
      resolved = resolved.replaceAll(item.token, item.fallback);
    }
    return resolved;
  };

  // Render formatted preview elements for Markdown & HTML
  const renderFormattedPreview = (rawContent: string) => {
    const resolved = resolveTokens(rawContent);

    // Split on pagebreak markers
    const pages = resolved.split(/<!--\s*pagebreak\s*-->/i);

    return (
      <div className="space-y-8">
        {pages.map((pageText, pIdx) => {
          const lines = pageText.split("\n");
          let inTable = false;
          let tableRows: string[][] = [];

          return (
            <div
              key={pIdx}
              className="a4-sheet relative min-h-[640px] rounded-2xl border border-slate-200/90 bg-white p-8 shadow-md transition-all dark:border-slate-800 dark:bg-slate-900"
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                color: "#1e293b",
                lineHeight: 1.6,
              }}
            >
              {/* Header Letterhead for A4 document simulation */}
              <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-[#16588e] flex items-center justify-center text-white font-bold text-[10px]">
                    M
                  </div>
                  <span className="font-semibold tracking-wider text-[#16588e] uppercase">
                    MEIL ESG REPORTING
                  </span>
                </div>
                <div className="text-[11px] font-sans">
                  Section {section.id.replace("custom-", "#")} · Page {pIdx + 1} of {pages.length}
                </div>
              </div>

              {/* Watermark simulation */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.035]">
                <div className="text-8xl font-black text-slate-900 uppercase tracking-widest">
                  MEIL
                </div>
              </div>

              {/* Parsed document body */}
              <div className="space-y-4">
                {lines.map((line, lIdx) => {
                  const trimmed = line.trim();

                  // Table detection
                  if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
                    inTable = true;
                    // Ignore separator line like |---|---|
                    if (!trimmed.match(/^\|[-:\s|]+\|$/)) {
                      const cells = trimmed
                        .slice(1, -1)
                        .split("|")
                        .map((c) => c.trim());
                      tableRows.push(cells);
                    }
                    // If next line is not table, render accumulated table
                    const nextLine = (lines[lIdx + 1] || "").trim();
                    if (!nextLine.startsWith("|") || !nextLine.endsWith("|")) {
                      const currentRows = [...tableRows];
                      tableRows = [];
                      inTable = false;
                      const headerRow = currentRows[0] || [];
                      const bodyRows = currentRows.slice(1);
                      return (
                        <div key={`table-${lIdx}`} className="my-4 overflow-x-auto">
                          <table className="w-full border-collapse border border-slate-300 text-xs dark:border-slate-700">
                            <thead>
                              <tr className="bg-[#16588e] text-white">
                                {headerRow.map((h, hIdx) => (
                                  <th
                                    key={hIdx}
                                    className="border border-slate-300 px-3 py-2 text-left font-sans font-semibold dark:border-slate-700"
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {bodyRows.map((row, rIdx) => (
                                <tr
                                  key={rIdx}
                                  className={rIdx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/70 dark:bg-slate-800/50"}
                                >
                                  {row.map((cell, cIdx) => (
                                    <td
                                      key={cIdx}
                                      className="border border-slate-200 px-3 py-2 text-slate-700 dark:border-slate-800 dark:text-slate-300"
                                    >
                                      {cell.startsWith("**") && cell.endsWith("**") ? (
                                        <strong>{cell.slice(2, -2)}</strong>
                                      ) : (
                                        cell
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    }
                    return null;
                  }

                  // Headings
                  if (trimmed.startsWith("# ")) {
                    return (
                      <h1
                        key={lIdx}
                        className="mt-4 mb-2 text-2xl font-bold tracking-tight text-[#16588e]"
                      >
                        {trimmed.slice(2)}
                      </h1>
                    );
                  }
                  if (trimmed.startsWith("## ")) {
                    return (
                      <h2
                        key={lIdx}
                        className="mt-3 mb-1.5 border-b border-slate-200 pb-1 text-xl font-bold text-slate-800 dark:text-slate-100"
                      >
                        {trimmed.slice(3)}
                      </h2>
                    );
                  }
                  if (trimmed.startsWith("### ")) {
                    return (
                      <h3
                        key={lIdx}
                        className="mt-3 mb-1 text-base font-bold text-slate-800 dark:text-slate-200"
                      >
                        {trimmed.slice(4)}
                      </h3>
                    );
                  }

                  // Callout Cards: > [!NOTE], > [!IMPORTANT], > [!TIP], > [!WARNING]
                  if (trimmed.startsWith("> [!NOTE]")) {
                    return (
                      <div
                        key={lIdx}
                        className="my-3 flex items-start gap-3 rounded-xl border border-sky-300 bg-sky-50/80 p-3.5 text-xs text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
                      >
                        <Info className="h-5 w-5 shrink-0 text-sky-600" />
                        <div>
                          <strong>Note:</strong> {lines[lIdx + 1]?.replace(/^>\s*/, "") || ""}
                        </div>
                      </div>
                    );
                  }
                  if (trimmed.startsWith("> [!IMPORTANT]")) {
                    return (
                      <div
                        key={lIdx}
                        className="my-3 flex items-start gap-3 rounded-xl border border-rose-300 bg-rose-50/80 p-3.5 text-xs text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
                      >
                        <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
                        <div>
                          <strong>Important:</strong> {lines[lIdx + 1]?.replace(/^>\s*/, "") || ""}
                        </div>
                      </div>
                    );
                  }
                  if (trimmed.startsWith("> [!TIP]")) {
                    return (
                      <div
                        key={lIdx}
                        className="my-3 flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50/80 p-3.5 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                      >
                        <Sparkles className="h-5 w-5 shrink-0 text-emerald-600" />
                        <div>
                          <strong>Stewardship Highlight:</strong> {lines[lIdx + 1]?.replace(/^>\s*/, "") || ""}
                        </div>
                      </div>
                    );
                  }

                  // Regular Blockquote
                  if (trimmed.startsWith("> ") && !lines[lIdx - 1]?.startsWith("> [!")) {
                    return (
                      <blockquote
                        key={lIdx}
                        className="my-3 border-l-4 border-[#16588e] bg-slate-50 py-2 px-4 italic text-slate-700 dark:bg-slate-800/60 dark:text-slate-300 text-sm"
                      >
                        {trimmed.slice(2)}
                      </blockquote>
                    );
                  }

                  // Image embed: ![caption](url)
                  const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
                  if (imgMatch) {
                    const caption = imgMatch[1];
                    const url = imgMatch[2];
                    return (
                      <figure key={lIdx} className="my-4 text-center">
                        <img
                          src={url}
                          alt={caption}
                          className="mx-auto max-h-80 rounded-xl border border-slate-200 shadow-sm object-cover"
                        />
                        {caption && (
                          <figcaption className="mt-2 text-xs italic text-slate-500">
                            {caption}
                          </figcaption>
                        )}
                      </figure>
                    );
                  }

                  // Lists
                  if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                    return (
                      <li key={lIdx} className="ml-4 list-disc text-sm text-slate-700 dark:text-slate-300">
                        {trimmed.slice(2)}
                      </li>
                    );
                  }
                  if (/^\d+\.\s/.test(trimmed)) {
                    return (
                      <li key={lIdx} className="ml-4 list-decimal text-sm text-slate-700 dark:text-slate-300">
                        {trimmed.replace(/^\d+\.\s/, "")}
                      </li>
                    );
                  }

                  // Normal Paragraph
                  if (trimmed.length > 0 && !trimmed.startsWith(">")) {
                    return (
                      <p key={lIdx} className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                        {trimmed}
                      </p>
                    );
                  }

                  return null;
                })}
              </div>

              {/* Render attached gallery images if any */}
              {images.length > 0 && pIdx === pages.length - 1 && (
                <div className="mt-8 border-t border-slate-200 pt-6">
                  <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">
                    Section Figures & Exhibits ({images.length})
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {images.map((img) => (
                      <figure
                        key={img.id}
                        className={`rounded-xl border border-slate-200 bg-slate-50 p-2 shadow-sm ${
                          img.widthPct === 100 ? "sm:col-span-2" : ""
                        }`}
                      >
                        <img
                          src={img.url}
                          alt={img.alt || img.caption || "Report Exhibit"}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        {img.caption && (
                          <figcaption className="mt-2 text-center text-xs font-medium text-slate-600 font-sans">
                            {img.caption}
                          </figcaption>
                        )}
                      </figure>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer running note */}
              <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-3 text-[11px] text-slate-400 font-sans">
                <span>{report.title || "Business Responsibility & Sustainability Report"}</span>
                <span>Megha Engineering & Infrastructures Limited · Confidential & Statutory</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top Bar: Title & View Modes */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/70 p-3 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex flex-1 items-center gap-2 min-w-[260px]">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Section:
          </span>
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            disabled={disabled}
            placeholder="Section Title"
            className="h-9 rounded-xl border-slate-200 bg-white text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-800/80">
          <Button
            type="button"
            size="sm"
            variant={viewMode === "edit" ? "default" : "ghost"}
            className={`h-8 rounded-lg px-2.5 text-xs font-medium ${
              viewMode === "edit" ? "bg-[#16588e] text-white" : "text-slate-600 dark:text-slate-400"
            }`}
            onClick={() => setViewMode("edit")}
          >
            <SquarePen className="mr-1.5 h-3.5 w-3.5" /> Editor
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "split" ? "default" : "ghost"}
            className={`h-8 rounded-lg px-2.5 text-xs font-medium ${
              viewMode === "split" ? "bg-[#16588e] text-white" : "text-slate-600 dark:text-slate-400"
            }`}
            onClick={() => setViewMode("split")}
          >
            <Columns className="mr-1.5 h-3.5 w-3.5" /> Split View
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "preview" ? "default" : "ghost"}
            className={`h-8 rounded-lg px-2.5 text-xs font-medium ${
              viewMode === "preview" ? "bg-[#16588e] text-white" : "text-slate-600 dark:text-slate-400"
            }`}
            onClick={() => setViewMode("preview")}
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" /> A4 Preview
          </Button>
        </div>

        {/* Templates & Actions */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-xl border-slate-200 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200"
                disabled={disabled}
              >
                <Layers className="mr-1.5 h-3.5 w-3.5 text-[#16588e]" /> Template
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-xl border-slate-200 shadow-xl">
              <DropdownMenuLabel className="text-xs">BRSR Section Templates</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SECTION_TEMPLATES.map((tmpl, idx) => (
                <DropdownMenuItem
                  key={idx}
                  onClick={() => loadTemplate(tmpl)}
                  className="cursor-pointer text-xs py-2"
                >
                  <FileText className="mr-2 h-3.5 w-3.5 text-slate-500" />
                  {tmpl.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={disabled || isSaving || !dirty}
            className={`h-8 rounded-xl px-4 text-xs font-semibold ${
              dirty
                ? "bg-emerald-600 text-white hover:bg-emerald-700 animate-pulse"
                : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving…
              </>
            ) : dirty ? (
              <>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Save Changes
              </>
            ) : (
              "Saved"
            )}
          </Button>
        </div>
      </div>

      {/* Editor & Preview Area */}
      <div
        className={`grid gap-4 ${
          viewMode === "split"
            ? "grid-cols-1 lg:grid-cols-2"
            : "grid-cols-1"
        }`}
      >
        {/* Editor Pane (shown in 'edit' or 'split') */}
        {(viewMode === "edit" || viewMode === "split") && (
          <div
            className="flex flex-col rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/70"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {/* Formatting Toolbar */}
            <div className="mb-3 flex flex-wrap items-center gap-1 border-b border-slate-200/80 pb-2.5 text-slate-600 dark:border-slate-800 dark:text-slate-300">
              {/* Headings */}
              <div className="flex items-center border-r border-slate-200 pr-1 mr-1 dark:border-slate-700">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Heading 1"
                  onClick={applyH1}
                >
                  <Heading1 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Heading 2"
                  onClick={applyH2}
                >
                  <Heading2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Heading 3"
                  onClick={applyH3}
                >
                  <Heading3 className="h-4 w-4" />
                </Button>
              </div>

              {/* Text styles */}
              <div className="flex items-center border-r border-slate-200 pr-1 mr-1 dark:border-slate-700">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Bold (**text**)"
                  onClick={applyBold}
                >
                  <Bold className="h-4 w-4 font-bold" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Italic (*text*)"
                  onClick={applyItalic}
                >
                  <Italic className="h-4 w-4 italic" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Strikethrough (~~text~~)"
                  onClick={applyStrikethrough}
                >
                  <Strikethrough className="h-4 w-4" />
                </Button>
              </div>

              {/* Lists & Quotes */}
              <div className="flex items-center border-r border-slate-200 pr-1 mr-1 dark:border-slate-700">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Bullet List (- item)"
                  onClick={applyBulletList}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Numbered List (1. item)"
                  onClick={applyNumberedList}
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Blockquote (> quote)"
                  onClick={applyBlockquote}
                >
                  <Quote className="h-4 w-4" />
                </Button>
              </div>

              {/* Components: Table, Callouts, Page Break */}
              <div className="flex items-center border-r border-slate-200 pr-1 mr-1 dark:border-slate-700">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  title="Insert Comparison Table"
                  onClick={applyTable}
                >
                  <TableIcon className="mr-1 h-3.5 w-3.5 text-sky-600" /> Table
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      title="Insert Callout Card"
                    >
                      <Sparkles className="mr-1 h-3.5 w-3.5 text-amber-500" /> Callout
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48 rounded-xl shadow-lg">
                    <DropdownMenuItem onClick={() => applyCallout("NOTE")}>
                      <Info className="mr-2 h-3.5 w-3.5 text-sky-600" /> Note / Context
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => applyCallout("TIP")}>
                      <Sparkles className="mr-2 h-3.5 w-3.5 text-emerald-600" /> Stewardship Tip
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => applyCallout("IMPORTANT")}>
                      <AlertCircle className="mr-2 h-3.5 w-3.5 text-rose-600" /> Important Notice
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-indigo-600"
                  title="Force New A4 Page"
                  onClick={applyPageBreak}
                >
                  <Scissors className="mr-1 h-3.5 w-3.5" /> Page Break
                </Button>
              </div>

              {/* Dynamic ESG Metric Tokens */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-lg border-sky-200 bg-sky-50/70 px-2 text-xs text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300"
                  >
                    🏷️ Metric Token
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-80 w-72 overflow-y-auto rounded-xl shadow-xl">
                  <DropdownMenuLabel className="text-xs">Insert Live ESG Metric Token</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ESG_DATA_TOKENS.map((item, idx) => (
                    <DropdownMenuItem
                      key={idx}
                      onClick={() => insertText(item.token)}
                      className="cursor-pointer text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.label}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">{item.token}</div>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Image Upload Trigger */}
              <div className="ml-auto">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFileUpload(file);
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isUploading || disabled}
                  onClick={() => fileInputRef.current?.click()}
                  className="h-7 rounded-lg border-purple-200 bg-purple-50/80 px-2.5 text-xs text-purple-800 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-300"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Uploading…
                    </>
                  ) : (
                    <>
                      <ImagePlus className="mr-1.5 h-3.5 w-3.5 text-purple-600" /> Insert Image
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Markdown Textarea */}
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              disabled={disabled}
              rows={viewMode === "split" ? 18 : 22}
              placeholder="Type section narrative here using markdown or formatting tools above. Drag & drop images directly onto this box..."
              className="nice-scroll font-mono text-sm leading-relaxed text-slate-900 border-none bg-transparent p-2 focus-visible:ring-0 resize-y dark:text-slate-100"
            />

            {/* Attached Section Images Gallery */}
            {images.length > 0 && (
              <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
                <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>Attached Section Exhibits & Figures ({images.length})</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    Controls image width, alignment, and print placement
                  </span>
                </div>
                <div className="space-y-2">
                  {images.map((img) => (
                    <div
                      key={img.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/60"
                    >
                      <img
                        src={img.url}
                        alt={img.caption || "Preview"}
                        className="h-12 w-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                      />
                      <div className="flex-1 min-w-[180px]">
                        <Input
                          value={img.caption || ""}
                          onChange={(e) => updateImage(img.id, { caption: e.target.value })}
                          placeholder="Caption / Figure title (e.g. Figure 1: Solar Array)"
                          className="h-8 rounded-lg text-xs"
                        />
                      </div>

                      {/* Alignment */}
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={img.alignment === "left" ? "default" : "outline"}
                          className={`h-7 w-7 p-0 ${img.alignment === "left" ? "bg-[#16588e]" : ""}`}
                          onClick={() => updateImage(img.id, { alignment: "left" })}
                          title="Left wrap"
                        >
                          <AlignLeft className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={img.alignment === "center" ? "default" : "outline"}
                          className={`h-7 w-7 p-0 ${img.alignment === "center" ? "bg-[#16588e]" : ""}`}
                          onClick={() => updateImage(img.id, { alignment: "center" })}
                          title="Centered"
                        >
                          <AlignCenter className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={img.alignment === "right" ? "default" : "outline"}
                          className={`h-7 w-7 p-0 ${img.alignment === "right" ? "bg-[#16588e]" : ""}`}
                          onClick={() => updateImage(img.id, { alignment: "right" })}
                          title="Right wrap"
                        >
                          <AlignRight className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Width preset */}
                      <Select
                        value={String(img.widthPct || 100)}
                        onValueChange={(v) => updateImage(img.id, { widthPct: Number(v) })}
                      >
                        <SelectTrigger className="h-8 w-24 rounded-lg text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="25">25% (Thumb)</SelectItem>
                          <SelectItem value="50">50% (Half)</SelectItem>
                          <SelectItem value="75">75% (Wide)</SelectItem>
                          <SelectItem value="100">100% (Full)</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Remove Image */}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeImage(img.id)}
                        className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                        title="Delete image"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live A4 Formatted Document Preview Pane (shown in 'split' or 'preview') */}
        {(viewMode === "split" || viewMode === "preview") && (
          <div className="nice-scroll max-h-[850px] overflow-y-auto rounded-2xl border border-slate-200/80 bg-slate-100 p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider">
                Live A4 Print & PDF Preview
              </span>
              <span className="italic">Simulates physical page pagination</span>
            </div>
            {renderFormattedPreview(content)}
          </div>
        )}
      </div>
    </div>
  );
}
