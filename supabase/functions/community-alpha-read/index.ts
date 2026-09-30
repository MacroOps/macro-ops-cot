// Community Alpha: Collective members (live) or staff (live + staging).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { claimsFromOutsetaJwt, isCollectivePlanUid, isStaffPlanUid } from "../_shared/outseta-jwt.ts";
import { parseMode, tableFor, toDays } from "./shape.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let staff = false;
  try {
    const { planUid } = await claimsFromOutsetaJwt(req);
    staff = isStaffPlanUid(planUid);
    if (!isCollectivePlanUid(planUid) && !staff) {
      return json({ error: "Collective membership required" }, 403);
    }
  } catch {
    return json({ error: "Sign in required" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const mode = parseMode((body as Record<string, unknown>)?.mode);
  if (!mode) return json({ error: "mode must be 'live' or 'staging'" }, 400);
  if (mode === "staging" && !staff) return json({ error: "Staging is staff-only" }, 403);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await sb
    .from(tableFor(mode))
    .select("week_date, window_start, window_end, run_at, channels_scanned, team_excluded_count, tactical_excluded_count, ideas")
    .order("week_date", { ascending: false });
  if (error) {
    console.error("community-alpha-read", error.message);
    return json({ error: "Could not load weeks" }, 500);
  }
  return json({ mode, ...toDays(data ?? []) });
});
