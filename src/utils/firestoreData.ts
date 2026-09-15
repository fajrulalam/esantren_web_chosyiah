/**
 * Firestore rejects `undefined` values in document writes by default.
 * Keep other falsy values because they can be meaningful field values.
 */
export function removeUndefinedFields<T extends Record<string, unknown>>(
  data: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}
