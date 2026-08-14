// Live S&P 500 dual-trend constituent table (Macro Ops Signal API).
import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LevelBar, SignalBadge } from "@/components/hud/SignalBadge";
import { cn } from "@/lib/utils";
import { useSpxDualTrend, SECTOR_LABELS, type SpxDualTrendRow } from "@/hooks/useSpxDualTrend";

type SortKey = keyof Pick<
  SpxDualTrendRow,
  "symbol" | "name" | "sectorLabel" | "subIndustry" | "ltTrend" | "ltRelative" | "ltDays" | "stTrend" | "stRelative" | "stDays"
>;

function exportCsv(rows: SpxDualTrendRow[]) {
  const headers = [
    "SYMBOL", "NAME", "SECTOR", "SUB-INDUSTRY",
    "LT TREND", "LT RELATIVE", "LT SIGNAL", "LT DAYS",
    "ST TREND", "ST RELATIVE", "ST SIGNAL", "ST DAYS",
  ];
  const body = rows.map((r) =>
    [r.symbol, `"${r.name}"`, r.sector, `"${r.subIndustry}"`,
      r.ltTrend, r.ltRelative, r.ltSignal, r.ltDays,
      r.stTrend, r.stRelative, r.stSignal, r.stDays].join(","),
  );
  const blob = new Blob([[headers.join(","), ...body].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "spx-dual-trend.csv";
  a.click();
}

function DetailPanel({
  label,
  accent,
  trend,
  relative,
  signal,
  days,
  signalDate,
  loading,
}: {
  label: string;
  accent: string;
  trend: number;
  relative: number;
  signal: "Bullish" | "Bearish";
  days?: number;
  signalDate?: string;
  loading: boolean;
}) {
  const bull = signal === "Bullish";
  return (
    <div className={cn("rounded-sm border bg-card", accent)}>
      <div className="px-3 py-2 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-center text-surface-foreground">
        {label} Dual Trend System
      </div>
      <div className="p-3 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Trend Level</span>
          <span className="font-mono tabular-nums">{trend}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Relative Level</span>
          <span className="font-mono tabular-nums">{relative}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Signal</span>
          <SignalBadge value={signal.toUpperCase() as "BULLISH" | "BEARISH"} />
        </div>
        <div
          className={cn(
            "rounded-sm border-l-2 p-2 space-y-1.5",
            bull ? "border-success bg-success/5" : "border-destructive bg-destructive/5",
          )}
        >
          <div className={cn("text-[10px] font-semibold uppercase tracking-wider text-center", bull ? "text-success" : "text-destructive")}>
            {signal} Signal
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Days in Signal</span>
            <span className="font-mono tabular-nums">{loading ? "…" : days ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Signal Date</span>
            <span className="font-mono tabular-nums">{loading ? "…" : signalDate || "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpxRow({ r }: { r: SpxDualTrendRow }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useSymbolTrendDetail(r.symbol, open);

  return (
    <>
      <tr
        className={cn("border-t border-border/50 cursor-pointer hover:bg-muted/30", open && "bg-muted/40")}
        onClick={() => setOpen((v) => !v)}
      >
        <td className="py-1.5 pl-2">
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </td>
        <td className="py-1.5 font-mono font-medium">{r.symbol}</td>
        <td className="py-1.5 truncate max-w-[180px]">{r.name}</td>
        <td className="py-1.5 text-[10px] text-muted-foreground whitespace-nowrap">{r.sectorLabel}</td>
        <td className="py-1.5 text-[10px] text-muted-foreground truncate max-w-[160px]">{r.subIndustry}</td>
        <td className="py-1.5"><LevelBar value={r.ltTrend} /></td>
        <td className="py-1.5"><LevelBar value={r.ltRelative} /></td>
        <td className="py-1.5"><SignalBadge value={r.ltSignal.toUpperCase() as "BULLISH" | "BEARISH"} /></td>
        <td className="py-1.5 text-right font-mono tabular-nums">{data ? data.lt.days : r.ltDays || "—"}</td>
        <td className="py-1.5"><LevelBar value={r.stTrend} /></td>
        <td className="py-1.5"><LevelBar value={r.stRelative} /></td>
        <td className="py-1.5"><SignalBadge value={r.stSignal.toUpperCase() as "BULLISH" | "BEARISH"} /></td>
        <td className="py-1.5 text-right font-mono tabular-nums pr-2">{data ? data.st.days : r.stDays || "—"}</td>
      </tr>
      {open && (
        <tr className="bg-muted/20 border-t border-border/50">
          <td colSpan={13} className="p-3">
            <div className="text-[11px] font-semibold mb-2">
              {r.symbol} · <span className="text-muted-foreground font-normal">{r.name}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <DetailPanel
                label="Short-Term"
                accent="border-t-2 border-t-warning"
                trend={r.stTrend}
                relative={r.stRelative}
                signal={r.stSignal}
                days={data?.st.days}
                signalDate={data?.st.signalDate}
                loading={isLoading}
              />
              <DetailPanel
                label="Long-Term"
                accent="border-t-2 border-t-primary"
                trend={r.ltTrend}
                relative={r.ltRelative}
                signal={r.ltSignal}
                days={data?.lt.days}
                signalDate={data?.lt.signalDate}
                loading={isLoading}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function SpxDualTrendTable() {

  const { data, isLoading, error } = useSpxDualTrend();
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "symbol", dir: "asc" });

  const rows = useMemo(() => {
    const term = q.toLowerCase();
    const list = (data?.rows ?? []).filter(
      (r) =>
        (sector === "all" || r.sector === sector) &&
        (r.symbol.toLowerCase().includes(term) ||
          r.name.toLowerCase().includes(term) ||
          r.subIndustry.toLowerCase().includes(term)),
    );
    const { key, dir } = sort;
    return [...list].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return dir === "asc" ? cmp : -cmp;
    });
  }, [data, q, sector, sort]);

  const bullLT = rows.filter((r) => r.ltSignal === "Bullish").length;
  const bullST = rows.filter((r) => r.stSignal === "Bullish").length;

  const th = (label: string, key: SortKey, align: "left" | "right" = "left") => (
    <th
      className={cn("py-1 font-medium cursor-pointer select-none whitespace-nowrap", align === "right" ? "text-right" : "text-left")}
      onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }))}
    >
      {label}
      {sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <div className="hud-panel">
      <div className="px-3 py-2 border-b border-border flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-surface-foreground">
          Constituents · {rows.length}
          {data?.asOf && <span className="ml-2 font-normal text-muted-foreground">as of {data.asOf}</span>}
          {rows.length > 0 && (
            <span className="ml-2 font-normal text-muted-foreground">
              LT bullish {Math.round((bullLT / rows.length) * 100)}% · ST bullish {Math.round((bullST / rows.length) * 100)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="h-7 rounded-sm border border-input bg-background px-2 text-xs"
          >
            <option value="all">All sectors</option>
            {Object.entries(SECTOR_LABELS).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter symbol, name, industry…"
              className="h-7 pl-7 w-52 text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px] uppercase tracking-wider"
            onClick={() => exportCsv(rows)}
          >
            <Download className="h-3 w-3 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {isLoading && <div className="p-4 text-xs text-muted-foreground">Loading constituents…</div>}
      {error && <div className="p-4 text-xs text-destructive">Failed to load: {error.message}</div>}

      {!isLoading && !error && (
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-xs min-w-[1000px]">
            <thead className="text-[9px] uppercase tracking-wider text-muted-foreground sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                <th className="w-6"></th>
                {th("Symbol", "symbol")}
                {th("Name", "name")}
                {th("Sector", "sectorLabel")}
                {th("Sub-Industry", "subIndustry")}
                {th("LT Trend", "ltTrend")}
                {th("LT Relative", "ltRelative")}
                <th className="text-left py-1 font-medium">LT Signal</th>
                {th("LT Days", "ltDays", "right")}
                {th("ST Trend", "stTrend")}
                {th("ST Relative", "stRelative")}
                <th className="text-left py-1 font-medium">ST Signal</th>
                {th("ST Days", "stDays", "right")}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <SpxRow key={r.symbol} r={r} />
              ))}
            </tbody>

          </table>
        </div>
      )}
    </div>
  );
}
