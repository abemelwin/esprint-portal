/**
 * sanitize.ts — Direct port from esprint-check-monitoring/lib/sanitize.ts.
 * Strips mobile keyboard artifacts from user input before saving.
 */

export function sanitizeString(str: unknown): unknown {
  if (str == null || typeof str !== 'string') return str;
  let s = str;
  s = s.replace(/[\u2018\u2019\u201A\u2039\u203A]/g, "'");
  s = s.replace(/[\u201C\u201D\u201E\u00AB\u00BB]/g, '"');
  s = s.replace(/[\u2013\u2014]/g, '-');
  s = s.replace(/\u2026/g, '...');
  s = s.replace(/[\u200B\u200C\u200D\u200E\u200F\uFEFF\u00AD\u2060\u180E]/g, '');
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
  return s;
}

export function sanitizeDeep<T>(value: T): T {
  if (typeof value === 'string') return sanitizeString(value) as T;
  if (Array.isArray(value)) return value.map(sanitizeDeep) as unknown as T;
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value as object)) {
      result[key] = sanitizeDeep((value as Record<string, unknown>)[key]);
    }
    return result as T;
  }
  return value;
}
