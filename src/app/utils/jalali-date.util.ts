import { Jalali } from 'jalali-ts';

/** Gregorian ISO date (YYYY-MM-DD) → Shamsi display (YYYY/MM/DD). */
export function gregorianIsoToShamsi(iso: string | null | undefined): string {
  if (!iso?.trim()) return '';
  const normalized = iso.trim().slice(0, 10);
  try {
    return Jalali.gregorian(normalized).format('YYYY/MM/DD');
  } catch {
    return '';
  }
}

/** Shamsi date string (YYYY/MM/DD or YYYY-MM-DD) → Gregorian ISO (YYYY-MM-DD). */
export function shamsiToGregorianIso(shamsi: string | null | undefined): string {
  if (!shamsi?.trim()) return '';
  const normalized = shamsi.trim().replace(/\//g, '-');
  try {
    return Jalali.parse(normalized).gregorian('YYYY-MM-DD');
  } catch {
    return '';
  }
}

/** Format a Gregorian ISO date for UI (Shamsi). */
export function formatGregorianAsShamsi(iso: string | null | undefined): string {
  const shamsi = gregorianIsoToShamsi(iso);
  return shamsi || '—';
}

/** Compact Shamsi display (M/D) for sprint sidebars, e.g. 9/15. */
export function formatGregorianAsShamsiCompact(iso: string | null | undefined): string {
  if (!iso?.trim()) return '';
  const normalized = iso.trim().slice(0, 10);
  try {
    const j = Jalali.gregorian(normalized);
    const month = String(j.getMonth() + 1).padStart(2, '0');
    const day = String(j.getDate()).padStart(2, '0');
    return `${month}/${day}`;
  } catch {
    return '';
  }
}
