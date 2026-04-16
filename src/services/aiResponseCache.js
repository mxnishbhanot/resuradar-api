import crypto from "crypto";

const cacheEnabled = () =>
  ["1", "true", "yes"].includes(String(process.env.AI_ENABLE_RESPONSE_CACHE || "").toLowerCase());

const ttlMs = () => Math.max(60_000, Number(process.env.AI_RESPONSE_CACHE_TTL_MS || 600_000));
const maxEntries = () => Math.max(10, Number(process.env.AI_RESPONSE_CACHE_MAX_ENTRIES || 200));

/** @type {Map<string, { value: unknown, expiresAt: number }>} */
const store = new Map();

function evictExpired() {
  const now = Date.now();
  for (const [k, entry] of store) {
    if (entry.expiresAt < now) store.delete(k);
  }
}

function evictLruIfFull() {
  while (store.size >= maxEntries()) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/**
 * @param {string[]} parts stable string parts for the cache key
 * @returns {string}
 */
export function aiResponseCacheKey(parts) {
  return crypto.createHash("sha256").update(parts.join("::")).digest("hex");
}

/** @returns {unknown|undefined} */
export function aiResponseCacheGet(key) {
  if (!cacheEnabled()) return undefined;
  evictExpired();
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  store.delete(key);
  store.set(key, entry);
  return entry.value;
}

/** @param {string} key */
export function aiResponseCacheSet(key, value) {
  if (!cacheEnabled()) return;
  evictExpired();
  evictLruIfFull();
  store.set(key, { value, expiresAt: Date.now() + ttlMs() });
}
