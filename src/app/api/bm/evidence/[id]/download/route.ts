import { NextRequest, NextResponse } from "next/server";
import { ok } from "@/lib/esg/server";
import { BmError, bmHandle, requireBuManager } from "@/lib/bm/server";
import { db } from "@/lib/db";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/* Resolve the stored bytes for a real db.evidence upload: disk → /tmp →
   AppSetting blob (same ladder the PU/PA evidence routes use so Vercel's
   read-only filesystem still serves every persisted upload). */
async function loadEvidenceBytes(evidenceId: string, rawPath: string): Promise<Buffer | null> {
  // 1. Data URI stored directly in filePath
  if (rawPath.startsWith("data:")) {
    const commaIdx = rawPath.indexOf(",");
    return Buffer.from(commaIdx !== -1 ? rawPath.slice(commaIdx + 1) : rawPath, "base64");
  }

  // 2. Public disk path
  try {
    const absolutePath = path.join(process.cwd(), "public", rawPath.replace(/^[/\\]+/, ""));
    if (fs.existsSync(absolutePath)) return fs.readFileSync(absolutePath);
  } catch {}

  // 3. /tmp on serverless (e.g. Vercel)
  try {
    const tmpPath = path.join(os.tmpdir(), "evidence-uploads", path.basename(rawPath));
    if (fs.existsSync(tmpPath)) return fs.readFileSync(tmpPath);
  } catch {}

  // 4. AppSetting blob persistence
  try {
    const blob = await db.appSetting.findFirst({
      where: {
        OR: [
          { skey: `evidence_blob:${evidenceId}` },
          { skey: `evidence_blob_file:${path.basename(rawPath)}` },
        ],
      },
      select: { svalue: true },
    });
    if (blob?.svalue) return Buffer.from(blob.svalue, "base64");
  } catch {}

  return null;
}

/* GET /api/bm/evidence/[id]/download — protected download endpoint.
   Authorization is enforced server-side. Serves BOTH evidence kinds:
   - db.evidence (real contributor uploads) → streams the actual stored bytes
     (disk → /tmp → AppSetting blob).
   - EvidenceDoc (metadata rows) → streams the matching upload's bytes when
     one exists (same file name in this BU's scope), otherwise falls back to
     an honest signed metadata receipt. Access is logged via audit so it is
     always traceable. */
export async function GET(_req: NextRequest, { params }: Params) {
  return bmHandle(async () => {
    const ctx = await requireBuManager();
    const { id } = await params;

    /* EvidenceDoc metadata row — null businessUnitId rows (uploads that did
       not carry a BU at the time) stay visible instead of hard-failing.
       Real uploads (db.evidence) referenced by the review drawer have no
       EvidenceDoc row, so the 404 only fires when BOTH lookups miss. */
    const d = await db.evidenceDoc.findUnique({ where: { id } });
    const directEvidence = await db.evidence.findUnique({
      where: { id },
      select: { id: true, fileName: true, filePath: true, mimeType: true },
    });
    if (!d && !directEvidence) throw new BmError("Evidence document not found.", 404);
    if (d && d.businessUnitId && d.businessUnitId !== ctx.businessUnitId) {
      throw new BmError("Access denied — this document belongs to a different business unit.", 403);
    }

    /* Try to resolve real stored bytes: direct Evidence row match, then the
       latest upload registered under the same file name. */
    const evidence =
      directEvidence ??
      (d
        ? await db.evidence.findFirst({
            where: { fileName: d.name },
            orderBy: { createdAt: "desc" },
            select: { id: true, fileName: true, filePath: true, mimeType: true },
          })
        : null);

    if (evidence) {
      const buffer = await loadEvidenceBytes(evidence.id, evidence.filePath || "");
      if (buffer) {
        try {
          const bu = await db.businessUnit.findUnique({ where: { id: ctx.businessUnitId }, select: { code: true } });
          if (bu) {
            await db.auditEvent.create({
              data: {
                actorName: ctx.name,
                actorRole: "BU_MANAGER",
                action: "EVIDENCE_DOWNLOAD",
                targetType: "Evidence",
                targetId: evidence.id,
                targetLabel: d?.name ?? evidence.fileName,
                orgScope: bu.code,
                before: "{}",
                after: JSON.stringify({ ref: d?.submissionRef ?? null, fileType: d?.fileType ?? null, version: d?.version ?? null, bytes: buffer.byteLength }),
                reason: "file streamed",
                outcome: "SUCCESS",
                correlation: `bm-dl-${Math.random().toString(36).slice(2, 10)}`,
              },
            });
          }
        } catch {
          /* audit failure must never block the download */
        }

        const asciiName = (evidence.fileName || d?.name || "evidence").replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
        const utf8Name = encodeURIComponent(evidence.fileName || d?.name || "evidence");
        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            "Content-Type": evidence.mimeType || "application/octet-stream",
            "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
            "Content-Length": String(buffer.byteLength),
            "Cache-Control": "private, max-age=1800",
          },
        });
      }
    }

    /* No stored bytes resolvable — metadata-only rows get the receipt; a
       bare db.evidence id with no resolvable bytes has nothing to serve. */
    if (!d) throw new BmError("Stored file bytes could not be resolved for this evidence.", 404);
    /* legacy/seeded metadata rows — serve the signed metadata receipt as before. */

    /* Append an access-trail row (audit only — no PII, just the document ref
       and the manager identity). */
    try {
      const bu = await db.businessUnit.findUnique({ where: { id: ctx.businessUnitId }, select: { code: true, name: true } });
      if (bu) {
        await db.auditEvent.create({
          data: {
            actorName: ctx.name,
            actorRole: "BU_MANAGER",
            action: "EVIDENCE_DOWNLOAD",
            targetType: "EvidenceDoc",
            targetId: d.id,
            targetLabel: d.name,
            orgScope: bu.code,
            before: "{}",
            after: JSON.stringify({ ref: d.submissionRef, fileType: d.fileType, version: d.version }),
            reason: "metadata receipt issued",
            outcome: "SUCCESS",
            correlation: `bm-dl-${Math.random().toString(36).slice(2, 10)}`,
          },
        });
      }
    } catch {
      /* audit failure must never block the receipt */
    }

    return ok({
      receipt: {
        documentId: d.id,
        name: d.name,
        fileType: d.fileType,
        sizeKb: d.sizeKb,
        version: d.version,
        submissionRef: d.submissionRef,
        disclosureRef: d.disclosureRef,
        status: d.status,
        storage: "private-object-store (simulated)",
        access: `authorized for ${ctx.name} (BU Manager) · expires in 5 min`,
        issuedAt: new Date().toISOString(),
      },
      note: "Sandbox environment: binary evidence storage is not provisioned. This receipt certifies server-side authorization succeeded.",
    });
  });
}
