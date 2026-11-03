import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getProjectAdminContext,
  paOk,
  paFail,
  getPaServerCache,
  setPaServerCache,
} from "@/lib/project-admin/server";
import { CONTRIBUTOR_CATEGORIES } from "@/lib/project-admin/store";
import type { ContributorRole, PaEvidenceItem } from "@/lib/project-admin/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getProjectAdminContext();
    if (!ctx) return paFail("Project Admin context not resolved.", 401);

    const cacheKey = `evidence:${ctx.projectId}`;
    const cached = getPaServerCache<any>(cacheKey);
    if (cached) {
      return paOk(cached);
    }

    const [docs, rawEvidences] = await Promise.all([
      db.evidenceDoc.findMany({
        where: {
          OR: [
            { projectId: ctx.projectId },
            { businessUnitId: ctx.businessUnitId },
          ],
        },
        select: {
          id: true,
          name: true,
          fileType: true,
          sizeKb: true,
          uploadedBy: true,
          uploadedAt: true,
          status: true,
          submissionRef: true,
          version: true,
        },
        orderBy: { uploadedAt: "desc" },
      }),
      db.evidence.findMany({
        where: { projectId: ctx.projectId },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          module: true,
          documentType: true,
          uploaderId: true,
          createdAt: true,
          status: true,
          version: true,
          uploader: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const categoryKeys = Object.keys(CONTRIBUTOR_CATEGORIES) as ContributorRole[];

    const docItems: PaEvidenceItem[] = docs.map((d, idx) => {
      const catKey = categoryKeys[idx % categoryKeys.length];
      const def = (CONTRIBUTOR_CATEGORIES as any)[catKey] || { label: "Compliance", name: "Contributor" };
      return {
        id: d.id,
        name: d.name,
        fileType: d.fileType || "PDF",
        fileSizeKb: d.sizeKb || 142,
        category: catKey,
        categoryLabel: def.label,
        sectionCode: `${catKey.slice(0, 3)}-01`,
        sectionName: `${def.label} Compliance Documentation`,
        period: "Q4 FY 2025-26",
        uploadedById: d.uploadedBy || "system",
        uploadedByName: d.uploadedBy || "Authorized Contributor",
        uploadedByRole: def.name,
        uploadedAt: new Date(d.uploadedAt).toISOString(),
        status: (d.status === "VALID" ? "VERIFIED" : d.status || "VERIFIED") as any,
        submissionRef: d.submissionRef || `SUB-${ctx.projectCode}-${String(idx + 1).padStart(3, "0")}`,
        version: d.version || 1,
        downloadUrl: `/api/project-admin/evidence/${d.id}/download`,
      };
    });

    const rawItems: PaEvidenceItem[] = rawEvidences.map((e, idx) => {
      const catKey = (categoryKeys.find(
        (k) => e.module?.toUpperCase().includes(k.replace("_USER", ""))
      ) || categoryKeys[(idx + 2) % categoryKeys.length]) as ContributorRole;
      const def = (CONTRIBUTOR_CATEGORIES as any)[catKey] || { label: "Operational Evidence", name: "Contributor" };

      return {
        id: e.id,
        name: e.fileName,
        fileType: e.mimeType?.includes("pdf") ? "PDF" : e.mimeType?.includes("sheet") ? "XLSX" : "IMAGE",
        fileSizeKb: Math.round(e.fileSize / 1024) || 250,
        category: catKey,
        categoryLabel: def.label,
        sectionCode: `${catKey.slice(0, 3)}-02`,
        sectionName: `${e.documentType || "Field Verification"} Records`,
        period: "Q4 FY 2025-26",
        uploadedById: e.uploaderId,
        uploadedByName: e.uploader?.name || "Site Contributor",
        uploadedByRole: e.uploader?.role || def.name,
        uploadedAt: new Date(e.createdAt).toISOString(),
        status: (e.status === "UPLOADED" ? "VERIFIED" : e.status) as any,
        submissionRef: `EV-${ctx.projectCode}-${e.id.slice(-4).toUpperCase()}`,
        version: e.version || 1,
        downloadUrl: `/api/project-admin/evidence/${e.id}/download`,
      };
    });

    const items = [...docItems, ...rawItems];

    // Compute category folder counts
    const folders = categoryKeys.map((catKey) => {
      const def = (CONTRIBUTOR_CATEGORIES as any)[catKey] || { label: catKey, color: "#3B82F6" };
      const count = items.filter((i) => i.category === catKey).length;
      return {
        key: catKey,
        name: `${def.label} Evidence`,
        iconName: "Folder",
        accentColor: def.color || "#3B82F6",
        count,
        latestUpload: items.find((i) => i.category === catKey)?.uploadedAt || null,
      };
    });

    const payload = {
      items,
      folders,
      summary: {
        totalDocs: items.length,
        verified: items.filter((i) => i.status === "VERIFIED").length,
        pendingReview: items.filter((i) => i.status === "PENDING" || i.status === "UNDER_REVIEW").length,
        missingRequirements: 1,
      },
    };

    setPaServerCache(cacheKey, payload, 45000);
    return paOk(payload);
  } catch (err: any) {
    return paFail(err.message, 500);
  }
}
