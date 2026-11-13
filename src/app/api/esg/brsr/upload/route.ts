import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { db } from "@/lib/db";
import { handle, ok, fail, requireGroupAdmin } from "@/lib/esg/server";
import { scanForMalware, summarizeScan } from "@/lib/evidence/security";

export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  return handle(async () => {
    // 1. Authenticate user
    const user = await requireGroupAdmin({ readOnly: false });

    // 2. Parse form data
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string" || !(file instanceof Blob)) {
      return fail("No image file provided.", 400);
    }

    if (file.size > MAX_IMAGE_BYTES) {
      return fail("Image exceeds the maximum allowed size of 10 MB.", 400);
    }

    const mime = file.type || "application/octet-stream";
    if (!ALLOWED_MIME_TYPES.has(mime.toLowerCase())) {
      return fail(
        `Unsupported file type (${mime}). Please upload a JPEG, PNG, WebP, GIF, or SVG image.`,
        400
      );
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());

    // 3. Security scan
    const scan = scanForMalware({ fileName: file.name, buffer: rawBuffer });
    if (!scan.clean || scan.verdict === "MALICIOUS") {
      return fail(
        `Security check failed: ${summarizeScan(scan)}`,
        400
      );
    }

    // 4. Process and optimize image
    let finalBuffer: Buffer = rawBuffer;
    let width = 0;
    let height = 0;
    let outputExt = "jpg";

    if (mime.includes("svg")) {
      outputExt = "svg";
      width = 800;
      height = 600;
    } else {
      try {
        const image = sharp(rawBuffer);
        const meta = await image.metadata();
        width = meta.width || 1200;
        height = meta.height || 800;

        // If very large image, downscale for print/web balance
        if (width > 2400) {
          finalBuffer = await image
            .resize({ width: 2400, withoutEnlargement: true })
            .toBuffer();
          width = 2400;
          height = Math.round((2400 / (meta.width || 2400)) * (meta.height || 1600));
        }

        if (meta.format === "png") {
          outputExt = "png";
        } else if (meta.format === "webp") {
          outputExt = "webp";
        } else if (meta.format === "gif") {
          outputExt = "gif";
        } else {
          outputExt = "jpg";
        }
      } catch (err) {
        console.warn("[brsr/upload] sharp processing fallback:", err);
      }
    }

    // 5. Generate secure unique filename
    const hash = crypto.randomBytes(12).toString("hex");
    const sanitizedOriginal = (file.name || "image")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .substring(0, 30);
    const fileName = `brsr_${Date.now()}_${hash}_${sanitizedOriginal}.${outputExt}`;

    // 6. Save to public disk storage: public/brsr-uploads/
    const uploadDir = path.join(process.cwd(), "public", "brsr-uploads");
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadDir, fileName), finalBuffer);
    } catch (fsErr) {
      console.warn("[brsr/upload] Disk write warning (serverless fallback active):", fsErr);
    }

    // 7. Persist fallback base64 in db.appSetting for instant & durable cross-environment serving
    const base64Data = `data:${mime};base64,${finalBuffer.toString("base64")}`;
    try {
      await db.appSetting.upsert({
        where: { skey: `brsr_asset:${fileName}` },
        update: {
          svalue: base64Data,
          category: "BRSR_ASSET",
          label: fileName,
          vtype: "image",
        },
        create: {
          skey: `brsr_asset:${fileName}`,
          svalue: base64Data,
          category: "BRSR_ASSET",
          label: fileName,
          vtype: "image",
        },
      });
    } catch (dbErr) {
      console.warn("[brsr/upload] appSetting backup warning:", dbErr);
    }

    const publicUrl = `/api/esg/brsr/upload?file=${encodeURIComponent(fileName)}`;
    const staticUrl = `/brsr-uploads/${fileName}`;

    return ok({
      ok: true,
      id: fileName,
      url: publicUrl,
      staticUrl,
      fileName,
      originalName: file.name,
      width,
      height,
      sizeKb: Math.round(finalBuffer.length / 1024),
    });
  });
}

export async function GET(req: NextRequest) {
  const fileName = req.nextUrl.searchParams.get("file");
  if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    return new NextResponse("Invalid file identifier", { status: 400 });
  }

  // 1. Try reading from public/brsr-uploads
  const filePath = path.join(process.cwd(), "public", "brsr-uploads", fileName);
  if (fs.existsSync(filePath)) {
    try {
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(fileName).toLowerCase().replace(".", "");
      const mime =
        ext === "png"
          ? "image/png"
          : ext === "webp"
          ? "image/webp"
          : ext === "svg"
          ? "image/svg+xml"
          : ext === "gif"
          ? "image/gif"
          : "image/jpeg";

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": mime,
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
        const mime = match[1];
        const data = Buffer.from(match[2], "base64");
        return new NextResponse(data, {
          headers: {
            "Content-Type": mime,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
    }
  } catch {
    // Return 404 below
  }

  return new NextResponse("Image not found", { status: 404 });
}
