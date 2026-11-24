/**
 * Shared naming and date rules for every chart export (TCTM JPG buttons and the
 * rest of the app), so files read the same in a research report.
 *
 *   file:  <title-slug>_<YYYY-MM-DD>.jpg   (date = last data point, else export day)
 *   label: "As of MM/DD/YYYY"              (else "Exported MM/DD/YYYY")
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Local calendar day as YYYY-MM-DD. */
export function todayIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Lower-case, dash-separated file stem, capped at 70 characters. */
export function exportStem(title: string, fallback = "chart"): string {
  const stem = String(title)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/&/g, "and")
    .replace(/%/g, "pct")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "");
  return stem || fallback;
}

/** The YYYY-MM-DD part of a data date, or null when it is not an ISO date. */
export function dataDateIso(asOf?: string | null): string | null {
  const m = asOf ? ISO_DATE.exec(asOf) : null;
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** MM/DD/YYYY, the same format TCTM prints. */
function usDate(iso: string): string {
  return `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
}

/** Text shown at the top right of an exported chart. */
export function exportDateLabel(asOf?: string | null, now = new Date()): string {
  const iso = dataDateIso(asOf);
  return iso ? `As of ${usDate(iso)}` : `Exported ${usDate(todayIso(now))}`;
}

export function exportFilename(
  title: string,
  asOf?: string | null,
  ext: "jpg" | "png" = "jpg",
  fallbackStem = "chart",
  now = new Date(),
): string {
  const date = dataDateIso(asOf) ?? todayIso(now);
  return `${exportStem(title, fallbackStem)}_${date}.${ext}`;
}
