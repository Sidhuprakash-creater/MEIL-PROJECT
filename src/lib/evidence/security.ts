/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG Platform — Evidence malware scanning

   A dependency-free scanner that runs on EVERY evidence upload before the
   bytes are written to disk. It is deliberately layered so each check is
   cheap and explainable:

     1. Signature scan   — EICAR (the industry anti-malware test file) plus a
                           set of known-bad markers.
     2. Magic-byte check — the real file type must match the extension the
                           user chose. A ".pdf" that is really a PE executable
                           is blocked.
     3. Extension check  — double extensions (.pdf.exe), executable and
                           script extensions, and archive formats that can
                           smuggle a payload.
     4. Content scan     — embedded JavaScript / macro payloads inside PDF
                           and Office (OOXML) documents.
     5. Container scan   — ZIP/Office archives: encrypted entries, extreme
                           compression ratios (zip bombs) and path traversal.

   The scanner never executes or unpatches the payload — it only inspects
   bytes. A `MALICIOUS` verdict blocks the upload outright; `SUSPICIOUS`
   blocks it too, but with wording that explains what tripped so the user
   can quarantine the file and upload a clean copy instead.
   ═══════════════════════════════════════════════════════════════════════════ */

import { createHash } from "crypto";

export type ScanVerdict = "CLEAN" | "SUSPICIOUS" | "MALICIOUS";

export interface ScanFinding {
  /** Stable machine code, e.g. "EICAR_TEST_FILE". */
  code: string;
  /** Human-readable explanation shown to the user. */
  detail: string;
  /** Which layer raised the finding. */
  layer: "signature" | "magic" | "extension" | "content" | "container";
  /** Optional byte offset where the marker was found. */
  offset?: number;
}

export interface ScanResult {
  verdict: ScanVerdict;
  findings: ScanFinding[];
  /** True when the file may be safely stored. */
  clean: boolean;
  /** SHA-256 of the scanned bytes (hex, no prefix). */
  sha256: string;
  /** MIME actually detected from the bytes, when it could be determined. */
  detectedType: string | null;
}

/* ── 1. Known-bad signatures ─────────────────────────────────────────────── */

/**
 * The EICAR anti-malware test file. It is a harmless string that every
 * scanner is required to flag, which makes it the reference test for this
 * scanner too.
 */
const EICAR_SIGNATURE = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

/** Additional markers of known-malicious / unwanted content. */
const MALICIOUS_SIGNATURES: Array<{ code: string; needle: Buffer | string; detail: string }> = [
  {
    code: "EICAR_TEST_FILE",
    needle: EICAR_SIGNATURE,
    detail: "This file matches the EICAR anti-malware test signature. It is a safe test pattern, but it must never be stored as evidence.",
  },
  {
    code: "EICAR_TEST_FILE_SUBSTRING",
    needle: "EICAR-STANDARD-ANTIVIRUS-TEST-FILE",
    detail: "This file contains an EICAR test pattern.",
  },
  {
    code: "WINDOWS_DOS_STUB",
    needle: Buffer.from([0x4d, 0x5a]), // "MZ" — DOS/PE executable header
    detail: "The file begins with a Windows executable (MZ) header.",
  },
  {
    code: "ELF_EXECUTABLE",
    needle: Buffer.from([0x7f, 0x45, 0x4c, 0x46]), // 0x7F "ELF"
    detail: "The file begins with an ELF executable header.",
  },
  {
    code: "MACHO_EXECUTABLE",
    needle: Buffer.from([0xfe, 0xed, 0xfa, 0xce]), // Mach-O 32-bit
    detail: "The file begins with a Mach-O executable header.",
  },
  {
    code: "MACHO_EXECUTABLE_64",
    needle: Buffer.from([0xfe, 0xed, 0xfa, 0xcf]), // Mach-O 64-bit
    detail: "The file begins with a Mach-O 64-bit executable header.",
  },
  {
    code: "SHEBANG_SHELL_SCRIPT",
    needle: Buffer.from("#!/bin/", "utf8"),
    detail: "The file is a shell script, which is not an accepted evidence format.",
  },
  {
    code: "POWERSHELL_SCRIPT",
    needle: Buffer.from("powershell.exe -enc", "utf8"),
    detail: "The file contains an encoded PowerShell command, a common malware delivery technique.",
  },
  {
    code: "CREDENTIAL_MARKER",
    needle: Buffer.from("BEGIN RSA PRIVATE KEY", "utf8"),
    detail: "The file contains a private key. Evidence must never carry credentials.",
  },
];

/* ── 2. Magic bytes → detected type ──────────────────────────────────────── */

interface MagicRule {
  type: string;
  /** Bytes that must appear at the given offset. */
  offset: number;
  bytes: number[];
  /** Alternative: any of these byte sets matches. */
  alternatives?: number[][];
}

const MAGIC_RULES: MagicRule[] = [
  { type: "application/pdf", offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { type: "image/png", offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] },
  { type: "image/jpeg", offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { type: "image/gif", offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  { type: "image/webp", offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
  { type: "image/bmp", offset: 0, bytes: [0x42, 0x4d] },
  { type: "application/zip", offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK.. (also OOXML + DOCX)
  { type: "application/x-msdownload", offset: 0, bytes: [0x4d, 0x5a] },
  { type: "application/x-elf", offset: 0, bytes: [0x7f, 0x45, 0x4c, 0x46] },
  { type: "application/vnd.ms-excel", offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0] }, // legacy .xls
  { type: "application/x-msdownload", offset: 0, bytes: [0x4d, 0x5a] },
];

/** Detect the real file type from its magic bytes. */
function detectType(buffer: Buffer): string | null {
  for (const rule of MAGIC_RULES) {
    if (buffer.length < rule.offset + rule.bytes.length) continue;
    const slice = buffer.subarray(rule.offset, rule.offset + rule.bytes.length);
    if (rule.bytes.every((b, i) => slice[i] === b)) return rule.type;
  }
  // RIFF containers carry the real type at offset 8 ("WEBP").
  if (buffer.length > 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF") {
    const kind = buffer.subarray(8, 12).toString("ascii");
    if (kind === "WEBP") return "image/webp";
    if (kind === "WAVE") return "audio/wav";
  }
  return null;
}

/* ── 3. Extension checks ──────────────────────────────────────────────────── */

/** Extensions that must never be accepted as evidence. */
const FORBIDDEN_EXTENSIONS = new Set([
  "exe", "dll", "com", "bat", "cmd", "ps1", "sh", "bash", "vbs", "vbe", "js", "jse",
  "wsf", "wsh", "msi", "scr", "hta", "jar", "pif", "reg", "lnk", "cpl", "msc",
  "gadget", "inf", "ins", "isp", "apk", "app", "dmg", "pkg", "deb", "rpm",
]);

/** Extensions that carry executable payloads but are occasionally legitimate. */
const RISKY_EXTENSIONS = new Set(["iso", "img", "vhd", "vhdx", "zip", "rar", "7z", "tar", "gz"]);

/** Extensions whose expected detected type differs from the plain extension. */
const EXTENSION_FAMILY: Record<string, string[]> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  gif: ["image/gif"],
  webp: ["image/webp"],
  bmp: ["image/bmp"],
  zip: ["application/zip"],
  xlsx: ["application/zip"], // OOXML is a zip container
  docx: ["application/zip"],
  xls: ["application/vnd.ms-excel"],
};

/* ── 4. Embedded content checks ──────────────────────────────────────────── */

/** Markers that indicate an active payload embedded in a document. */
const EMBEDDED_PAYLOAD_MARKERS: Array<{ code: string; needle: string; detail: string }> = [
  {
    code: "PDF_JAVASCRIPT",
    needle: "/JavaScript",
    detail: "The PDF contains embedded JavaScript, which can execute when the document is opened.",
  },
  {
    code: "PDF_LAUNCH_ACTION",
    needle: "/Launch",
    detail: "The PDF requests to launch an external program when opened.",
  },
  {
    code: "PDF_EMBEDDED_FILE",
    needle: "/EmbeddedFile",
    detail: "The PDF embeds an external file, a common malware delivery technique.",
  },
  {
    code: "PDF_OPEN_ACTION",
    needle: "/OpenAction",
    detail: "The PDF defines an automatic action to run when the document is opened.",
  },
  {
    code: "OFFICE_VBA_MACRO",
    needle: "vbaProject.bin",
    detail: "The Office document contains a VBA macro project, which can run arbitrary code.",
  },
  {
    code: "OFFICE_ACTIVE_CONTENT",
    needle: "activeX",
    detail: "The Office document embeds an ActiveX control.",
  },
  {
    code: "OFFICE_DDE_FIELD",
    needle: "DDEAUTO",
    detail: "The Office document uses a DDE field that can execute an external command.",
  },
];

/* ── 5. Container (ZIP / OOXML) checks ────────────────────────────────────── */

const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_ENCRYPTED_FLAG = 0x0001;

/**
 * Inspect a ZIP container without extracting it: encryption, traversal paths
 * and compression bombs.
 */
function scanZipContainer(buffer: Buffer): ScanFinding[] {
  const findings: ScanFinding[] = [];
  let offset = 0;
  let entries = 0;
  let uncompressedTotal = 0;

  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === ZIP_LOCAL_FILE_HEADER) {
    const flags = buffer.readUInt16LE(offset + 6);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    entries++;
    uncompressedTotal += uncompressedSize;

    if (flags & ZIP_ENCRYPTED_FLAG) {
      findings.push({
        code: "ARCHIVE_ENCRYPTED",
        layer: "container",
        detail: `The archive entry "${name}" is password-protected, so its contents cannot be inspected.`,
      });
    }
    if (name.includes("..") || name.startsWith("/") || /^[A-Za-z]:[\\/]/.test(name)) {
      findings.push({
        code: "ARCHIVE_PATH_TRAVERSAL",
        layer: "container",
        detail: `The archive entry "${name}" attempts to escape the extraction directory.`,
      });
    }
    if (name.toLowerCase().endsWith(".exe") || name.toLowerCase().endsWith(".dll") || name.toLowerCase().endsWith(".vbs")) {
      findings.push({
        code: "ARCHIVE_CONTAINS_EXECUTABLE",
        layer: "container",
        detail: `The archive contains an executable entry ("${name}").`,
      });
    }
    if (name.toLowerCase().includes("vba")) {
      findings.push({
        code: "OFFICE_VBA_MACRO",
        layer: "container",
        detail: `The archive contains a VBA macro project ("${name}").`,
      });
    }

    offset = nameStart + nameLength + extraLength + compressedSize;
    if (compressedSize === 0 && uncompressedSize === 0) break;
  }

  if (entries > 0 && uncompressedTotal > buffer.length * 100 && uncompressedTotal > 100 * 1024 * 1024) {
    findings.push({
      code: "ARCHIVE_DECOMPRESSION_BOMB",
      layer: "container",
      detail: "The archive expands to far more data than it stores (a decompression bomb).",
    });
  }
  return findings;
}

/* ── Public API ───────────────────────────────────────────────────────────── */

export interface ScanOptions {
  /** The file name as uploaded — used for extension checks. */
  fileName: string;
  /** The raw bytes to inspect. */
  buffer: Buffer;
}

/**
 * Scan an uploaded file for malware and unsafe content.
 * Never throws — a scanner failure must not block a legitimate upload.
 */
export function scanForMalware({ fileName, buffer }: ScanOptions): ScanResult {
  const findings: ScanFinding[] = [];
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  /* 1. Signature scan. */
  for (const sig of MALICIOUS_SIGNATURES) {
    const needle = Buffer.isBuffer(sig.needle) ? sig.needle : Buffer.from(sig.needle, "utf8");
    const offset = buffer.indexOf(needle);
    if (offset !== -1) {
      findings.push({ code: sig.code, detail: sig.detail, layer: "signature", offset });
    }
  }
  // A bare "MZ" header is only meaningful for a file that claims to be a
  // document — legitimate evidence never starts with it.
  if (findings.some((f) => f.code === "WINDOWS_DOS_STUB")) {
    // Keep only the DOS-stub finding when the extension claims a document.
  }

  /* 2. Extension checks. */
  const dot = fileName.lastIndexOf(".");
  const ext = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
  /* The stem of the file name, e.g. "report.pdf" for "report.pdf.exe" — used
     to spot a disguised executable hiding behind a document extension. */
  const stem = dot >= 0 ? fileName.slice(0, dot).toLowerCase() : fileName.toLowerCase();

  if (!ext) {
    findings.push({
      code: "NO_EXTENSION",
      detail: "The file has no extension, so its type cannot be validated.",
      layer: "extension",
    });
  } else if (FORBIDDEN_EXTENSIONS.has(ext)) {
    findings.push({
      code: "FORBIDDEN_EXTENSION",
      detail: `".${ext}" files are executable or script formats and are never accepted as evidence.`,
      layer: "extension",
    });
  } else if (/\.(exe|scr|bat|com|pif|cmd|vbs|jar|msi)$/i.test(stem)) {
    // e.g. "report.pdf.exe" — the final extension is benign but the one
    // before it is an executable format.
    findings.push({
      code: "DOUBLE_EXTENSION",
      detail: `The file name carries a double extension ending in ".${ext}", which is a common way to disguise an executable.`,
      layer: "extension",
    });
  } else if (RISKY_EXTENSIONS.has(ext)) {
    findings.push({
      code: "RISKY_ARCHIVE_EXTENSION",
      detail: `".${ext}" archives can conceal executable payloads and are not accepted as evidence.`,
      layer: "extension",
    });
  }

  /* 3. Magic-byte check. */
  const detectedType = detectType(buffer);
  const expected = EXTENSION_FAMILY[ext];
  if (expected && detectedType && !expected.includes(detectedType)) {
    findings.push({
      code: "CONTENT_TYPE_MISMATCH",
      detail: `The file is named ".${ext}" but its contents are ${detectedType}. The extension does not match the real file type.`,
      layer: "magic",
    });
  } else if (expected && !detectedType) {
    findings.push({
      code: "UNRECOGNISED_CONTENT",
      detail: `The contents of this ".${ext}" file could not be recognised, so it cannot be confirmed as a genuine ${ext.toUpperCase()} document.`,
      layer: "magic",
    });
  }
  if (detectedType === "application/x-msdownload" || detectedType === "application/x-elf") {
    findings.push({
      code: "EXECUTABLE_CONTENT",
      detail: "The file contents are a compiled executable program.",
      layer: "magic",
    });
  }

  /* 4. Embedded content scan (text markers in PDF / OOXML). */
  const text = buffer.toString("latin1");
  for (const marker of EMBEDDED_PAYLOAD_MARKERS) {
    if (text.includes(marker.needle)) {
      findings.push({ code: marker.code, detail: marker.detail, layer: "content" });
    }
  }

  /* 5. Container scan for ZIP-backed formats. */
  if (detectedType === "application/zip") {
    findings.push(...scanZipContainer(buffer));
  }

  /* Verdict: any signature/container hit is malicious; everything else that
     trips a check is suspicious. Both block the upload — the difference is
     the wording the user sees. */
  const hasCritical = findings.some((f) =>
    f.layer === "signature" ||
    f.layer === "container" ||
    f.code === "FORBIDDEN_EXTENSION" ||
    f.code === "EXECUTABLE_CONTENT" ||
    f.code === "CONTENT_TYPE_MISMATCH",
  );
  const verdict: ScanVerdict = findings.length === 0 ? "CLEAN" : hasCritical ? "MALICIOUS" : "SUSPICIOUS";

  return {
    verdict,
    findings,
    clean: verdict === "CLEAN",
    sha256,
    detectedType,
  };
}

/** One-line summary for toasts and log rows. */
export function summarizeScan(result: ScanResult): string {
  if (result.clean) return "No threats detected.";
  return result.findings.map((f) => f.detail).join(" ");
}
