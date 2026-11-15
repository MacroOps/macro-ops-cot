import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  Tooltip,
  XAxis,
  YAxis, Customized,
} from "recharts";
import { HudCrosshairCursor, HudCrosshairOverlay } from "@/components/charts/HudChartPrimitives";
import { ChartExportButton } from "@/components/charts/ChartExportButton";
import { ResponsiveContainer } from "@/components/charts/ResponsiveContainer";

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

function asPoints(data: unknown): Point[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const r = row as Record<string, unknown>;
    if (typeof r.d !== "string" || typeof r.net !== "number") return [];
    return [r as unknown as Point];
  });
}

function rowsWritten(data: unknown): number {
  if (!data || typeof data !== "object") return 0;
  const rows = (data as Record<string, unknown>).rows_written;
  return typeof rows === "number" ? rows : 0;
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
        const { data, error } = await supabase.rpc("get_cot_normalized", {
          p_market_id: m.id,
          p_lookback: lb,
        });
        if (error) return { ...m, latest: null } as MarketRow;
        const series = asPoints(data);
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
    const { data, error } = await supabase.rpc("get_cot_normalized", {
      p_market_id: id,
      p_lookback: lb,
    });
    if (error) {
      toast.error(error.message);
      setDetailSeries([]);
      return;
    }
    setDetailSeries(asPoints(data));
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
      toast.success(`COT refresh: ${rowsWritten(data)} rows`);
      await loadAll(lookback);
      if (selectedId) await loadDetail(selectedId, lookback);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "refresh failed");
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
      <PageHeader
        eyebrow="Positioning"
        title="Offsides — COT Extremes"
        description="Contrarian read on Leveraged Funds / Managed Money positioning. Extreme long → bearish lean; extreme short → bullish lean. Data is weekly (CFTC publishes Fridays 3:30pm ET, as-of the prior Tuesday — ~3 day lag)."
        actions={
          <Button onClick={runRefresh} disabled={refreshing} size="sm">
            {refreshing ? "Refreshing…" : "Refresh COT data"}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border">
        <span className="hud-label mr-1">Lookback</span>
        <Select
          value={String(lookback)}
          onValueChange={(v) => setLookback(Number(v) as Lookback)}
        >
          <SelectTrigger className="w-[130px] h-7 rounded-sm text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="52">52w lookback</SelectItem>
            <SelectItem value="156">156w lookback</SelectItem>
            <SelectItem value="260">260w lookback</SelectItem>
          </SelectContent>
        </Select>
        <span className="hud-label ml-2 mr-1">Scale</span>
        <Select value={norm} onValueChange={(v) => setNorm(v as Norm)}>
          <SelectTrigger className="w-[150px] h-7 rounded-sm text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="idx">COT Index (0–100)</SelectItem>
            <SelectItem value="z">Z-score</SelectItem>
            <SelectItem value="pct">Percentile rank</SelectItem>
          </SelectContent>
        </Select>
        {asOf && (
          <span className="ml-auto text-[10px] tracking-wider text-muted-foreground">
            As of report date <span className="text-surface-foreground">{asOf}</span> · lookback {lookback}w
          </span>
        )}
      </div>

      <div className="p-3">
        <Tabs defaultValue="extremes" className="space-y-3">
          <TabsList>
            <TabsTrigger value="extremes">
              Current Extremes ({extremes.length})
            </TabsTrigger>
            <TabsTrigger value="heatmap">Cross-Asset Heatmap</TabsTrigger>
            <TabsTrigger value="detail">Per-Market Detail</TabsTrigger>
          </TabsList>

          {/* === EXTREMES TABLE === */}
          <TabsContent value="extremes">
            <div className="hud-panel overflow-hidden">
              <div className="px-3 py-2 border-b border-border flex justify-between">
                <span className="hud-label">Markets with COT Index ≥ 90 or ≤ 10</span>
                {asOf && (
                  <span className="text-[10px] tracking-wider text-muted-foreground">
                    as of {asOf}
                  </span>
                )}
              </div>
              {loading ? (
                <div className="p-3 space-y-1">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-7 w-full" />
                  ))}
                </div>
              ) : extremes.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground">
                  No markets currently in extreme territory.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs tabular-nums">
                    <thead className="bg-surface/40 border-b border-border">
                      <tr>
                        <Th>Market</Th>
                        <Th>Asset Class</Th>
                        <Th className="text-right">COT Index</Th>
                        <Th className="text-right">Z</Th>
                        <Th className="text-right">%ile</Th>
                        <Th>Tier</Th>
                        <Th>Signal</Th>
                        <Th>Regime</Th>
                        <Th className="text-right">Wks in Extreme</Th>
                        <Th className="text-right">Net</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {extremes.map((m) => {
                        const p = m.latest!;
                        return (
                          <tr
                            key={m.id}
                            onClick={() => setSelectedId(m.id)}
                            className="border-b border-border/60 last:border-0 hover:bg-surface/40 cursor-pointer transition-colors"
                          >
                            <td className="px-3 py-2">
                              <div className="text-[12px] font-semibold text-surface-foreground">{m.symbol}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {m.name}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <span className="hud-label">{m.sector}</span>
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-surface-foreground">
                              {p.idx.toFixed(1)}
                            </td>
                            <td className="px-3 py-2 text-right">{p.z.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">{p.pct.toFixed(0)}</td>
                            <td className="px-3 py-2">{tierBadge(p)}</td>
                            <td className="px-3 py-2">{signalBadge(p)}</td>
                            <td className="px-3 py-2">{regimeBadge(p.regime)}</td>
                            <td className="px-3 py-2 text-right">{p.wks}</td>
                            <td className="px-3 py-2 text-right">{fmtNet(p.net)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* === HEATMAP === */}
          <TabsContent value="heatmap">
            <div className="space-y-3">
              <div className="hud-panel px-3 py-2 text-xs text-muted-foreground flex items-center gap-4">
                <span className="hud-label">Diverging scale, centered at 50</span>
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
              </div>
              {loading ? (
                <div className="hud-panel p-3 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                grouped.map(([sector, items]) => (
                  <div key={sector} className="hud-panel overflow-hidden">
                    <div className="px-3 py-2 border-b border-border hud-label">
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
                            className={`text-left p-2 rounded-sm border transition-colors hover:border-primary ${
                              isExtreme ? "border-foreground/40" : "border-border"
                            }`}
                            style={{ background: heatColor(v) }}
                          >
                            <div className="text-[12px] font-semibold text-surface-foreground">
                              {m.symbol}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {m.name}
                            </div>
                            <div className="mt-1 text-lg font-semibold tabular-nums text-surface-foreground">
                              {v == null ? "—" : v.toFixed(0)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* === DETAIL === */}
          <TabsContent value="detail">
            <div className="hud-panel p-3 space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="hud-label mb-1">Market</div>
                  <Select
                    value={selectedId ?? ""}
                    onValueChange={(v) => setSelectedId(v)}
                  >
                    <SelectTrigger className="w-[280px] h-7 rounded-sm text-xs">
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
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="text-[10px] tracking-wider text-muted-foreground">
                      as of{" "}
                      <span className="text-surface-foreground">
                        {selected.latest.d}
                      </span>
                    </div>
                    <span className="text-lg font-semibold tabular-nums text-surface-foreground">
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
                <div className="h-[380px] flex items-center justify-center text-xs text-muted-foreground">
                  Loading…
                </div>
              ) : detailSeries.length === 0 ? (
                <div className="h-[380px] flex items-center justify-center text-xs text-muted-foreground">
                  No COT data available for this market.
                </div>
              ) : (
                <>
                  {/* Net position area */}
                  <div className="h-[220px] flex flex-col" data-chart-export="">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="hud-label">
                        Net Position (Leveraged Funds / Managed Money)
                      </span>
                      <ChartExportButton compact title={`${selected?.symbol ?? "COT"} net position`} />
                    </div>
                    <div className="flex-1 min-h-0" data-chart-body="">
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
                        <Tooltip cursor={false}
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            fontSize: 12,
                          }}
                          formatter={(v: number, n: string) =>
                            n === "net" ? [fmtNet(v), "Net"] : [v, n]
                          }
                        />
                        <Customized component={HudCrosshairOverlay} />
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
                  </div>

                  {/* Normalized index with extreme bands */}
                  <div className="h-[260px] flex flex-col" data-chart-export="">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="hud-label">
                        {norm === "idx"
                          ? "COT Index (0–100) with 90/10 and 95/5 bands"
                          : norm === "z"
                            ? "Rolling Z-Score"
                            : "Rolling Percentile Rank"}
                      </span>
                      <ChartExportButton
                        compact
                        title={`${selected?.symbol ?? "COT"} ${norm === "idx" ? "cot index" : norm === "z" ? "z-score" : "percentile rank"}`}
                      />
                    </div>
                    <div className="flex-1 min-h-0" data-chart-body="">
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
                        <Tooltip cursor={false}
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            fontSize: 12,
                          }}
                        />
                        <Customized component={HudCrosshairOverlay} />
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
                  </div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("px-3 py-2 text-left hud-label font-medium", className)}>{children}</th>;
}
