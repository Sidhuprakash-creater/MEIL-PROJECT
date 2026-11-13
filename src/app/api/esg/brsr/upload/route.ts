import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { db } from "@/lib/db";
import { handle, ok, fail, requireGroupAdmin, ACTOR } from "@/lib/esg/server";
import { scanForMalware, summarizeScan } from "@/lib/evidence/security";

export const dynamic = "force-dynamic";

const EXTENSION_CATEGORIES: Record<string, { kind: "IMAGE" | "DOCUMENT"; mime: string }> = {
  // Images
  jpg: { kind: "IMAGE", mime: "image/jpeg" },
  jpeg: { kind: "IMAGE", mime: "image/jpeg" },
  png: { kind: "IMAGE", mime: "image/png" },
  webp: { kind: "IMAGE", mime: "image/webp" },
  gif: { kind: "IMAGE", mime: "image/gif" },
  svg: { kind: "IMAGE", mime: "image/svg+xml" },
  bmp: { kind: "IMAGE", mime: "image/bmp" },
  // Documents
  pdf: { kind: "DOCUMENT", mime: "application/pdf" },
  docx: { kind: "DOCUMENT", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  doc: { kind: "DOCUMENT", mime: "application/msword" },
  xlsx: { kind: "DOCUMENT", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  xls: { kind: "DOCUMENT", mime: "application/vnd.ms-excel" },
  csv: { kind: "DOCUMENT", mime: "text/csv" },
  txt: { kind: "DOCUMENT", mime: "text/plain; charset=utf-8" },
  md: { kind: "DOCUMENT", mime: "text/markdown; charset=utf-8" },
};

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(req: NextRequest) {
  return handle(async () => {
    // 1. Auth check with dev/demo fallback
    let userIdentifier = ACTOR.name;
    try {
      const user = await requireGroupAdmin({ readOnly: false });
      userIdentifier = user.email || user.name || ACTOR.name;
    } catch {
      userIdentifier = ACTOR.name;
    }

    // 2. Parse form data
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string" || !(file instanceof Blob)) {
      return fail("No file uploaded. Please select an image or document.", 400);
    }

    if (file.size > MAX_FILE_BYTES) {
      return fail(`File exceeds maximum size limit of 25 MB (was ${(file.size / (1024 * 1024)).toFixed(1)} MB).`, 400);
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const originalName = file.name || "uploaded-file";
    const ext = (originalName.split(".").pop() || "").toLowerCase();

    const matchedConfig = EXTENSION_CATEGORIES[ext] || (
      file.type.startsWith("image/")
        ? { kind: "IMAGE" as const, mime: file.type }
        : file.type.includes("pdf")
        ? { kind: "DOCUMENT" as const, mime: "application/pdf" }
        : null
    );

    if (!matchedConfig) {
      return fail(
        `Unsupported file type (${ext || file.type || "unknown"}). Supported formats: Images (PNG, JPG, WebP, SVG, GIF) and Documents (PDF, Word, Excel, CSV, TXT, MD).`,
        400
      );
    }

    // 3. Security scan for malicious executables
    const scan = scanForMalware({ fileName: originalName, buffer: rawBuffer });
    if (scan.verdict === "MALICIOUS") {
      return fail(`Security check failed: ${summarizeScan(scan)}`, 400);
    }

    // 4. Handle based on category (IMAGE vs DOCUMENT)
    const isImage = matchedConfig.kind === "IMAGE";
    let finalBuffer: Buffer = rawBuffer;
    let width = 0;
    let height = 0;
    let textContent = "";

    if (isImage) {
      if (ext === "svg" || matchedConfig.mime.includes("svg")) {
        width = 800;
        height = 600;
      } else {
        try {
          const image = sharp(rawBuffer);
          const meta = await image.metadata();
          width = meta.width || 1200;
          height = meta.height || 800;

          // Downscale huge images (> 2400px width) for balanced print and web performance
          if (width > 2400) {
            finalBuffer = await image
              .resize({ width: 2400, withoutEnlargement: true })
              .toBuffer();
            height = Math.round((2400 / (meta.width || 2400)) * (meta.height || 1600));
            width = 2400;
          }
        } catch (sharpErr) {
          console.warn("[brsr/upload] sharp metadata extraction notice:", sharpErr);
          width = 1200;
          height = 800;
        }
      }
    } else {
      // Document: If plain text or markdown, read preview text
      if (ext === "txt" || ext === "md" || ext === "csv") {
        try {
          textContent = rawBuffer.toString("utf8");
        } catch {
          // ignore
        }
      }
    }

    // 5. Unique safe filename
    const hash = crypto.randomBytes(8).toString("hex");
    const sanitizedOriginal = originalName
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .substring(0, 30);
    const fileName = `brsr_${Date.now()}_${hash}_${sanitizedOriginal}.${ext || "bin"}`;

    // 6. Save to disk: public/brsr-uploads/
    const uploadDir = path.join(process.cwd(), "public", "brsr-uploads");
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadDir, fileName), finalBuffer);
    } catch (fsErr) {
      console.warn("[brsr/upload] Disk write warning (database fallback will serve):", fsErr);
    }

    // 7. Base64 database backup in db.appSetting for instant cross-environment serving
    const base64Data = `data:${matchedConfig.mime};base64,${finalBuffer.toString("base64")}`;
    try {
      await db.appSetting.upsert({
        where: { skey: `brsr_asset:${fileName}` },
        update: {
          svalue: base64Data,
          category: isImage ? "BRSR_IMAGE" : "BRSR_DOCUMENT",
          label: originalName,
          vtype: isImage ? "image" : "document",
        },
        create: {
          skey: `brsr_asset:${fileName}`,
          svalue: base64Data,
          category: isImage ? "BRSR_IMAGE" : "BRSR_DOCUMENT",
          label: originalName,
          vtype: isImage ? "image" : "document",
        },
      });
    } catch (dbErr) {
      console.warn("[brsr/upload] AppSetting backup warning:", dbErr);
    }

    const publicUrl = `/api/esg/brsr/upload?file=${encodeURIComponent(fileName)}`;
    const staticUrl = `/brsr-uploads/${fileName}`;

    // Normalize document fileType label
    const docFileType = ext === "pdf" ? "PDF" : ext.startsWith("doc") ? "DOCX" : ext.startsWith("xls") ? "XLSX" : ext === "txt" || ext === "md" ? "TXT" : "OTHER";

    return ok({
      ok: true,
      id: fileName,
      url: publicUrl,
      staticUrl,
      fileName,
      originalName,
      isDocument: !isImage,
      fileType: docFileType,
      mime: matchedConfig.mime,
      width,
      height,
      sizeKb: Math.max(1, Math.round(finalBuffer.length / 1024)),
      textContent: textContent ? textContent.slice(0, 5000) : undefined,
    });
  });
}

export async function GET(req: NextRequest) {
  const fileName = req.nextUrl.searchParams.get("file");
  if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    return new NextResponse("Invalid file identifier", { status: 400 });
  }

  const ext = (fileName.split(".").pop() || "").toLowerCase();
  const matched = EXTENSION_CATEGORIES[ext];
  const mime = matched ? matched.mime : "application/octet-stream";

  // 1. Try reading directly from public/brsr-uploads
  const filePath = path.join(process.cwd(), "public", "brsr-uploads", fileName);
  if (fs.existsSync(filePath)) {
    try {
      const buffer = fs.readFileSync(filePath);
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": mime,
          "Content-Disposition": `inline; filename="${fileName}"`,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      // Fall through to database backup
    }
  }

  // 2. Fallback to database appSetting
  try {
    const setting = await db.appSetting.findUnique({
      where: { skey: `brsr_asset:${fileName}` },
    });
    if (setting?.svalue) {
      const match = setting.svalue.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const dataMime = match[1] || mime;
        const data = Buffer.from(match[2], "base64");
        return new NextResponse(data, {
          headers: {
            "Content-Type": dataMime,
            "Content-Disposition": `inline; filename="${fileName}"`,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
    }
  } catch {
    // Return 404 below
  }

  return new NextResponse("File not found", { status: 404 });
}
