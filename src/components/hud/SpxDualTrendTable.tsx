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
                <tr key={r.symbol} className="border-t border-border/50 hover:bg-muted/30">
                  <td className="py-1.5 pl-2 font-mono font-medium">{r.symbol}</td>
                  <td className="py-1.5 truncate max-w-[180px]">{r.name}</td>
                  <td className="py-1.5 text-[10px] text-muted-foreground whitespace-nowrap">{r.sectorLabel}</td>
                  <td className="py-1.5 text-[10px] text-muted-foreground truncate max-w-[160px]">{r.subIndustry}</td>
                  <td className="py-1.5"><LevelBar value={r.ltTrend} /></td>
                  <td className="py-1.5"><LevelBar value={r.ltRelative} /></td>
                  <td className="py-1.5"><SignalBadge value={r.ltSignal.toUpperCase() as "BULLISH" | "BEARISH"} /></td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{r.ltDays}</td>
                  <td className="py-1.5"><LevelBar value={r.stTrend} /></td>
                  <td className="py-1.5"><LevelBar value={r.stRelative} /></td>
                  <td className="py-1.5"><SignalBadge value={r.stSignal.toUpperCase() as "BULLISH" | "BEARISH"} /></td>
                  <td className="py-1.5 text-right font-mono tabular-nums pr-2">{r.stDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
