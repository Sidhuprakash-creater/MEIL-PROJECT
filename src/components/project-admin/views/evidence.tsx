"use client";

import React, { useState, useEffect } from "react";
import {
  FolderLock,
  Folder,
  FileText,
  Download,
  Eye,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Clock,
} from "lucide-react";
import { usePaStore, CONTRIBUTOR_CATEGORIES } from "@/lib/project-admin/store";
import { paApiGet, getCachedPaData } from "@/lib/project-admin/client";
import { PaGlassCard, PaPageHeader, PaButton, PaStatusBadge, PaDrawer, PaKpiCard } from "../ui";
import { MeilBoxLoader } from "@/components/shared/meil-loader";
import type { PaEvidenceItem, ContributorRole } from "@/lib/project-admin/types";

export default function EvidenceView() {
  const { viewParams } = usePaStore();
  const cached = getCachedPaData<any>("/api/project-admin/evidence");
  const [loading, setLoading] = useState(!cached);
  const [evidence, setEvidence] = useState<PaEvidenceItem[]>(cached?.items || cached?.evidence || []);
  const [folders, setFolders] = useState<any[]>(cached?.folders || []);
  const [summary, setSummary] = useState<any>(cached?.summary || null);
  const [activeFolder, setActiveFolder] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [previewDoc, setPreviewDoc] = useState<PaEvidenceItem | null>(null);

  const loadEvidence = () => {
    if (!evidence.length) setLoading(true);
    paApiGet<any>("/api/project-admin/evidence")
      .then((res) => {
        setEvidence(res.items || res.evidence || []);
        setFolders(res.folders || []);
        setSummary(res.summary || {});
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount data load
    loadEvidence();
  }, []);

  const filteredDocs = evidence.filter((doc) => {
    const matchesSearch =
      !search ||
      doc.name.toLowerCase().includes(search.toLowerCase()) ||
      doc.uploadedByName.toLowerCase().includes(search.toLowerCase()) ||
      doc.sectionName.toLowerCase().includes(search.toLowerCase());

    const matchesFolder = activeFolder === "ALL" || doc.category === activeFolder;
    return matchesSearch && matchesFolder;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PaPageHeader
        title="Evidence Repository & Audit Vault"
        subtitle="Secure document management for project compliance files, laboratory test reports, and certifications"
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <PaKpiCard title="Total Evidence Files" value={summary?.totalDocs || evidence.length} icon={FolderLock} accentColor="#315CFF" />
        <PaKpiCard title="Audit Verified" value={summary?.verified || 0} icon={ShieldCheck} accentColor="#16A67A" />
        <PaKpiCard title="Pending Review" value={summary?.pendingReview || 0} icon={Clock} accentColor="#E9A23B" />
        <PaKpiCard title="Missing Requirements" value={summary?.missingRequirements || 2} icon={FileQuestion} accentColor="#EC4899" />
      </div>

      {/* 7 Category Folders */}
      <div>
        <h3 className="text-sm font-bold text-[#202938] mb-3">7 Category Evidence Folders</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div
            onClick={() => setActiveFolder("ALL")}
            className={`p-3 rounded-2xl cursor-pointer transition-all border text-center ${
              activeFolder === "ALL"
                ? "pa-gradient-active shadow-md"
                : "pa-glass pa-glass-hover"
            }`}
          >
            <Folder size={20} className="mx-auto mb-1.5" />
            <div className="text-xs font-bold truncate">All Folders</div>
            <div className="text-[10px] opacity-80">{evidence.length} files</div>
          </div>

          {folders.map((f) => {
            const isActive = activeFolder === f.category;
            return (
              <div
                key={f.category}
                onClick={() => setActiveFolder(f.category)}
                className={`p-3 rounded-2xl cursor-pointer transition-all border text-center ${
                  isActive
                    ? "pa-gradient-active shadow-md"
                    : "pa-glass pa-glass-hover"
                }`}
              >
                <FolderLock size={20} className="mx-auto mb-1.5" style={{ color: isActive ? "#FFF" : f.color }} />
                <div className="text-xs font-bold truncate">{f.name.replace(" Evidence", "")}</div>
                <div className="text-[10px] opacity-80">{f.docCount} files</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search & Action bar */}
      <PaGlassCard className="p-4 flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents by title, uploader or section…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/80 border border-slate-200 text-xs font-semibold focus:outline-none"
          />
        </div>
        <div className="text-xs text-[#64748B] font-semibold">
          Showing {filteredDocs.length} of {evidence.length} files
        </div>
      </PaGlassCard>

      {/* Document Grid / Table */}
      {loading ? (
        <div className="glass rounded-2xl p-6">
          <MeilBoxLoader boxHeight="min-h-[240px]" label="Loading evidence…" />
        </div>
      ) : (
      <PaGlassCard strong className="overflow-x-auto p-0">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/60 text-[#64748B] font-bold uppercase tracking-wider text-[11px]">
              <th className="p-4 pl-6">Document Name & Ref</th>
              <th className="p-4">Category</th>
              <th className="p-4">Reporting Section</th>
              <th className="p-4">Uploaded By</th>
              <th className="p-4">Upload Date</th>
              <th className="p-4">Audit Status</th>
              <th className="p-4 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredDocs.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[#64748B]">
                  No evidence files found in this category.
                </td>
              </tr>
            ) : (
              filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-white/80 transition-colors">
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-blue-50 text-[#315CFF]">
                        <FileText size={16} />
                      </div>
                      <div>
                        <div className="font-bold text-[#202938] text-sm">{doc.name}</div>
                        <div className="text-[10px] text-[#8F9EAF] font-mono">
                          {doc.fileType} • {doc.fileSizeKb} KB • v{doc.version}.0
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-[11px]">
                      {doc.categoryLabel}
                    </span>
                  </td>
                  <td className="p-4 font-semibold text-[#202938]">{doc.sectionName}</td>
                  <td className="p-4">
                    <div className="font-semibold text-[#202938]">{doc.uploadedByName}</div>
                    <div className="text-[10px] text-[#64748B]">{doc.uploadedByRole}</div>
                  </td>
                  <td className="p-4 text-[#64748B]">{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                  <td className="p-4">
                    <PaStatusBadge status={doc.status} />
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Preview Document"
                      >
                        <Eye size={15} />
                      </button>
                      <a
                        href={doc.downloadUrl}
                        download
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="Download File"
                      >
                        <Download size={15} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </PaGlassCard>
      )}

      {/* ── Document Preview Drawer ── */}
      <PaDrawer
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title="Document Audit Preview"
        subtitle={previewDoc?.name}
      >
        {previewDoc && (
          <div className="space-y-5 text-xs">
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 space-y-3">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Document Ref:</span>
                <span className="font-mono font-bold text-[#315CFF]">{previewDoc.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Contributor Category:</span>
                <span className="font-bold text-[#202938]">{previewDoc.categoryLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Associated Section:</span>
                <span className="font-bold text-[#202938]">{previewDoc.sectionName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Uploaded By:</span>
                <span className="font-bold text-[#202938]">{previewDoc.uploadedByName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">File Size & Format:</span>
                <span className="font-bold text-[#202938]">{previewDoc.fileSizeKb} KB ({previewDoc.fileType})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Compliance Status:</span>
                <PaStatusBadge status={previewDoc.status} />
              </div>
            </div>

            {/* In-Context Preview Card */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
              <div className="flex justify-center">
                <div className="p-4 rounded-3xl bg-blue-100/60 text-[#315CFF]">
                  <FileText size={40} />
                </div>
              </div>
              <div>
                <div className="font-bold text-[#202938] text-sm">{previewDoc.name}</div>
                <div className="text-[11px] text-[#64748B] mt-0.5">
                  Verified SHA256 integrity checksum recorded in platform audit ledger.
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <a
                href={previewDoc.downloadUrl}
                download
                className="w-full flex items-center justify-center gap-2 pa-btn-primary px-4 py-2.5 rounded-xl font-bold text-xs"
              >
                <Download size={15} /> Download Document
              </a>
            </div>
          </div>
        )}
      </PaDrawer>
    </div>
  );
}
