import type { ViewAsMode } from "./entitlements";

const KEY = "terminus-view-as";

export function readViewAs(): ViewAsMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "collective" || v === "tp" || v === "staff") return v;
  } catch {
    /* ignore */
  }
  return "staff";
}

export function writeViewAs(mode: ViewAsMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* ignore */
  }
}
