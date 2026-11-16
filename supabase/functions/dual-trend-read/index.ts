// Dual Trend saved data reader: Turning Point, Collective or Team Plan only.
// The four dual_trend_* tables are service-role only; pages read through here.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { corsHeaders } from "../_shared/cors.ts";
import { claimsFromOutsetaJwt, isCollectivePlanUid, isStaffPlanUid, isTurningPointPlanUid } from "../_shared/outseta-jwt.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("days") }),
  z.object({ op: z.literal("members"), asOf: date, universes: z.array(z.string().min(1).max(64)).min(1).max(64) }),
  z.object({ op: z.literal("signals"), asOf: date }),
  z.object({ op: z.literal("returns"), from: date, asOf: date, symbols: z.array(z.string().min(1).max(32)).min(1).max(200) }),
]);

// deno-lint-ignore no-explicit-any
async function readAll(q: (a: number, b: number) => PromiseLike<{ data: any[] | null; error: any }>) {
  const out: unknown[] = [];
  for (let a = 0; ; a += 1000) {
    const { data, error } = await q(a, a + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { planUid } = await claimsFromOutsetaJwt(req);
    if (!isTurningPointPlanUid(planUid) && !isCollectivePlanUid(planUid) && !isStaffPlanUid(planUid)) {
      return json({ error: "Turning Point or Collective membership required" }, 403);
    }
  } catch {
    return json({ error: "Sign in required" }, 401);
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid request" }, 400);
  const b = parsed.data;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    if (b.op === "days") {
      const { data, error } = await sb.from("dual_trend_signal_days").select("as_of,kind").order("as_of", { ascending: false }).limit(60);
      if (error) throw error;
      return json({ rows: data ?? [] });
    }
    if (b.op === "members") {
      return json({ rows: await readAll((x, y) => sb.from("dual_trend_members").select("universe,symbol,name,sub_group")
        .eq("as_of", b.asOf).in("universe", b.universes).order("universe").order("symbol").range(x, y)) });
    }
    if (b.op === "signals") {
      return json({ rows: await readAll((x, y) => sb.from("dual_trend_signals").select("symbol,vals")
        .eq("as_of", b.asOf).order("symbol").range(x, y)) });
    }
    return json({ rows: await readAll((x, y) => sb.from("dual_trend_returns").select("symbol,start_date,as_of,ret,net")
      .in("symbol", b.symbols).gte("as_of", b.from).lte("as_of", b.asOf).order("symbol").order("as_of").range(x, y)) });
  } catch (e) {
    console.error("dual-trend-read", (e as Error)?.message);
    return json({ error: "Could not load Dual Trend data" }, 500);
  }
});
