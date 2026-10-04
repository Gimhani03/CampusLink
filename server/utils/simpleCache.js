/**
 * Simple in-memory TTL cache.
 *
 * Used by the recommendation engine to avoid re-running the full
 * aggregation pipeline on every request. Each student's recommendation
 * result is cached for 5 minutes (configurable per call site).
 *
 * Design constraints and trade-offs:
 *
 *   ✓  Zero dependencies — no Redis required.
 *   ✓  Works correctly in a single Node.js process.
 *   ✗  Not shared across multiple processes/instances.
 *      For horizontally-scaled deployments, replace this module with a
 *      Redis adapter that exposes the same { get, set, invalidate } interface.
 *      Because every caller uses this module (not a concrete implementation),
 *      the swap requires changing only this file.
 *
 * Cache invalidation policy:
 *   - TTL expiry (lazy deletion on next get).
 *   - Explicit key deletion via invalidate().
 *   - Prefix-based bulk deletion via invalidateByPrefix().
 *   - Full clear via clear() (intended for tests only).
 */

/** @type {Map<string, { value: *, expiresAt: number }>} */
const store = new Map();

/**
 * Retrieves a cached value. Returns null on miss or expiry.
 *
 * @param {string} key
 * @returns {*|null}
 */
export const get = (key) => {
  const entry = store.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }

  return entry.value;
};

/**
 * Stores a value with a TTL.
 *
 * @param {string} key
 * @param {*}      value
 * @param {number} [ttlMs=300000]  Time-to-live in milliseconds (default 5 min).
 */
export const set = (key, value, ttlMs = 5 * 60 * 1000) => {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
};

/**
 * Removes a specific key from the cache.
 *
 * @param {string} key
 */
export const invalidate = (key) => {
  store.delete(key);
};

/**
 * Removes all keys that begin with the given prefix.
 * Useful for invalidating all entries related to a resource
 * (e.g. all recommendation caches when a new event is published).
 *
 * @param {string} prefix
 */
export const invalidateByPrefix = (prefix) => {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
};

/**
 * Clears the entire cache. Intended for test teardown only.
 */
export const clear = () => store.clear();

/** Returns current cache size (useful for health/monitoring endpoints). */
export const size = () => store.size;
