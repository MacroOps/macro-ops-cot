import { corsHeaders } from "../_shared/cors.ts";
import { extractPortfolio, parseCSV, parseStatsCSV } from "../_shared/portfolio-parse.ts";

const SHEET = Deno.env.get("MO_PORTFOLIO_SHEET_ID") ?? "1MfifAOtyX3PVT7-Ilat4cFVQnmfYVtIfE1_bdKc3BZk";
const GID_PUBLIC = Deno.env.get("MO_PORTFOLIO_GID_PUBLIC") ?? "555635575";
const GID_STATS = Deno.env.get("MO_PORTFOLIO_GID_STATS") ?? "1741167923";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "private, max-age=120" },
  });

async function fetchSheetCsv(gid: string): Promise<string> {
  const stamp = Date.now();
  const urls = [
    `https://docs.google.com/spreadsheets/d/${SHEET}/export?format=csv&gid=${gid}&t=${stamp}`,
    `https://docs.google.com/spreadsheets/d/${SHEET}/gviz/tq?tqx=out:csv&gid=${gid}&headers=0&t=${stamp}`,
  ];
  let last = "";
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { Accept: "text/csv,text/plain,*/*" } });
      const text = await r.text();
      last = text.slice(0, 80);
      if (!r.ok) continue;
      if (/^\s*<(!doctype|html)/i.test(text)) continue;
      if (text.trim().length < 8) continue;
      return text;
    } catch {
      /* try next */
    }
  }
  throw new Error(`Could not load sheet gid=${gid}${last ? ` (${last})` : ""}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const [portCsv, statsCsv] = await Promise.all([
      fetchSheetCsv(GID_PUBLIC),
      fetchSheetCsv(GID_STATS).catch(() => ""),
    ]);
    const portfolio = extractPortfolio(parseCSV(portCsv));
    const stats = statsCsv ? parseStatsCSV(statsCsv) : [];
    return json({
      portfolio,
      stats,
      fetchedAt: new Date().toISOString(),
      holdingsCadence: "weekly",
      statsCadence: "daily",
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
