// ETF dual-trend table — full 127-ETF universe.
import { useMemo, useState } from "react";
import { ChevronDown, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LevelBar, SignalBadge } from "@/components/hud/SignalBadge";
import { cn } from "@/lib/utils";
import { useEtfDualTrend, type EtfDualTrendRow } from "@/hooks/useEtfDualTrend";

type SortKey =
  | "etf" | "name" | "category"
  | "ltTrend" | "ltRelative" | "ltDays" | "ltReturn" | "ltNet"
  | "stTrend" | "stRelative" | "stDays" | "stReturn" | "stNet";

const badge = (s: EtfDualTrendRow["ltSignal"]) =>
  s === "Bullish" ? "BULLISH" : s === "Bearish" ? "BEARISH" : "NEUTRAL";

const pct = (v?: number | null) => (v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);

function PctCell({ v, className }: { v: number | null; className?: string }) {
  return (
    <td
      className={cn(
        "py-1.5 text-right font-mono tabular-nums",
        v === null ? "text-muted-foreground" : v >= 0 ? "text-success" : "text-destructive",
        className,
      )}
    >
      {pct(v)}
    </td>
  );
}

function exportCsv(rows: EtfDualTrendRow[]) {
  const headers = [
    "SYMBOL", "NAME", "CATEGORY",
    "LT TREND", "LT RELATIVE", "LT SIGNAL", "LT DAYS", "LT RETURN", "LT NET",
    "ST TREND", "ST RELATIVE", "ST SIGNAL", "ST DAYS", "ST RETURN", "ST NET",
  ];
  const body = rows.map((r) =>
    [r.etf, `"${r.name}"`, r.category,
      r.ltTrend, r.ltRelative, r.ltSignal, r.ltDays, pct(r.ltReturn), pct(r.ltNet),
      r.stTrend, r.stRelative, r.stSignal, r.stDays, pct(r.stReturn), pct(r.stNet)].join(","),
  );
  const blob = new Blob([[headers.join(","), ...body].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "etf-dual-trend.csv";
  a.click();
}

function DetailCard({
  label, signal, trend, relative, days, date, ret, net, risk,
}: {
  label: string;
  signal: EtfDualTrendRow["ltSignal"];
  trend: number;
  relative: number;
  days: number;
  date: string;
  ret: number | null;
  net: number | null;
  risk: EtfDualTrendRow["ltSignal"];
}) {
  return (
    <div
      className={cn(
        "rounded-sm border p-3",
        signal === "Bullish"
          ? "border-success/30 bg-success/5"
          : signal === "Bearish"
            ? "border-destructive/30 bg-destructive/5"
            : "border-border bg-muted/20",
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label} Dual Trend System</div>
        <SignalBadge value={badge(signal)} />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div className="text-muted-foreground">Trend Level</div>
        <div className="text-right font-mono tabular-nums">{trend}</div>
        <div className="text-muted-foreground">Relative Level</div>
        <div className="text-right font-mono tabular-nums">{relative}</div>
        <div className="text-muted-foreground">Days in Signal</div>
        <div className="text-right font-mono tabular-nums">{days}</div>
        <div className="text-muted-foreground">Signal Date</div>
        <div className="text-right font-mono tabular-nums">{date}</div>
        <div className="text-muted-foreground">Return</div>
        <div className={cn("text-right font-mono tabular-nums", ret === null ? "" : ret >= 0 ? "text-success" : "text-destructive")}>{pct(ret)}</div>
        <div className="text-muted-foreground">Net Return</div>
        <div className={cn("text-right font-mono tabular-nums", net === null ? "" : net >= 0 ? "text-success" : "text-destructive")}>{pct(net)}</div>
        <div className="text-muted-foreground">Risk System</div>
        <div className="text-right"><SignalBadge value={badge(risk)} /></div>
      </div>
    </div>
  );
}

function Row({ r }: { r: EtfDualTrendRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="border-t border-border/50 cursor-pointer hover:bg-muted/30" onClick={() => setOpen((v) => !v)}>
        <td className="py-1.5 pl-2">
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </td>
        <td className="py-1.5 font-mono font-medium">{r.etf}</td>
        <td className="py-1.5 truncate max-w-[240px]">{r.name}</td>
        <td className="py-1.5 text-[10px] text-muted-foreground whitespace-nowrap">{r.category}</td>
        <td className="py-1.5"><LevelBar value={r.ltTrend} /></td>
        <td className="py-1.5"><LevelBar value={r.ltRelative} /></td>
        <td className="py-1.5"><SignalBadge value={badge(r.ltSignal)} /></td>
        <td className="py-1.5 text-right font-mono tabular-nums">{r.ltDays}</td>
        <PctCell v={r.ltReturn} />
        <PctCell v={r.ltNet} />
        <td className="py-1.5"><LevelBar value={r.stTrend} /></td>
        <td className="py-1.5"><LevelBar value={r.stRelative} /></td>
        <td className="py-1.5"><SignalBadge value={badge(r.stSignal)} /></td>
        <td className="py-1.5 text-right font-mono tabular-nums">{r.stDays}</td>
        <PctCell v={r.stReturn} />
        <PctCell v={r.stNet} className="pr-2" />
      </tr>
      {open && (
        <tr className="bg-muted/20 border-t border-border/50">
          <td colSpan={16} className="p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <DetailCard label="Short-Term" signal={r.stSignal} trend={r.stTrend} relative={r.stRelative} days={r.stDays} date={r.stDate} ret={r.stReturn} net={r.stNet} risk={r.riskStSignal} />
              <DetailCard label="Long-Term" signal={r.ltSignal} trend={r.ltTrend} relative={r.ltRelative} days={r.ltDays} date={r.ltDate} ret={r.ltReturn} net={r.ltNet} risk={r.riskLtSignal} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function EtfDualTrendTable() {
  const { data, isLoading, error } = useEtfDualTrend();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "etf", dir: "asc" });

  const categories = useMemo(
    () => ["All", ...Array.from(new Set((data?.rows ?? []).map((r) => r.category))).sort()],
    [data],
  );

  const rows = useMemo(() => {
    const needle = q.toLowerCase();
    const list = (data?.rows ?? []).filter(
      (r) =>
        (cat === "All" || r.category === cat) &&
        (r.etf.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle)),
    );
    const { key, dir } = sort;
    return [...list].sort((a, b) => {
      const av = a[key] as string | number | null;
      const bv = b[key] as string | number | null;
      const c =
        typeof av === "string"
          ? av.localeCompare(bv as string)
          : (av ?? -Infinity) - ((bv as number) ?? -Infinity);
      return dir === "asc" ? c : -c;
    });
  }, [data, q, cat, sort]);

  const th = (label: string, key?: SortKey, align: "left" | "right" = "left") => (
    <th
      className={cn(
        "py-1 font-medium whitespace-nowrap",
        align === "right" ? "text-right" : "text-left",
        key && "cursor-pointer select-none hover:text-surface-foreground",
      )}
      onClick={key ? () => setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" })) : undefined}
    >
      {label}
      {sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <div className="hud-panel">
      <div className="px-3 py-2 border-b border-border flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-surface-foreground">
          ETF Dual Trend · {rows.length} of {data?.rows.length ?? 0}
        </div>
        <div className="flex items-center gap-2">
          {data?.asOf && <span className="text-[9px] font-mono text-muted-foreground">{data.asOf}</span>}
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="h-7 rounded-sm border border-border bg-background px-2 text-xs"
          >
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ETF…" className="h-7 pl-7 text-xs w-40" />
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => exportCsv(rows)}>
            <Download className="h-3 w-3 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 text-xs text-destructive">Signal API error: {(error as Error).message}</div>
      )}

      <div className="p-3 overflow-x-auto">
        <table className="w-full text-xs min-w-[1320px]">
          <thead className="text-[9px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-6" />
              {th("Symbol", "etf")}
              {th("Name", "name")}
              {th("Category", "category")}
              {th("LT Trend", "ltTrend")}
              {th("LT Relative", "ltRelative")}
              {th("LT Signal")}
              {th("LT Days", "ltDays", "right")}
              {th("LT Return", "ltReturn", "right")}
              {th("LT Net", "ltNet", "right")}
              {th("ST Trend", "stTrend")}
              {th("ST Relative", "stRelative")}
              {th("ST Signal")}
              {th("ST Days", "stDays", "right")}
              {th("ST Return", "stReturn", "right")}
              {th("ST Net", "stNet", "right")}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={16} className="py-3 text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={16} className="py-3 text-muted-foreground">No ETFs match.</td></tr>
            )}
            {rows.map((r) => <Row key={r.etf} r={r} />)}
          </tbody>
        </table>
      </div>

      <div className="px-3 pb-2 text-[9px] text-muted-foreground">
        Sector SPDRs ({data?.liveCount ?? 0}) run live off the Signal API's index-level relative-trend series;
        the remaining ETFs render from the 2026-08-14 published vintage until the API exposes ETF entities.
      </div>
    </div>
  );
}
