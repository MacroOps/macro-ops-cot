import { useMemo, useState } from "react";
import { ChevronDown, Download, Search } from "lucide-react";
import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { SignalBadge, LevelBar, DeltaCell } from "@/components/hud/SignalBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DUAL_TREND_UNIVERSES, type DualTrendStock } from "@/lib/turningPointSpecs";

function exportCsv(rows: DualTrendStock[], filename: string) {
  const headers = [
    "Symbol", "Name", "ETF", "Category",
    "LT Trend", "LT Relative", "LT Signal", "LT Days", "LT Return %", "LT Net %",
  ];
  const body = rows.map((r) => [
    r.symbol, r.name, r.etf, r.category,
    r.ltTrend, r.ltRelative, r.ltSignal, r.ltDays, r.ltReturn, r.ltNet,
  ].join(","));
  const csv = [headers.join(","), ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function StockRow({ s }: { s: DualTrendStock }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        className="border-t border-border/50 cursor-pointer hover:bg-muted/30"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="py-1.5 pl-2">
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </td>
        <td className="py-1.5 font-mono font-medium">{s.symbol}</td>
        <td className="py-1.5 truncate max-w-[180px]">{s.name}</td>
        <td className="py-1.5 font-mono text-[10px] text-muted-foreground">{s.etf}</td>
        <td className="py-1.5 text-[10px] text-muted-foreground">{s.category}</td>
        <td className="py-1.5"><LevelBar value={s.ltTrend} /></td>
        <td className="py-1.5"><LevelBar value={s.ltRelative} /></td>
        <td className="py-1.5"><SignalBadge value={s.ltSignal} /></td>
        <td className="py-1.5 text-right font-mono tabular-nums">{s.ltDays}</td>
        <td className={cn("py-1.5 text-right font-mono tabular-nums", s.ltReturn >= 0 ? "text-success" : "text-destructive")}>
          {s.ltReturn > 0 ? "+" : ""}{s.ltReturn}%
        </td>
        <td className={cn("py-1.5 text-right font-mono tabular-nums pr-2", s.ltNet >= 0 ? "text-success" : "text-destructive")}>
          {s.ltNet > 0 ? "+" : ""}{s.ltNet}%
        </td>
      </tr>
      {open && (
        <tr className="bg-muted/20 border-t border-border/50">
          <td colSpan={11} className="p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(["Short-Term", "Long-Term"] as const).map((label) => {
                const isST = label === "Short-Term";
                const sig = isST ? s.stSignal : s.ltSignal;
                const data = {
                  trend: isST ? s.stTrend : s.ltTrend,
                  rel: isST ? s.stRelative : s.ltRelative,
                  days: isST ? s.stDays : s.ltDays,
                  date: isST ? s.stSignalDate : s.ltSignalDate,
                  ret: isST ? s.stReturn : s.ltReturn,
                  net: isST ? s.stNet : s.ltNet,
                };
                return (
                  <div key={label} className={cn(
                    "rounded-sm border p-3",
                    sig === "BULLISH" ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5",
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
                      <SignalBadge value={sig} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div className="text-muted-foreground">Trend Level</div>
                      <div className="text-right font-mono tabular-nums">{data.trend}</div>
                      <div className="text-muted-foreground">Relative Level</div>
                      <div className="text-right font-mono tabular-nums">{data.rel}</div>
                      <div className="text-muted-foreground">Days in Signal</div>
                      <div className="text-right font-mono tabular-nums">{data.days}</div>
                      <div className="text-muted-foreground">Signal Date</div>
                      <div className="text-right font-mono tabular-nums">{data.date}</div>
                      <div className="text-muted-foreground">Return</div>
                      <div className={cn("text-right font-mono tabular-nums", data.ret >= 0 ? "text-success" : "text-destructive")}>
                        {data.ret > 0 ? "+" : ""}{data.ret}%
                      </div>
                      <div className="text-muted-foreground">Net Return</div>
                      <div className={cn("text-right font-mono tabular-nums", data.net >= 0 ? "text-success" : "text-destructive")}>
                        {data.net > 0 ? "+" : ""}{data.net}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function DualTrendPage({ slug }: { slug: string }) {
  const u = DUAL_TREND_UNIVERSES[slug];
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () =>
      u.stocks.filter(
        (s) =>
          s.symbol.toLowerCase().includes(q.toLowerCase()) ||
          s.name.toLowerCase().includes(q.toLowerCase()),
      ),
    [u, q],
  );

  return (
    <AppShell title={`TPMR · ${u.title}`}>
      <PageHeader eyebrow="TurningPoint · Dual Trend" title={u.title} description={u.description} />

      <div className="p-3">
        {slug === "sp500" ? (
          <SectorOverviewTable />
        ) : (
        <div className="hud-panel">
          <div className="px-3 py-2 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-surface-foreground">
            Sector Overview Summary
          </div>
          <div className="p-3 overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead className="text-[9px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left py-1 font-medium">ETF</th>
                  <th className="text-right py-1 font-medium">Total</th>
                  <th className="text-right py-1 font-medium"># Bullish LT</th>
                  <th className="text-right py-1 font-medium">% Bullish LT</th>
                  <th className="text-right py-1 font-medium">5-Day Chg</th>
                  <th className="text-right py-1 font-medium"># Bearish LT</th>
                  <th className="text-right py-1 font-medium">% Bearish LT</th>
                </tr>
              </thead>
              <tbody>
                {u.summary.map((r) => (
                  <tr key={r.etf} className="border-t border-border/50">
                    <td className="py-1.5">{r.etf}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{r.total}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums text-success">{r.bullishLT}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{r.pctBullishLT}%</td>
                    <td className="py-1.5 text-right"><DeltaCell value={r.fiveDayChg} /></td>
                    <td className="py-1.5 text-right font-mono tabular-nums text-destructive">{r.bearishLT}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{r.pctBearishLT}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>


      <div className="px-3 pb-6">
        <div className="hud-panel">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-surface-foreground">
              Stocks · {filtered.length}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Filter symbol or name…"
                  className="h-7 pl-7 w-48 text-xs"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] uppercase tracking-wider"
                onClick={() => exportCsv(filtered, `${u.slug}.csv`)}
              >
                <Download className="h-3 w-3 mr-1" /> CSV
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[960px]">
              <thead className="text-[9px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-6"></th>
                  <th className="text-left py-1 font-medium">Symbol</th>
                  <th className="text-left py-1 font-medium">Name</th>
                  <th className="text-left py-1 font-medium">ETF</th>
                  <th className="text-left py-1 font-medium">Category</th>
                  <th className="text-left py-1 font-medium">LT Trend</th>
                  <th className="text-left py-1 font-medium">LT Relative</th>
                  <th className="text-left py-1 font-medium">LT Signal</th>
                  <th className="text-right py-1 font-medium">LT Days</th>
                  <th className="text-right py-1 font-medium">LT Return</th>
                  <th className="text-right py-1 font-medium pr-2">LT Net</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <StockRow key={s.symbol} s={s} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
