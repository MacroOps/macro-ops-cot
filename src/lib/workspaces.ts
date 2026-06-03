// Browser-local saved workspaces. Each workspace is a collection of
// pinned indicator cards (seed + spec) rendered on a dedicated page.

export interface WorkspaceItem {
  id: string;
  title: string;
  subtitle?: string;
  seed: number;
  variant?: "line" | "area" | "bar";
  min?: number;
  max?: number;
  drift?: number;
  thresholdHi?: number;
  thresholdLo?: number;
  unit?: string;
  indicatorKey?: string;
  sourceHref?: string;
}

export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  items: WorkspaceItem[];
}

const KEY = "mhud:workspaces:v1";

function readAll(): Workspace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Workspace[];
  } catch {
    return [];
  }
}

function writeAll(rows: Workspace[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent("mhud:workspaces-changed"));
}

export function listWorkspaces(): Workspace[] {
  return readAll().sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

export function getWorkspace(id: string): Workspace | null {
  return readAll().find((w) => w.id === id) ?? null;
}

export function createWorkspace(name: string): Workspace {
  const w: Workspace = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    items: [],
  };
  writeAll([...readAll(), w]);
  return w;
}

export function renameWorkspace(id: string, name: string) {
  writeAll(readAll().map((w) => (w.id === id ? { ...w, name } : w)));
}

export function deleteWorkspace(id: string) {
  writeAll(readAll().filter((w) => w.id !== id));
}

export function addItem(workspaceId: string, item: Omit<WorkspaceItem, "id">): Workspace | null {
  const all = readAll();
  const idx = all.findIndex((w) => w.id === workspaceId);
  if (idx < 0) return null;
  const exists = all[idx].items.some((i) => i.seed === item.seed && i.title === item.title);
  if (!exists) {
    all[idx] = {
      ...all[idx],
      items: [...all[idx].items, { ...item, id: crypto.randomUUID() }],
    };
    writeAll(all);
  }
  return all[idx];
}

export function removeItem(workspaceId: string, itemId: string) {
  const all = readAll();
  const idx = all.findIndex((w) => w.id === workspaceId);
  if (idx < 0) return;
  all[idx] = { ...all[idx], items: all[idx].items.filter((i) => i.id !== itemId) };
  writeAll(all);
}

export function useWorkspacesVersion(): number {
  // Caller can use this with useSyncExternalStore-like pattern; for simplicity
  // we leave a hook in WorkspacesProvider further down components.
  return 0;
}
