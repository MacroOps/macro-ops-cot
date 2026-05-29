import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/hud/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Row {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  open_interest: number | null;
  volume: number | null;
  oi_change: number | null;
  observed_on: string | null;
  oi_pct_52w: number | null;
}

function pct(x: number | null) {
  return x == null ? "—" : `${x.toFixed(0)}%`;
}
function num(x: number | null) {
  if (x == null) return "—";
  if (x >= 1e6) return `${(x / 1e6).toFixed(2)}M`;
  if (x >= 1e3) return `${(x / 1e3).toFixed(1)}K`;
  return String(x);
}

export default function EurexPositioning() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);

  async function load() {
    setLoading(true);
    const { data: markets } = await supabase
      .from("markets")
      .select("id,symbol,name,sector")
      .eq("exchange", "Eurex")
      .eq("is_active", true)
      .order("symbol");
    if (!markets) {
      setRows([]);
      setLoading(false);
      return;
    }
    const ids = markets.map((m) => m.id);
    const { data: hist } = await supabase
      .from("eurex_oi_history")
      .select("market_id,open_interest,volume,oi_change,observed_on")
      .in("market_id", ids)
      .order("observed_on", { ascending: false });

    const latestByMarket = new Map<string, any>();
    const seriesByMarket = new Map<string, number[]>();
    for (const h of hist ?? []) {
      if (!latestByMarket.has(h.market_id)) latestByMarket.set(h.market_id, h);
      const arr = seriesByMarket.get(h.market_id) ?? [];
      if (h.open_interest != null) arr.push(Number(h.open_interest));
      seriesByMarket.set(h.market_id, arr);
    }

    const out: Row[] = markets.map((m) => {
      const last = latestByMarket.get(m.id);
      const series = (seriesByMarket.get(m.id) ?? []).slice(0, 260); // ~52w
      let pctile: number | null = null;
      if (last?.open_interest != null && series.length > 5) {
        const v = Number(last.open_interest);
        const below = series.filter((s) => s <= v).length;
        pctile = (below / series.length) * 100;
      }
      return {
        id: m.id,
        symbol: m.symbol,
        name: m.name,
        sector: m.sector,
        open_interest: last?.open_interest ?? null,
        volume: last?.volume ?? null,
        oi_change: last?.oi_change ?? null,
        observed_on: last?.observed_on ?? null,
        oi_pct_52w: pctile,
      };
    });
    setRows(out);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function runIngest() {
    setIngesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("ingest-eurex", {
        body: {},
      });
      if (error) throw error;
      toast.success(`Eurex snapshot: ${(data as any)?.rows_written ?? 0} rows`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "ingest failed");
    } finally {
      setIngesting(false);
    }
  }

  const grouped = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of rows) {
      const arr = m.get(r.sector) ?? [];
      arr.push(r);
      m.set(r.sector, arr);
    }
    return Array.from(m.entries());
  }, [rows]);

  return (
    <AppShell>
      <div className="space-y-6 p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Eurex Positioning</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Daily open interest and volume snapshots for the most liquid Eurex futures.
              Eurex does not publish a CoT-style trader-category breakdown, so we accumulate
              OI / volume history daily and rank by 52-week percentile.
            </p>
          </div>
          <Button onClick={runIngest} disabled={ingesting} size="sm">
            {ingesting ? "Running…" : "Run snapshot"}
          </Button>
        </div>

        {loading ? (
          <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>
        ) : (
          grouped.map(([sector, items]) => (
            <Card key={sector} className="overflow-hidden">
              <div className="px-4 py-2 border-b bg-muted/30 text-xs uppercase tracking-wider font-semibold">
                {sector}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr className="border-b">
                      <th className="text-left px-4 py-2">Symbol</th>
                      <th className="text-left px-4 py-2">Name</th>
                      <th className="text-right px-4 py-2">Open Interest</th>
                      <th className="text-right px-4 py-2">Δ OI</th>
                      <th className="text-right px-4 py-2">OI 52w %ile</th>
                      <th className="text-right px-4 py-2">Volume</th>
                      <th className="text-right px-4 py-2">As of</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2 font-mono font-semibold">{r.symbol}</td>
                        <td className="px-4 py-2 text-muted-foreground">{r.name}</td>
                        <td className="px-4 py-2 text-right font-mono">{num(r.open_interest)}</td>
                        <td
                          className={`px-4 py-2 text-right font-mono ${
                            r.oi_change == null
                              ? ""
                              : r.oi_change > 0
                                ? "text-success"
                                : r.oi_change < 0
                                  ? "text-destructive"
                                  : ""
                          }`}
                        >
                          {r.oi_change == null
                            ? "—"
                            : `${r.oi_change > 0 ? "+" : ""}${num(r.oi_change)}`}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {r.oi_pct_52w != null && (
                            <Badge
                              variant={
                                r.oi_pct_52w >= 80
                                  ? "default"
                                  : r.oi_pct_52w <= 20
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {pct(r.oi_pct_52w)}
                            </Badge>
                          )}
                          {r.oi_pct_52w == null && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">{num(r.volume)}</td>
                        <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                          {r.observed_on ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))
        )}

        {!loading && rows.every((r) => r.open_interest == null) && (
          <Card className="p-4 text-xs text-muted-foreground">
            No snapshots yet. Click <span className="font-semibold">Run snapshot</span> to
            pull today's open interest and volume from the upstream feed. Re-run daily to
            build history and unlock 52-week percentile ranking.
          </Card>
        )}
      </div>
    </AppShell>
  );
}
