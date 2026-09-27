// Pure matching rules for tying a signed-in Firebase account to a santri record.
// Kept free of Firebase imports so it can be unit tested with plain Node.

export interface SantriEmailCandidate {
  id: string;
  email?: unknown;
  statusAktif?: unknown;
}

export type SantriEmailMatch =
  | { santriId: string }
  | { error: "not-found" | "ambiguous" };

/** Emails are compared trimmed and case-insensitively, as typed data varies. */
export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * Picks the one santri whose email matches. When several records share the
 * email (e.g. an old duplicate), the single active record wins; otherwise the
 * match is ambiguous and a staff member has to fix the data.
 */
export function pickSantriForEmail(
  email: string,
  candidates: readonly SantriEmailCandidate[],
): SantriEmailMatch {
  const target = normalizeEmail(email);
  if (!target) return { error: "not-found" };
  const matches = candidates.filter((candidate) => normalizeEmail(candidate.email) === target);
  if (matches.length === 0) return { error: "not-found" };
  if (matches.length === 1) return { santriId: matches[0].id };
  const active = matches.filter((candidate) => candidate.statusAktif === "Aktif");
  if (active.length === 1) return { santriId: active[0].id };
  return { error: "ambiguous" };
}
