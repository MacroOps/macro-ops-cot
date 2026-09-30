import * as jose from "npm:jose@5";

const ISSUER = Deno.env.get("OUTSETA_ISSUER") ?? "https://foundation-alpha-llc.outseta.com";
const JWKS_URL = `${ISSUER}/.well-known/jwks`;

const JWKS = jose.createRemoteJWKSet(new URL(JWKS_URL));

/** Keep in sync with src/lib/outseta/plans.ts */
export const COLLECTIVE_PLAN_UIDS = [
  "xmeVBjQV", // Monthly
  "wQXNjaWK", // Quarterly
  "L9P3JEQJ", // Yearly
  "L9Plrn9J", // Lifetime
] as const;

export type OutsetaClaims = {
  personUid: string;
  planUid: string | null;
  addOnUids: string[];
};

export const TURNING_POINT_PLAN_UIDS: readonly string[] = [
  ...new Set([
    "rQVar8m6", // Quarterly
    "rmk44oQg", // Yearly
    "NmdklpW0", // Lifetime
    ...(Deno.env.get("OUTSETA_TP_PLAN_UIDS") ?? "")
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  ]),
];

export const TEAM_PLAN_UID = "7malDMWE";

export function isCollectivePlanUid(uid: string | null | undefined): boolean {
  return !!uid && (COLLECTIVE_PLAN_UIDS as readonly string[]).includes(uid);
}

export function isTurningPointPlanUid(uid: string | null | undefined): boolean {
  return !!uid && TURNING_POINT_PLAN_UIDS.includes(uid);
}

export function isStaffPlanUid(uid: string | null | undefined): boolean {
  return uid === TEAM_PLAN_UID;
}

export async function claimsFromOutsetaJwt(req: Request): Promise<OutsetaClaims> {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new Error("Missing access token");

  const { payload } = await jose.jwtVerify(token, JWKS, { issuer: ISSUER });
  const personUid = typeof payload.sub === "string" ? payload.sub : "";
  if (!personUid) throw new Error("Token has no person id");
  const rawPlan = payload["outseta:planUid"];
  const planUid = typeof rawPlan === "string" && rawPlan ? rawPlan : null;
  const rawAddOns = payload["outseta:addOnUids"];
  const addOnUids = Array.isArray(rawAddOns)
    ? rawAddOns.filter((x): x is string => typeof x === "string" && !!x)
    : [];
  return { personUid, planUid, addOnUids };
}

export async function personUidFromOutsetaJwt(req: Request): Promise<string> {
  const { personUid } = await claimsFromOutsetaJwt(req);
  return personUid;
}
