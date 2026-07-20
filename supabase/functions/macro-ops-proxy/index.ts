// Secure proxy to the Macro Ops Signal API.
// Keeps MACRO_OPS_API_KEY server-side. Whitelists paths and forwards all
// query params. Also supports POST /v1/pipe with a JSON body.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BASE = Deno.env.get("MACRO_OPS_API_URL") ?? "";
const KEY  = Deno.env.get("MACRO_OPS_API_KEY") ?? "";

const ALLOWED_PATHS = new Set([
  "/v1/signal-keys",
  "/v1/signal",
  "/v1/signals",
  "/v1/signal/where",
  "/v1/scan",
  "/v1/rank",
  "/v1/changes",
  "/v1/transitions",
  "/v1/streak",
  "/v1/extremes",
  "/v1/percentile",
  "/v1/aggregate",
  "/v1/distribution",
  "/v1/members",
  "/v1/groups",
  "/v1/entities",
  "/v1/enrich",
  "/v1/pipe",
  "/v1/endpoints",
  "/health",
]);

function json(body: unknown, status = 200, extra: Record<string,string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!BASE || !KEY) return json({ error: "MACRO_OPS_API_URL/KEY not configured" }, 500);

  try {
    const inUrl = new URL(req.url);

    // The edge function is mounted at /functions/v1/macro-ops-proxy.
    // Callers pass the upstream path via ?path=/v1/signal or POST body { path, params }.
    let upstreamPath = inUrl.searchParams.get("path") ?? "";
    let params: Record<string, unknown> = {};
    let body: unknown = null;
    let method = req.method;

    if (req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      upstreamPath = b?.path ?? upstreamPath;
      params = b?.params ?? {};
      body = b?.body ?? null;
      method = b?.method ?? (body ? "POST" : "GET");
    } else {
      for (const [k, v] of inUrl.searchParams.entries()) {
        if (k === "path") continue;
        // arrays: repeat key
        if (params[k] === undefined) params[k] = v;
        else if (Array.isArray(params[k])) (params[k] as string[]).push(v);
        else params[k] = [params[k] as string, v];
      }
    }

    if (!upstreamPath.startsWith("/")) upstreamPath = "/" + upstreamPath;
    if (!ALLOWED_PATHS.has(upstreamPath)) {
      return json({ error: "path not allowed", path: upstreamPath }, 400);
    }

    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      if (Array.isArray(v)) {
        for (const item of v) if (item !== undefined && item !== null && item !== "") qs.append(k, String(item));
      } else {
        qs.append(k, String(v));
      }
    }

    const upstream = `${BASE.replace(/\/$/, "")}${upstreamPath}${qs.toString() ? `?${qs}` : ""}`;

    const init: RequestInit = {
      method,
      headers: { "X-API-Key": KEY, "Accept": "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    };
    if (body) init.body = JSON.stringify(body);

    const res = await fetch(upstream, init);
    const text = await res.text();

    if (!res.ok) {
      return json({ error: "upstream_error", status: res.status, path: upstreamPath, body: text.slice(0, 800) }, res.status);
    }
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text; }
    return json(data, 200, { "Cache-Control": "private, max-age=60" });
  } catch (e) {
    return json({ error: "proxy_error", detail: (e as Error).message }, 500);
  }
});
