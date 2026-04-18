/**
 * MySQL 8 JSON columns are returned by mysql2 as already-parsed JavaScript
 * values in most driver configurations, but can surface as raw strings when
 * certain server-side casts (e.g. CAST(... AS CHAR)) or driver options come
 * into play. `JSON.parse(anObject)` coerces to the string "[object Object]"
 * and throws at runtime — this helper normalises either shape safely.
 *
 * Also tolerates `null`/`undefined` by returning `null`, which is how our
 * route schemas represent "absent" JSON columns.
 */
export const parseDbJson = <T = unknown>(value: unknown): T | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    // MySQL returned the raw JSON text; decode it.
    try {
      return JSON.parse(value) as T;
    } catch {
      // Fall through to surface the exact payload for the caller to handle
      // (e.g. when the column legitimately stores an opaque string).
      return value as unknown as T;
    }
  }

  // mysql2 already gave us a parsed JSON value.
  return value as T;
};
