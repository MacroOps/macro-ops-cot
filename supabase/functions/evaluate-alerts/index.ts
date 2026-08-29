import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { collectFires, type AlertEvalRow } from "../_shared/alert-eval.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const { data: alerts, error } = await supabase.from("alerts").select("*").eq("active", true);
    if (error) throw error;

    const { events, updates } = collectFires((alerts ?? []) as AlertEvalRow[]);

    if (events.length) {
      const { error: insErr } = await supabase.from("alert_events").insert(events);
      if (insErr) throw insErr;
    }
    for (const u of updates) {
      await supabase
        .from("alerts")
        .update({ last_fired_at: u.last_fired_at, last_value: u.last_value })
        .eq("id", u.id);
    }

    return json({ evaluated: alerts?.length ?? 0, fired: events.length });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
