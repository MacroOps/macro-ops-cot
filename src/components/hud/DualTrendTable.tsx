// Shared Dual Trend constituent table used by every Dual Trend section.
import { useMemo, useState } from "react";
import { ChevronDown, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LevelBar, SignalBadge } from "@/components/hud/SignalBadge";
import { cn } from "@/lib/utils";
import type { DualTrendSection } from "@/lib/dualTrend/config";
import type { DtHorizon, DualTrendRow } from "@/lib/dualTrend/build";
import { useDualTrendReturns, useDualTrendUniverse } from "@/hooks/useDualTrendUniverse";
import type { Ret } from "@/lib/dualTrend/returns";

type SortKey =
  | "symbol" | "name" | "group" | "subGroup"
  | "ltTrend" | "ltRelative" | "ltDays" | "ltRet" | "ltNet"
  | "stTrend" | "stRelative" | "stDays" | "stRet" | "stNet";

type View = DualTrendRow & { ltR?: Ret; stR?: Ret };

const badge = (s: DtHorizon["signal"]) => s.toUpperCase() as "BULLISH" | "BEARISH" | "NEUTRAL";

function sortValue(r: View, k: SortKey): number | string | null {
  switch (k) {
    case "ltTrend": return r.lt.trend;
    case "ltRelative": return r.lt.relative;
    case "ltDays": return r.lt.days;
    case "ltRet": return r.ltR?.ret ?? null;
    case "ltNet": return r.ltR?.net ?? null;
    case "stTrend": return r.st.trend;
    case "stRelative": return r.st.relative;
    case "stDays": return r.st.days;
    case "stRet": return r.stR?.ret ?? null;
    case "stNet": return r.stR?.net ?? null;
    default: return r[k];
  }
}

const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "" : v.toFixed(1));

function exportCsv(rows: View[], filename: string, groupLabel: string, subLabel: string) {
  const headers = [
    "SYMBOL", "NAME", groupLabel.toUpperCase(), subLabel.toUpperCase(),
    "LT TREND", "LT RELATIVE", "LT SIGNAL", "LT DAYS", "LT SIGNAL DATE", "LT RETURN %", "LT NET %",
    "ST TREND", "ST RELATIVE", "ST SIGNAL", "ST DAYS", "ST SIGNAL DATE", "ST RETURN %", "ST NET %",
  ];
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const body = rows.map((r) =>
    [r.symbol, q(r.name), q(r.group), q(r.subGroup),
      r.lt.trend ?? "", r.lt.relative ?? "", r.lt.signal, r.lt.days ?? "", r.lt.start, fmt(r.ltR?.ret), fmt(r.ltR?.net),
      r.st.trend ?? "", r.st.relative ?? "", r.st.signal, r.st.days ?? "", r.st.start, fmt(r.stR?.ret), fmt(r.stR?.net),
    ].join(","),
  );
  const blob = new Blob([[headers.join(","), ...body].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function Pct({ v, loading }: { v: number | null | undefined; loading: boolean }) {
  if (v === null || v === undefined) return <span className="tabular-nums text-muted-foreground">{loading ? "…" : "—"}</span>;
  return (
    <span className={cn("tabular-nums", v >= 0 ? "text-success" : "text-destructive")}>
      {v > 0 ? "+" : ""}{v.toFixed(1)}%
    </span>
  );
}

const Level = ({ v }: { v: number | null }) =>
  v === null ? <span className="text-muted-foreground">—</span> : <LevelBar value={v} />;

function DetailPanel({ label, accent, h, r, loading }: {
  label: string; accent: string; h: DtHorizon; r?: Ret; loading: boolean;
}) {
  const tone = h.signal === "Bullish" ? "border-success bg-success/5" : h.signal === "Bearish" ? "border-destructive bg-destructive/5" : "border-border bg-muted/20";
  const toneText = h.signal === "Bullish" ? "text-success" : h.signal === "Bearish" ? "text-destructive" : "text-muted-foreground";
  return (
    <div className={cn("rounded-sm border bg-card", accent)}>
      <div className="px-3 py-2 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-center text-surface-foreground">
        {label} Dual Trend System
      </div>
      <div className="p-3 space-y-2 text-xs">
        <div className="flex items-center justify-between"><span className="text-muted-foreground">Trend Level</span><span className="tabular-nums">{h.trend ?? "—"}</span></div>
        <div className="flex items-center justify-between"><span className="text-muted-foreground">Relative Level</span><span className="tabular-nums">{h.relative ?? "—"}</span></div>
        <div className="flex items-center justify-between"><span className="text-muted-foreground">Signal</span><SignalBadge value={badge(h.signal)} /></div>
        <div className={cn("rounded-sm border-l-2 p-2 space-y-1.5", tone)}>
          <div className={cn("text-[10px] font-semibold uppercase tracking-wider text-center", toneText)}>{h.signal} Signal</div>
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Days in Signal</span><span className="tabular-nums">{h.days ?? "—"}</span></div>
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Signal Date</span><span className="tabular-nums">{h.start || "—"}</span></div>
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Return</span><Pct v={r?.ret} loading={loading} /></div>
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Net Return</span><Pct v={r?.net} loading={loading} /></div>
        </div>
      </div>
    </div>
  );
}

function Row({ r, loading }: { r: View; loading: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        className={cn("border-t border-border/50 cursor-pointer hover:bg-muted/30", open && "bg-muted/40")}
        onClick={() => setOpen((v) => !v)}
      >
        <td className="py-1.5 pl-2"><ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} /></td>
        <td className="py-1.5 font-medium">{r.symbol}</td>
        <td className="py-1.5 truncate max-w-[180px]">{r.name || "—"}</td>
        <td className="py-1.5 text-[10px] text-muted-foreground whitespace-nowrap">{r.group || "—"}</td>
        <td className="py-1.5 text-[10px] text-muted-foreground truncate max-w-[160px]">{r.subGroup || "—"}</td>
        <td className="py-1.5"><Level v={r.lt.trend} /></td>
        <td className="py-1.5"><Level v={r.lt.relative} /></td>
        <td className="py-1.5"><SignalBadge value={badge(r.lt.signal)} /></td>
        <td className="py-1.5 text-right tabular-nums">{r.lt.days ?? "—"}</td>
        <td className="py-1.5 text-right"><Pct v={r.ltR?.ret} loading={loading} /></td>
        <td className="py-1.5 text-right"><Pct v={r.ltR?.net} loading={loading} /></td>
        <td className="py-1.5 pl-3"><Level v={r.st.trend} /></td>
        <td className="py-1.5"><Level v={r.st.relative} /></td>
        <td className="py-1.5"><SignalBadge value={badge(r.st.signal)} /></td>
        <td className="py-1.5 text-right tabular-nums">{r.st.days ?? "—"}</td>
        <td className="py-1.5 text-right"><Pct v={r.stR?.ret} loading={loading} /></td>
        <td className="py-1.5 text-right pr-2"><Pct v={r.stR?.net} loading={loading} /></td>
      </tr>
      {open && (
        <tr className="bg-muted/20 border-t border-border/50">
          <td colSpan={17} className="p-3">
            <div className="text-[11px] font-semibold mb-2">
              {r.symbol}{r.name && <> · <span className="text-muted-foreground font-normal">{r.name}</span></>}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <DetailPanel label="Short-Term" accent="border-t-2 border-t-warning" h={r.st} r={r.stR} loading={loading} />
              <DetailPanel label="Long-Term" accent="border-t-2 border-t-primary" h={r.lt} r={r.ltR} loading={loading} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function DualTrendTable({ section }: { section: DualTrendSection }) {
  const { data, isLoading, error } = useDualTrendUniverse(section.universe);
  const returns = useDualTrendReturns(data);
  const isList = section.universe.kind === "lists";
  const groupLabel = isList ? "Category" : "Sector";
  const subLabel = isList ? "Group" : "Sub-Industry";
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "symbol", dir: "asc" });

  const groups = useMemo(() => [...new Set((data?.rows ?? []).map((r) => r.group).filter(Boolean))].sort(), [data]);

  const rows = useMemo<View[]>(() => {
    const term = q.toLowerCase();
    const list: View[] = (data?.rows ?? [])
      .filter((r) =>
        (group === "all" || r.group === group) &&
        (r.symbol.toLowerCase().includes(term) || r.name.toLowerCase().includes(term) || r.subGroup.toLowerCase().includes(term)))
      .map((r) => ({ ...r, ltR: returns.get(r.symbol, r.lt.start), stR: returns.get(r.symbol, r.st.start) }));
    const { key, dir } = sort;
    return list.sort((a, b) => {
      const av = sortValue(a, key);
      const bv = sortValue(b, key);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return dir === "asc" ? cmp : -cmp;
    });
  }, [data, q, group, sort, returns]);

  const bullLT = rows.filter((r) => r.lt.signal === "Bullish").length;
  const bullST = rows.filter((r) => r.st.signal === "Bullish").length;

  const th = (label: string, key: SortKey, align: "left" | "right" = "left", extra = "") => (
    <th
      className={cn("py-1 font-medium cursor-pointer select-none whitespace-nowrap", align === "right" ? "text-right" : "text-left", extra)}
      onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }))}
    >
      {label}{sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <div className="hud-panel">
      <div className="px-3 py-2 border-b border-border flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-surface-foreground">
          {isList ? "Members" : "Constituents"} · {rows.length}
          {data?.asOf && <span className="ml-2 font-normal text-muted-foreground">as of {data.asOf}</span>}
          {rows.length > 0 && (
            <span className="ml-2 font-normal text-muted-foreground">
              LT bullish {Math.round((bullLT / rows.length) * 100)}% · ST bullish {Math.round((bullST / rows.length) * 100)}%
            </span>
          )}
          {returns.loading && <span className="ml-2 font-normal text-muted-foreground">· loading returns…</span>}
        </div>
        <div className="flex items-center gap-2">
          {groups.length > 1 && (
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              aria-label={`Filter by ${groupLabel.toLowerCase()}`}
              className="h-7 rounded-sm border border-input bg-background px-2 text-xs"
            >
              <option value="all">All {isList ? "categories" : "sectors"}</option>
              {groups.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          )}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter symbol, name, industry…" className="h-7 pl-7 w-52 text-xs" />
          </div>
          <Button variant="outline" size="sm" className="h-7 text-[10px] uppercase tracking-wider" onClick={() => exportCsv(rows, section.csvName, groupLabel, subLabel)}>
            <Download className="h-3 w-3 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="p-3 space-y-2">
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-5 w-full" />)}
        </div>
      )}
      {error && <div className="p-4 text-xs text-destructive">Failed to load: {(error as Error).message}</div>}

      {!isLoading && !error && (
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-xs min-w-[1400px]">
            <thead className="text-[9px] uppercase tracking-wider text-muted-foreground sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                <th className="w-6"></th>
                {th("Symbol", "symbol")}
                {th("Name", "name")}
                {th(groupLabel, "group")}
                {th(subLabel, "subGroup")}
                {th("LT Trend", "ltTrend")}
                {th("LT Relative", "ltRelative")}
                <th className="text-left py-1 font-medium">LT Signal</th>
                {th("LT Days", "ltDays", "right")}
                {th("LT Return", "ltRet", "right")}
                {th("LT Net", "ltNet", "right")}
                {th("ST Trend", "stTrend", "left", "pl-3")}
                {th("ST Relative", "stRelative")}
                <th className="text-left py-1 font-medium">ST Signal</th>
                {th("ST Days", "stDays", "right")}
                {th("ST Return", "stRet", "right")}
                {th("ST Net", "stNet", "right", "pr-2")}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => <Row key={`${r.group}|${r.symbol}`} r={r} loading={returns.loading} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
