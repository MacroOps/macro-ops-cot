import { useMemo, useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { MockBadge } from "@/components/hud/MockBadge";
import { PageHeader } from "@/components/hud/PageHeader";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTpDtPortfolio } from "@/hooks/useTpDtPortfolio";
import type { TpDtHolding, TpDtSector, TpDtStance } from "@/lib/tpDtPortfolio";
import { TP_DT_TRADE_UPDATES } from "@/lib/tpDtTradeUpdatesMock";
import { ChevronDown, Loader2, RefreshCw } from "lucide-react";

function pct(n: number | null, digits = 2) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

function stanceTone(value: string) {
  const s = value.toLowerCase();
  if (s.startsWith("bull") || s.startsWith("over")) return "bg-success/15 text-success border-success/30";
  if (s.startsWith("bear") || s.startsWith("under")) return "bg-destructive/15 text-destructive border-destructive/30";
  return "bg-muted text-muted-foreground border-border";
}

function StancePill({ value }: { value: TpDtStance }) {
  return (
    <span className={`inline-flex text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-full border ${stanceTone(value)}`}>
      {value}
    </span>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="hud-panel px-3 py-2 min-w-[8.5rem]">
      <div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="text-sm tabular-nums text-surface-foreground mt-0.5">{value}</div>
    </div>
  );
}

const BOOK_COLS =
  "grid grid-cols-[5.25rem_minmax(0,1.4fr)_5.5rem_minmax(0,1fr)_6.5rem_6.5rem] gap-x-3 items-center px-3";

function BookColHead() {
  return (
    <div className={`${BOOK_COLS} py-1.5 border-b border-border text-[9px] uppercase tracking-wider text-muted-foreground`}>
      <div>Symbol</div>
      <div>Name</div>
      <div className="text-right">Weight</div>
      <div>Sub-industry</div>
      <div>LT status</div>
      <div>ST status</div>
    </div>
  );
}

function HoldingRow({ h }: { h: TpDtHolding }) {
  return (
    <div className={`${BOOK_COLS} py-1.5 border-b border-border/60 text-xs`}>
      <div className="font-semibold text-surface-foreground truncate">{h.symbol}</div>
      <div className="text-muted-foreground truncate" title={h.name}>
        {h.name}
      </div>
      <div className="tabular-nums text-right">{pct(h.weightPct)}</div>
      <div className="text-muted-foreground truncate" title={h.subIndustry}>
        {h.subIndustry}
      </div>
      <div>
        <StancePill value={h.lt} />
      </div>
      <div>
        <StancePill value={h.st} />
      </div>
    </div>
  );
}

function SectorBlock({ sector, defaultOpen }: { sector: TpDtSector; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const label = sector.positioning || "—";

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="hud-panel overflow-hidden">
      <CollapsibleTrigger className="w-full flex flex-col gap-2 px-3 py-2 text-left hover:bg-muted/40 sm:grid sm:grid-cols-[1fr_auto] sm:items-center sm:gap-3">
        <span className="flex items-center gap-2 min-w-0">
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
          <span className="text-xs font-semibold text-surface-foreground truncate">{sector.name}</span>
        </span>
        <span className="grid grid-cols-2 gap-x-3 gap-y-1 pl-5 text-[10px] tabular-nums sm:grid-cols-[9.5rem_9.5rem_11rem] sm:pl-0 sm:text-right">
          <span className="text-muted-foreground">Portfolio {pct(sector.portfolioPct)}</span>
          <span className="text-muted-foreground text-right">Benchmark {pct(sector.benchmarkPct)}</span>
          <span className="col-span-2 inline-flex sm:col-span-1 sm:justify-end">
            <span className={`uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-full border ${stanceTone(label)}`}>
              {label}
            </span>
          </span>
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="overflow-x-auto pb-1">
          <div className="min-w-[44rem]">
            <BookColHead />
            {sector.holdings.map((h) => (
              <HoldingRow key={h.symbol} h={h} />
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function formatCommentTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Los_Angeles",
    });
  } catch {
    return iso;
  }
}

export default function TpDeanPortfolio() {
  const { data, isLoading, isFetching, error, refetch } = useTpDtPortfolio();
  const comments = useMemo(
    () => [...TP_DT_TRADE_UPDATES].sort((a, b) => b.postedAt.localeCompare(a.postedAt)),
    [],
  );

  return (
    <AppShell title="Dual Trend Portfolio">
      <PageHeader
        eyebrow="Turning Point"
        title="Dual Trend Portfolio"
        description={
          data?.asOf
            ? `Dean's book. Holdings as of ${data.asOf}.`
            : "Dean's book, from the TP DT - PUBLIC tab."
        }
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-[10px] uppercase tracking-wider px-2 py-1 border border-border rounded-sm hover:bg-muted flex items-center gap-1.5 disabled:opacity-60"
          >
            {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </button>
        }
      />

      {isLoading && (
        <div className="p-8 flex items-center justify-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading book
        </div>
      )}
      {error && (
        <div className="m-4 text-xs text-destructive border border-destructive/40 bg-destructive/10 px-3 py-2">
          {(error as Error).message}
        </div>
      )}

      {data && (
        <div className="px-4 py-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <StatChip label="Total holdings" value={data.holdings == null ? "—" : String(data.holdings)} />
            <StatChip label="Total sectors" value={data.sectors == null ? "—" : String(data.sectors)} />
            <StatChip label="S&P 500 weight" value={pct(data.spxWeightPct)} />
            <StatChip label="Cash weight" value={pct(data.cashWeightPct)} />
          </div>

          <div className="space-y-2">
            {data.groups.map((s, i) => (
              <SectorBlock key={s.name} sector={s} defaultOpen={i < 2} />
            ))}
          </div>
        </div>
      )}

      <div className="px-4 pb-4">
        <aside className="hud-panel">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-surface-foreground">
                Trade updates
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">#dt_trade_updates · Dean</div>
            </div>
            <MockBadge label="Mock data" reason="Sample notes from the old book screenshot. Not live Slack, and not the current holdings." />
          </div>
          <ul className="divide-y divide-border/60">
            {comments.map((c) => (
              <li key={c.id} className="px-3 py-2.5">
                <div className="text-[10px] text-muted-foreground">{formatCommentTime(c.postedAt)} PT</div>
                <p className="text-xs text-surface-foreground mt-1 leading-relaxed">{c.text}</p>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </AppShell>
  );
}
