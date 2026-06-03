// Browser-local annotations layer for indicator charts.
// Keyed by indicatorKey (stable id per chart, falls back to seed).

export interface Annotation {
  id: string;
  indicatorKey: string;
  t: string;        // ISO date
  v: number;        // value on chart
  note: string;
  color?: string;
  createdAt: string;
}

const KEY = "mhud:annotations:v1";

function readAll(): Annotation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Annotation[];
  } catch {
    return [];
  }
}

function writeAll(rows: Annotation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent("mhud:annotations-changed"));
}

export function listAnnotations(indicatorKey: string): Annotation[] {
  return readAll()
    .filter((a) => a.indicatorKey === indicatorKey)
    .sort((a, b) => (a.t < b.t ? -1 : 1));
}

export function listAllAnnotations(): Annotation[] {
  return readAll().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function addAnnotation(a: Omit<Annotation, "id" | "createdAt">): Annotation {
  const row: Annotation = {
    ...a,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const all = readAll();
  all.push(row);
  writeAll(all);
  return row;
}

export function removeAnnotation(id: string) {
  writeAll(readAll().filter((a) => a.id !== id));
}
