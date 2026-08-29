import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { personUidFromOutsetaJwt } from "../_shared/outseta-jwt.ts";

const SOURCES = new Set(["lab", "copilot", "chart-toolbar"]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const personUid = await personUidFromOutsetaJwt(req);
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const body = req.method === "GET" ? { action: "list" } : await req.json().catch(() => ({}));
    const action = String(body.action ?? "list");

    if (action === "list") {
      const limitRaw = Number(body.limit ?? 200);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, Math.floor(limitRaw)), 500) : 200;
      const { data, error } = await sb
        .from("backtest_runs")
        .select("*")
        .eq("outseta_person_uid", personUid)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return json({ runs: data ?? [] });
    }

    if (action === "save") {
      const source = String(body.source ?? "");
      const indicatorKey = typeof body.indicatorKey === "string" ? body.indicatorKey.trim() : "";
      if (!SOURCES.has(source)) return json({ error: "Invalid source" }, 400);
      if (!indicatorKey) return json({ error: "indicatorKey required" }, 400);
      const params = body.params && typeof body.params === "object" ? body.params : {};
      const stats = body.stats && typeof body.stats === "object" ? body.stats : {};
      const { data, error } = await sb
        .from("backtest_runs")
        .insert({
          outseta_person_uid: personUid,
          source,
          indicator_key: indicatorKey,
          symbol: typeof body.symbol === "string" ? body.symbol : null,
          params,
          stats,
          label: typeof body.label === "string" ? body.label : null,
        })
        .select()
        .single();
      if (error) throw error;
      return json({ run: data });
    }

    if (action === "delete") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return json({ error: "id required" }, 400);
      const { error } = await sb
        .from("backtest_runs")
        .delete()
        .eq("id", id)
        .eq("outseta_person_uid", personUid);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status = /token|person id|Missing|JWS|JWT|signature|claim/i.test(msg) ? 401 : 500;
    return json({ error: msg }, status);
  }
});
