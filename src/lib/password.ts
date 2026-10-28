import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "crypto";

/** Promise wrapper around scrypt that supports cost options. */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) =>
      err ? reject(err) : resolve(derivedKey)
    );
  });
}

/* scrypt parameters (OWASP-recommended minimums) */
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;

/**
 * Hash a password with a per-user random salt.
 * Format: scrypt$N$r$p$saltB64$keyB64  — plaintext never touches the database.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scryptAsync(password.normalize("NFKC"), salt, KEY_LEN, {
    N,
    r: R,
    p: P,
  })) as Buffer;
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

/** Constant-time password verification. */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, n, r, p, saltB64, keyB64] = parts;
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(keyB64, "base64");
    const actual = (await scryptAsync(
      password.normalize("NFKC"),
      salt,
      expected.length,
      {
        N: Number(n),
        r: Number(r),
        p: Number(p),
      }
    )) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Platform-wide demo password. Accepted for every account (in addition to each
 * account's real scrypt hash) so the advertised "Default password" on the
 * gateway and portal sign-in screens always works. Comparison is trimmed and
 * case-insensitive to tolerate typo-level variance (Esg12345, ESG12345, …).
 */
export const DEMO_PASSWORD = "esg12345";

export function isDemoPassword(password: string): boolean {
  return password.trim().toLowerCase() === DEMO_PASSWORD;
}

/**
 * Burn roughly the same CPU time as a real verification when the account does
 * not exist — prevents user-enumeration through response timing.
 */
const DUMMY_HASH =
  "scrypt$16384$8$1$8mPeUZ5Pd0MxVGmQmdoL3w==$ZVd3Kz0FV1xOaEvHlmLX3kQ1dCJqOaEvHlmLX3kQ1dCJqOaEvHlmLX3kQ1dCJqOaEvHlmLX3kQ1dCJqOaEvHlmLX3kQ1dCJqOaEvHlmLX3kQ1dCJq";

export async function equalizeTiming(password: string): Promise<void> {
  try {
    const parts = DUMMY_HASH.split("$");
    const salt = Buffer.from(parts[4], "base64");
    const expected = Buffer.from(parts[5], "base64");
    await scryptAsync(password.normalize("NFKC"), salt, expected.length, {
      N: Number(parts[1]),
      r: Number(parts[2]),
      p: Number(parts[3]),
    });
  } catch {
    /* timing equalizer only */
  }
}
