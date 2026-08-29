/** Outseta plan UIDs for The Collective. Monthly is inactive in billing but still accepted. */
export const COLLECTIVE_PLAN_UIDS = [
  "xmeVBjQV", // Monthly
  "wQXNjaWK", // Quarterly
  "L9P3JEQJ", // Yearly
  "L9Plrn9J", // Lifetime
] as const;

export function isCollectivePlanUid(uid: string | null | undefined): boolean {
  return !!uid && (COLLECTIVE_PLAN_UIDS as readonly string[]).includes(uid);
}

export function planUidFromJwt(token: string): string | null {
  try {
    const seg = token.split(".")[1];
    if (!seg) return null;
    const json = atob(seg.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as Record<string, unknown>;
    const uid = payload["outseta:planUid"];
    return typeof uid === "string" && uid ? uid : null;
  } catch {
    return null;
  }
}
