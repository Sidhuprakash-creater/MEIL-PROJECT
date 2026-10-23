/* In-memory login attempt throttling (single-instance dev/demo tier).
   Production would move this to a shared store — see worklog notes.         */

interface AttemptRecord {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

const attempts = new Map<string, AttemptRecord>();

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;
const WINDOW_MINUTES = 15;

function sweep(now: number): void {
  for (const [k, rec] of attempts) {
    if (
      rec.lockedUntil < now &&
      now - rec.firstFailureAt > WINDOW_MINUTES * 60_000
    ) {
      attempts.delete(k);
    }
  }
}

export function attemptKey(ip: string, employeeId: string): string {
  return `${ip}::${employeeId.toUpperCase()}`;
}

export function isLocked(key: string): { locked: boolean; retryAfterMin?: number } {
  const now = Date.now();
  sweep(now);
  const rec = attempts.get(key);
  if (rec && rec.lockedUntil > now) {
    return {
      locked: true,
      retryAfterMin: Math.max(1, Math.ceil((rec.lockedUntil - now) / 60_000)),
    };
  }
  return { locked: false };
}

export function recordFailure(key: string): void {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.firstFailureAt > WINDOW_MINUTES * 60_000) {
    attempts.set(key, {
      failures: 1,
      firstFailureAt: now,
      lockedUntil: 0,
    });
    return;
  }
  rec.failures += 1;
  if (rec.failures >= MAX_FAILURES) {
    rec.lockedUntil = now + LOCK_MINUTES * 60_000;
  }
}

export function recordSuccess(key: string): void {
  attempts.delete(key);
}
