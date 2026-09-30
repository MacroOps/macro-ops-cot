import { isCollectivePlanUid, isStaffPlanUid, isTurningPointPlanUid } from "./plans";

/** Route / nav gate. Collective includes Turning Point. Team Plan sees everything. */
export type AccessTier = "tp" | "collective" | "staff";

export type ViewAsMode = "staff" | "collective" | "tp";

export type AccessFlags = {
  isTurningPoint: boolean;
  isCollective: boolean;
  isStaff: boolean;
};

export function flagsFromPlan(planUid: string | null): AccessFlags {
  return {
    isCollective: isCollectivePlanUid(planUid),
    isTurningPoint: isTurningPointPlanUid(planUid),
    isStaff: isStaffPlanUid(planUid),
  };
}

/** UI-only mask for Team Plan accounts. Does not change Outseta. */
export function applyViewAs(real: AccessFlags, viewAs: ViewAsMode): AccessFlags {
  if (!real.isStaff || viewAs === "staff") return real;
  if (viewAs === "collective") {
    return { isStaff: false, isCollective: true, isTurningPoint: false };
  }
  return { isStaff: false, isCollective: false, isTurningPoint: true };
}

export function hasProductAccess(f: AccessFlags): boolean {
  return f.isCollective || f.isTurningPoint || f.isStaff;
}

export function canAccessTier(tier: AccessTier, f: AccessFlags): boolean {
  if (f.isStaff) return true;
  if (tier === "staff") return false;
  if (tier === "collective") return f.isCollective;
  return f.isTurningPoint || f.isCollective;
}

/**
 * Customer-visible routes = entire live data only (audit 2026-09-29).
 * Hybrid and mock stay staff until they are 100% live.
 */
export function pathAccessTier(pathname: string): AccessTier {
  const p = pathname.split("?")[0] || "/";

  if (p.startsWith("/signals/") || p.startsWith("/tp/")) return "tp";

  if (
    p === "/classic-hud" ||
    p === "/portfolio" ||
    p === "/community-alpha" ||
    p === "/alerts" ||
    p === "/briefing" ||
    p === "/tools/position-sizing" ||
    p === "/eurex" ||
    p === "/offsides"
  ) {
    return "collective";
  }

  return "staff";
}

export function canAccessPath(pathname: string, f: AccessFlags): boolean {
  if (pathname.startsWith("/workspace")) return canAccessTier("staff", f);
  return canAccessTier(pathAccessTier(pathname), f);
}

export function homePath(f: AccessFlags): string {
  if (f.isStaff) return "/overview";
  if (f.isCollective) return "/classic-hud";
  if (f.isTurningPoint) return "/signals/rankings";
  return "/classic-hud";
}
