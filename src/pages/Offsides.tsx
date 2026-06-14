import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/hud/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// TODO: Optional ATR-scaling layer — would require a separate daily price feed
// to convert net_contracts into vol-adjusted units. Not in scope: COT data has no prices.

type Norm = "idx" | "z" | "pct";
type Lookback = 52 | 156 | 260;

interface Point {
  d: string;
  net: number;
  idx: number;
  z: number;
  pct: number;
  tier: string;
  side: "long" | "short" | null;
  wks: number;
  regime: string | null;
  sig: "BULLISH" | "BEARISH" | "NEUTRAL";
  n: number;
  src: string;
  lookback: number;
}

interface MarketRow {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  latest: Point | null;
}

const SECTOR_ORDER = [
  "Equities",
  "Rates",
  "FX",
  "Energy",
  "Metals",
  "Agriculture",
  "Crypto",
];

function tierBadge(p: Point) {
  if (p.tier === "extreme_long_strong")
    return (
      <Badge className="bg-destructive/20 text-destructive border-destructive/40">
        EXTREME LONG ●●
      </Badge>
    );
  if (p.tier === "extreme_long")
    return (
      <Badge className="bg-destructive/10 text-destructive border-destructive/30">
        EXTREME LONG
      </Badge>
    );
  if (p.tier === "extreme_short_strong")
    return (
      <Badge className="bg-success/20 text-success border-success/40">
        EXTREME SHORT ●●
      </Badge>
    );
  if (p.tier === "extreme_short")
    return (
      <Badge className="bg-success/10 text-success border-success/30">
        EXTREME SHORT
      </Badge>
    );
  return <Badge variant="secondary">NEUTRAL</Badge>;
}

function signalBadge(p: Point) {
  if (p.sig === "BULLISH")
    return (
      <Badge className="bg-success/10 text-success border-success/30">
        BULLISH (contrarian)
      </Badge>
    );
  if (p.sig === "BEARISH")
    return (
      <Badge className="bg-destructive/10 text-destructive border-destructive/30">
        BEARISH (contrarian)
      </Badge>
    );
  return <Badge variant="secondary">NEUTRAL</Badge>;
}

function regimeBadge(r: string | null) {
  if (!r) return null;
  const color =
    r === "FAILING"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : r === "RESOLVING"
        ? "bg-primary/15 text-primary border-primary/30"
        : "bg-muted text-muted-foreground border-border";
  return <Badge className={color}>{r}</Badge>;
}

// Diverging scale centered at 50: 0=deep green, 50=neutral, 100=deep red.
function heatColor(v: number | null) {
  if (v == null) return "hsl(var(--muted))";
  const dist = Math.abs(v - 50) / 50; // 0..1
  if (v >= 50) {
    // red side
    const a = 0.10 + dist * 0.55;
    return `hsl(var(--destructive) / ${a.toFixed(3)})`;
  }
  // green side
  const a = 0.10 + dist * 0.55;
  return `hsl(var(--success) / ${a.toFixed(3)})`;
}

function fmtNet(n: number) {
  const sign = n > 0 ? "+" : "";
  if (Math.abs(n) >= 1000) return `${sign}${(n / 1000).toFixed(1)}K`;
  return `${sign}${n}`;
}

export default function Offsides() {
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lookback, setLookback] = useState<Lookback>(156);
  const [norm, setNorm] = useState<Norm>("idx");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailSeries, setDetailSeries] = useState<Point[] | null>(null);

  async function loadAll(lb: Lookback) {
    setLoading(true);
    const { data: mkts, error: mErr } = await supabase
      .from("markets")
      .select("id,symbol,name,sector,cftc_code")
      .eq("is_active", true)
      .not("cftc_code", "is", null)
      .order("sector")
      .order("symbol");

    if (mErr || !mkts) {
      toast.error(mErr?.message ?? "Failed to load markets");
      setLoading(false);
      return;
    }

    // Fan out RPCs in parallel. Take the last point of each series as "latest".
    const results = await Promise.all(
      mkts.map(async (m) => {
        const { data, error } = await (supabase as any).rpc("get_cot_normalized", {
          p_market_id: m.id,
          p_lookback: lb,
        });
        if (error) return { ...m, latest: null } as MarketRow;
        const series = (data ?? []) as Point[];
        const latest = series.length ? series[series.length - 1] : null;
        return {
          id: m.id,
          symbol: m.symbol,
          name: m.name,
          sector: m.sector,
          latest,
        } as MarketRow;
      }),
    );
    setMarkets(results);
    if (!selectedId && results.length) {
      const firstWithData = results.find((r) => r.latest);
      if (firstWithData) setSelectedId(firstWithData.id);
    }
    setLoading(false);
  }

  async function loadDetail(id: string, lb: Lookback) {
    setDetailSeries(null);
    const { data, error } = await (supabase as any).rpc("get_cot_normalized", {
      p_market_id: id,
      p_lookback: lb,
    });
    if (error) {
      toast.error(error.message);
      setDetailSeries([]);
      return;
    }
    setDetailSeries((data ?? []) as Point[]);
  }

  useEffect(() => {
    loadAll(lookback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookback]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId, lookback);
  }, [selectedId, lookback]);

  async function runRefresh() {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ingest-cftc", {
        body: { years: 1 },
      });
      if (error) throw error;
      toast.success(`COT refresh: ${(data as any)?.rows_written ?? 0} rows`);
      await loadAll(lookback);
      if (selectedId) await loadDetail(selectedId, lookback);
    } catch (e: any) {
      toast.error(e?.message ?? "refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  const extremes = useMemo(
    () =>
      markets
        .filter((m) => m.latest && (m.latest.idx >= 90 || m.latest.idx <= 10))
        .sort((a, b) => {
          // most extreme first (distance from 50)
          const da = Math.abs(50 - (a.latest?.idx ?? 50));
          const db = Math.abs(50 - (b.latest?.idx ?? 50));
          return db - da;
        }),
    [markets],
  );

  const grouped = useMemo(() => {
    const m = new Map<string, MarketRow[]>();
    for (const r of markets) {
      const arr = m.get(r.sector) ?? [];
      arr.push(r);
      m.set(r.sector, arr);
    }
    return SECTOR_ORDER.filter((s) => m.has(s)).map(
      (s) => [s, m.get(s)!] as [string, MarketRow[]],
    );
  }, [markets]);

  const asOf = useMemo(() => {
    const dates = markets
      .map((m) => m.latest?.d)
      .filter((d): d is string => !!d)
      .sort();
    return dates.length ? dates[dates.length - 1] : null;
  }, [markets]);

  const selected = markets.find((m) => m.id === selectedId) ?? null;

  return (
    <AppShell title="Offsides — COT Extremes">
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Offsides — COT Extremes
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
              Contrarian read on Leveraged Funds / Managed Money positioning. Extreme
              long → bearish lean; extreme short → bullish lean.
              <span className="ml-1 text-xs">
                Data is weekly (CFTC publishes Fridays 3:30pm ET, as-of the prior
                Tuesday — ~3 day lag).
              </span>
            </p>
            {asOf && (
              <p className="text-xs text-muted-foreground mt-1">
                As of report date{" "}
                <span className="font-mono text-foreground">{asOf}</span> ·{" "}
                lookback {lookback}w
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={String(lookback)}
              onValueChange={(v) => setLookback(Number(v) as Lookback)}
            >
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="52">52w lookback</SelectItem>
                <SelectItem value="156">156w lookback</SelectItem>
                <SelectItem value="260">260w lookback</SelectItem>
              </SelectContent>
            </Select>
            <Select value={norm} onValueChange={(v) => setNorm(v as Norm)}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="idx">COT Index (0–100)</SelectItem>
                <SelectItem value="z">Z-score</SelectItem>
                <SelectItem value="pct">Percentile rank</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={runRefresh} disabled={refreshing} size="sm">
              {refreshing ? "Refreshing…" : "Refresh COT data"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="extremes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="extremes">
              Current Extremes ({extremes.length})
            </TabsTrigger>
            <TabsTrigger value="heatmap">Cross-Asset Heatmap</TabsTrigger>
            <TabsTrigger value="detail">Per-Market Detail</TabsTrigger>
          </TabsList>

          {/* === EXTREMES TABLE === */}
          <TabsContent value="extremes">
            <Card className="overflow-hidden">
              <div className="px-4 py-2 border-b bg-muted/30 text-xs uppercase tracking-wider font-semibold flex justify-between">
                <span>Markets with COT Index ≥ 90 or ≤ 10</span>
                {asOf && (
                  <span className="text-muted-foreground normal-case font-normal">
                    as of {asOf}
                  </span>
                )}
              </div>
              {loading ? (
                <div className="p-6 text-sm text-muted-foreground">Loading…</div>
              ) : extremes.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  No markets currently in extreme territory.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground">
                      <tr className="border-b">
                        <th className="text-left px-4 py-2">Market</th>
                        <th className="text-left px-4 py-2">Asset Class</th>
                        <th className="text-right px-4 py-2">COT Index</th>
                        <th className="text-right px-4 py-2">Z</th>
                        <th className="text-right px-4 py-2">%ile</th>
                        <th className="text-left px-4 py-2">Tier</th>
                        <th className="text-left px-4 py-2">Signal</th>
                        <th className="text-left px-4 py-2">Regime</th>
                        <th className="text-right px-4 py-2">Wks in Extreme</th>
                        <th className="text-right px-4 py-2">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extremes.map((m) => {
                        const p = m.latest!;
                        return (
                          <tr
                            key={m.id}
                            onClick={() => setSelectedId(m.id)}
                            className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                          >
                            <td className="px-4 py-2">
                              <div className="font-mono font-semibold">{m.symbol}</div>
                              <div className="text-xs text-muted-foreground">
                                {m.name}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {m.sector}
                            </td>
                            <td className="px-4 py-2 text-right font-mono font-semibold">
                              {p.idx.toFixed(1)}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-xs">
                              {p.z.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-xs">
                              {p.pct.toFixed(0)}
                            </td>
                            <td className="px-4 py-2">{tierBadge(p)}</td>
                            <td className="px-4 py-2">{signalBadge(p)}</td>
                            <td className="px-4 py-2">{regimeBadge(p.regime)}</td>
                            <td className="px-4 py-2 text-right font-mono">{p.wks}</td>
                            <td className="px-4 py-2 text-right font-mono text-xs">
                              {fmtNet(p.net)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* === HEATMAP === */}
          <TabsContent value="heatmap">
            <div className="space-y-4">
              <Card className="p-3 text-xs text-muted-foreground flex items-center gap-4">
                <span>Diverging scale, centered at 50:</span>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4" style={{ background: heatColor(0) }} />
                  <span>0 (short)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 border" style={{ background: heatColor(50) }} />
                  <span>50</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4" style={{ background: heatColor(100) }} />
                  <span>100 (long)</span>
                </div>
              </Card>
              {loading ? (
                <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>
              ) : (
                grouped.map(([sector, items]) => (
                  <Card key={sector} className="overflow-hidden">
                    <div className="px-4 py-2 border-b bg-muted/30 text-xs uppercase tracking-wider font-semibold">
                      {sector}
                    </div>
                    <div className="p-3 grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {items.map((m) => {
                        const v = m.latest?.idx ?? null;
                        const isExtreme = v != null && (v >= 90 || v <= 10);
                        return (
                          <button
                            key={m.id}
                            onClick={() => setSelectedId(m.id)}
                            className={`text-left p-2 rounded border transition hover:ring-2 hover:ring-primary/40 ${
                              isExtreme ? "border-foreground/40" : "border-border"
                            }`}
                            style={{ background: heatColor(v) }}
                          >
                            <div className="font-mono text-xs font-semibold">
                              {m.symbol}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {m.name}
                            </div>
                            <div className="mt-1 font-mono text-lg font-semibold">
                              {v == null ? "—" : v.toFixed(0)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* === DETAIL === */}
          <TabsContent value="detail">
            <Card className="p-4 space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Market
                  </div>
                  <Select
                    value={selectedId ?? ""}
                    onValueChange={(v) => setSelectedId(v)}
                  >
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="Select a market" />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTOR_ORDER.flatMap((s) =>
                        markets
                          .filter((m) => m.sector === s)
                          .map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.symbol} — {m.name}
                            </SelectItem>
                          )),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {selected?.latest && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <div className="text-xs text-muted-foreground">
                      as of{" "}
                      <span className="font-mono text-foreground">
                        {selected.latest.d}
                      </span>
                    </div>
                    <span className="font-mono text-lg font-semibold">
                      {selected.latest.idx.toFixed(1)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      %ile {selected.latest.pct.toFixed(0)} · z{" "}
                      {selected.latest.z.toFixed(2)}
                    </span>
                    {tierBadge(selected.latest)}
                    {signalBadge(selected.latest)}
                    {regimeBadge(selected.latest.regime)}
                    {selected.latest.wks > 0 && (
                      <Badge variant="outline">
                        {selected.latest.wks}w in extreme
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {!detailSeries ? (
                <div className="h-[380px] flex items-center justify-center text-sm text-muted-foreground">
                  Loading…
                </div>
              ) : detailSeries.length === 0 ? (
                <div className="h-[380px] flex items-center justify-center text-sm text-muted-foreground">
                  No COT data available for this market.
                </div>
              ) : (
                <>
                  {/* Net position area */}
                  <div className="h-[220px]">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                      Net Position (Leveraged Funds / Managed Money)
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={detailSeries}>
                        <CartesianGrid
                          strokeDasharray="2 2"
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          dataKey="d"
                          tick={{ fontSize: 10 }}
                          stroke="hsl(var(--muted-foreground))"
                          minTickGap={40}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          stroke="hsl(var(--muted-foreground))"
                          tickFormatter={fmtNet}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            fontSize: 12,
                          }}
                          formatter={(v: number, n: string) =>
                            n === "net" ? [fmtNet(v), "Net"] : [v, n]
                          }
                        />
                        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                        <Area
                          type="monotone"
                          dataKey="net"
                          stroke="hsl(var(--primary))"
                          fill="hsl(var(--primary) / 0.15)"
                          strokeWidth={1.5}
                          isAnimationActive={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Normalized index with extreme bands */}
                  <div className="h-[260px]">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                      {norm === "idx"
                        ? "COT Index (0–100) with 90/10 and 95/5 bands"
                        : norm === "z"
                          ? "Rolling Z-Score"
                          : "Rolling Percentile Rank"}
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={detailSeries}>
                        <CartesianGrid
                          strokeDasharray="2 2"
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          dataKey="d"
                          tick={{ fontSize: 10 }}
                          stroke="hsl(var(--muted-foreground))"
                          minTickGap={40}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          stroke="hsl(var(--muted-foreground))"
                          domain={
                            norm === "z" ? [-4, 4] : [0, 100]
                          }
                        />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            fontSize: 12,
                          }}
                        />
                        {norm !== "z" && (
                          <>
                            <ReferenceArea
                              y1={95}
                              y2={100}
                              fill="hsl(var(--destructive) / 0.18)"
                              stroke="none"
                            />
                            <ReferenceArea
                              y1={90}
                              y2={95}
                              fill="hsl(var(--destructive) / 0.08)"
                              stroke="none"
                            />
                            <ReferenceArea
                              y1={5}
                              y2={10}
                              fill="hsl(var(--success) / 0.08)"
                              stroke="none"
                            />
                            <ReferenceArea
                              y1={0}
                              y2={5}
                              fill="hsl(var(--success) / 0.18)"
                              stroke="none"
                            />
                            <ReferenceLine y={50} stroke="hsl(var(--muted-foreground))" />
                          </>
                        )}
                        {norm === "z" && (
                          <>
                            <ReferenceArea
                              y1={2}
                              y2={4}
                              fill="hsl(var(--destructive) / 0.12)"
                              stroke="none"
                            />
                            <ReferenceArea
                              y1={-4}
                              y2={-2}
                              fill="hsl(var(--success) / 0.12)"
                              stroke="none"
                            />
                            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                          </>
                        )}
                        <Line
                          type="monotone"
                          dataKey={norm}
                          stroke="hsl(var(--foreground))"
                          strokeWidth={1.5}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
