import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { personUidFromOutsetaJwt } from "../_shared/outseta-jwt.ts";

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
    const marketId = typeof body.marketId === "string" ? body.marketId : "";

    if (action === "list") {
      const { data, error } = await sb
        .from("watchlist")
        .select("market_id")
        .eq("outseta_person_uid", personUid);
      if (error) throw error;
      return json({ marketIds: (data ?? []).map((r) => r.market_id) });
    }

    if (action === "add") {
      if (!marketId) return json({ error: "marketId required" }, 400);
      const { error } = await sb.from("watchlist").insert({
        outseta_person_uid: personUid,
        market_id: marketId,
      });
      if (error && error.code !== "23505") throw error;
      return json({ ok: true });
    }

    if (action === "remove") {
      if (!marketId) return json({ error: "marketId required" }, 400);
      const { error } = await sb
        .from("watchlist")
        .delete()
        .eq("outseta_person_uid", personUid)
        .eq("market_id", marketId);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status = /token|person id|Missing/i.test(msg) ? 401 : 500;
    return json({ error: msg }, status);
  }
});
