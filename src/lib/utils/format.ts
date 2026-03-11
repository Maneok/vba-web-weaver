/**
 * French business formatting utilities — SIREN, SIRET, IBAN, durations, pluralization.
 */

/** Format SIREN with spaces: 123 456 789 */
export function formatSiren(siren: string): string {
  if (!siren) return "";
  const digits = siren.replace(/\D/g, "");
  if (digits.length !== 9) return siren;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
}

/** Format SIRET with spaces: 123 456 789 00012 */
export function formatSiret(siret: string): string {
  if (!siret) return "";
  const digits = siret.replace(/\D/g, "");
  if (digits.length !== 14) return siret;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9, 14)}`;
}

/** Format IBAN with spaces every 4 chars: FR76 3000 6000 0112 3456 7890 189 */
export function formatIban(iban: string): string {
  if (!iban) return "";
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  return cleaned.replace(/(.{4})/g, "$1 ").trim();
}

/** Format a duration in seconds to French display */
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0s";
  if (seconds < 60) return `${Math.round(seconds)}s`;

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);

  if (h > 0) {
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  return s > 0 ? `${m}min ${s}s` : `${m}min`;
}

/** French pluralization helper */
export function pluralize(count: number, singular: string, plural?: string): string {
  const p = plural ?? (singular + "s");
  const word = Math.abs(count) <= 1 ? singular : p;
  return `${count} ${word}`;
}
