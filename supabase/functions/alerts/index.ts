import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { personUidFromOutsetaJwt } from "../_shared/outseta-jwt.ts";
import { collectFires, type AlertEvalRow } from "../_shared/alert-eval.ts";

const OPS = new Set(["gte", "lte", "crosses_above", "crosses_below"]);

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
      const [{ data: alerts, error: aErr }, { data: events, error: eErr }] = await Promise.all([
        sb.from("alerts").select("*").eq("outseta_person_uid", personUid).order("created_at", { ascending: false }),
        sb
          .from("alert_events")
          .select("*")
          .eq("outseta_person_uid", personUid)
          .order("fired_at", { ascending: false })
          .limit(50),
      ]);
      if (aErr) throw aErr;
      if (eErr) throw eErr;
      return json({ alerts: alerts ?? [], events: events ?? [] });
    }

    if (action === "create") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const indicatorKey = typeof body.indicatorKey === "string" ? body.indicatorKey.trim() : "";
      const operator = String(body.operator ?? "");
      const threshold = Number(body.threshold);
      const cooldown = Number(body.cooldownMinutes ?? 360);
      if (!name) return json({ error: "Name required" }, 400);
      if (!indicatorKey) return json({ error: "indicatorKey required" }, 400);
      if (!OPS.has(operator)) return json({ error: "Invalid operator" }, 400);
      if (!Number.isFinite(threshold)) return json({ error: "Invalid threshold" }, 400);
      const { error } = await sb.from("alerts").insert({
        outseta_person_uid: personUid,
        name,
        indicator_key: indicatorKey,
        operator,
        threshold,
        cooldown_minutes: Number.isFinite(cooldown) ? Math.max(1, Math.floor(cooldown)) : 360,
      });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "setActive") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return json({ error: "id required" }, 400);
      const { error } = await sb
        .from("alerts")
        .update({ active: Boolean(body.active) })
        .eq("id", id)
        .eq("outseta_person_uid", personUid);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "delete") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return json({ error: "id required" }, 400);
      const { error } = await sb.from("alerts").delete().eq("id", id).eq("outseta_person_uid", personUid);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "ack") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return json({ error: "id required" }, 400);
      const { error } = await sb
        .from("alert_events")
        .update({ acknowledged: true })
        .eq("id", id)
        .eq("outseta_person_uid", personUid);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "ackAll") {
      const { error } = await sb
        .from("alert_events")
        .update({ acknowledged: true })
        .eq("outseta_person_uid", personUid)
        .eq("acknowledged", false);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "evaluate") {
      const { data: alerts, error } = await sb
        .from("alerts")
        .select("*")
        .eq("active", true)
        .eq("outseta_person_uid", personUid);
      if (error) throw error;
      const { events, updates } = collectFires((alerts ?? []) as AlertEvalRow[]);
      if (events.length) {
        const { error: insErr } = await sb.from("alert_events").insert(events);
        if (insErr) throw insErr;
      }
      for (const u of updates) {
        await sb
          .from("alerts")
          .update({ last_fired_at: u.last_fired_at, last_value: u.last_value })
          .eq("id", u.id)
          .eq("outseta_person_uid", personUid);
      }
      return json({ evaluated: alerts?.length ?? 0, fired: events.length });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status = /token|person id|Missing|JWS|JWT|signature|claim/i.test(msg) ? 401 : 500;
    return json({ error: msg }, status);
  }
});
