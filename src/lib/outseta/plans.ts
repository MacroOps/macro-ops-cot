/** Outseta plan UIDs. Keep in sync with supabase/functions/_shared/outseta-jwt.ts */

export const COLLECTIVE_PLAN_UIDS = [
  "xmeVBjQV", // Monthly (inactive in billing, still accepted)
  "wQXNjaWK", // Quarterly
  "L9P3JEQJ", // Yearly
  "L9Plrn9J", // Lifetime
] as const;

/** Same family as Collective (`rmkaK09g`). Inactive until prices are set. Extra UIDs via env. */
export const TURNING_POINT_PLAN_UIDS: readonly string[] = uniqueUids([
  "rQVar8m6", // Quarterly
  "rmk44oQg", // Yearly
  "NmdklpW0", // Lifetime
  ...splitEnv(import.meta.env.VITE_OUTSETA_TP_PLAN_UIDS),
]);

/** Company / ops. Inactive $0 plan, not sold. JWT outseta:planUid. */
export const TEAM_PLAN_UID = "7malDMWE";

function splitEnv(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function uniqueUids(uids: string[]): string[] {
  return [...new Set(uids)];
}

export function isCollectivePlanUid(uid: string | null | undefined): boolean {
  return !!uid && (COLLECTIVE_PLAN_UIDS as readonly string[]).includes(uid);
}

export function isTurningPointPlanUid(uid: string | null | undefined): boolean {
  return !!uid && TURNING_POINT_PLAN_UIDS.includes(uid);
}

export function isStaffPlanUid(uid: string | null | undefined): boolean {
  return uid === TEAM_PLAN_UID;
}

export function planUidFromJwt(token: string): string | null {
  return jwtPayload(token)?.["outseta:planUid"] as string | null ?? null;
}

function jwtPayload(token: string): Record<string, unknown> | null {
  try {
    const seg = token.split(".")[1];
    if (!seg) return null;
    const json = atob(seg.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}
