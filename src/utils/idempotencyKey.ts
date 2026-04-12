/** Client idempotency key for safe POST retries (matches backend min length 8). */
export function generateIdempotencyKey(): string {
  const p = typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID;
  if (typeof p === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
