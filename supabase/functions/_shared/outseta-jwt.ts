import * as jose from "npm:jose@5";

const ISSUER = Deno.env.get("OUTSETA_ISSUER") ?? "https://foundation-alpha-llc.outseta.com";
const JWKS_URL = `${ISSUER}/.well-known/jwks`;

const JWKS = jose.createRemoteJWKSet(new URL(JWKS_URL));

export async function personUidFromOutsetaJwt(req: Request): Promise<string> {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new Error("Missing access token");

  const { payload } = await jose.jwtVerify(token, JWKS, { issuer: ISSUER });
  const sub = typeof payload.sub === "string" ? payload.sub : "";
  if (!sub) throw new Error("Token has no person id");
  return sub;
}
