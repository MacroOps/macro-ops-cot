import { useMemo, useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { MockBadge } from "@/components/hud/MockBadge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import {
  DEAN_PORTFOLIO_AS_OF,
  DEAN_PORTFOLIO_SECTORS,
  DEAN_PORTFOLIO_STATS,
  DEAN_TRADE_UPDATES,
  type DeanHolding,
  type DeanSector,
  type Stance,
  type VsBenchmark,
} from "@/lib/tpDeanPortfolioMock";

function pct(n: number, digits = 2) {
  return `${n.toFixed(digits)}%`;
}

function vsTone(vs: VsBenchmark) {
  if (vs === "Underweight") return "text-destructive";
  if (vs === "Overweight") return "text-success";
  return "text-muted-foreground";
}

function StancePill({ value }: { value: Stance }) {
  const tone =
    value === "Bullish"
      ? "bg-success/15 text-success border-success/30"
      : value === "Bearish"
        ? "bg-destructive/15 text-destructive border-destructive/30"
        : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-full border ${tone}`}>
      {value}
    </span>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="hud-panel px-3 py-2 min-w-[8.5rem]">
      <div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="font-mono text-sm tabular-nums text-surface-foreground mt-0.5">{value}</div>
    </div>
  );
}

/** Same tracks for every sector so columns line up. */
const BOOK_COLS =
  "grid grid-cols-[5.25rem_minmax(0,1fr)_5.5rem_minmax(0,1fr)_6.5rem_6.5rem] gap-x-3 items-center px-3";

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

function HoldingRow({ h }: { h: DeanHolding }) {
  return (
    <div className={`${BOOK_COLS} py-1.5 border-b border-border/60 text-xs`}>
      <div className="font-mono font-semibold text-surface-foreground truncate">{h.symbol}</div>
      <div className="text-muted-foreground truncate" title={h.name}>
        {h.name}
      </div>
      <div className="font-mono tabular-nums text-right">{pct(h.weightPct)}</div>
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

function SectorBlock({ sector, defaultOpen }: { sector: DeanSector; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const delta = `${sector.vsPct > 0 ? "+" : ""}${sector.vsPct.toFixed(1)}%`;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="hud-panel overflow-hidden">
      <CollapsibleTrigger className="w-full grid grid-cols-[1fr_auto] gap-3 items-center px-3 py-2 text-left hover:bg-muted/40">
        <span className="flex items-center gap-2 min-w-0">
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
          <span className="text-xs font-semibold text-surface-foreground truncate">{sector.name}</span>
        </span>
        <span className="hidden sm:grid grid-cols-[9.5rem_9.5rem_11rem] gap-3 text-[10px] tabular-nums text-right shrink-0">
          <span className="text-muted-foreground">Portfolio {pct(sector.portfolioPct)}</span>
          <span className="text-muted-foreground">Benchmark {pct(sector.benchmarkPct)}</span>
          <span className={`uppercase tracking-wider font-semibold ${vsTone(sector.vs)}`}>
            {sector.vs} {delta}
          </span>
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pb-1">
          <BookColHead />
          {sector.holdings.map((h) => (
            <HoldingRow key={h.symbol} h={h} />
          ))}
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
  const stats = DEAN_PORTFOLIO_STATS;
  const comments = useMemo(
    () => [...DEAN_TRADE_UPDATES].sort((a, b) => b.postedAt.localeCompare(a.postedAt)),
    [],
  );

  return (
    <AppShell title="Dual Trend Portfolio">
      <PageHeader
        eyebrow="Turning Point"
        title="Dual Trend Portfolio"
        description="Sleeve Dean posts to Slack. Layout matches the book screenshot; numbers and notes are placeholders until the sheet and #dt_trade_updates are wired."
        actions={
          <MockBadge reason="Holdings copied from a Slack screenshot. Comments are mock posts in the style of #dt_trade_updates. No live feed yet." />
        }
      />

      <div className="px-4 py-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <StatChip label="Total holdings" value={String(stats.holdings)} />
          <StatChip label="Total sectors" value={String(stats.sectors)} />
          <StatChip label="S&P 500 weight" value={pct(stats.spxWeightPct)} />
          <StatChip label="Cash weight" value={pct(stats.cashWeightPct)} />
        </div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Snapshot as of {DEAN_PORTFOLIO_AS_OF} · source screenshot · mock
        </p>

        <div className="space-y-2">
          {DEAN_PORTFOLIO_SECTORS.map((s, i) => (
            <SectorBlock key={s.name} sector={s} defaultOpen={i < 2} />
          ))}
        </div>

        <aside className="hud-panel">
          <div className="px-3 py-2 border-b border-border">
            <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-surface-foreground">
              Trade updates
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">#dt_trade_updates · Dean · mock</div>
          </div>
          <ul className="divide-y divide-border/60">
            {comments.map((c) => (
              <li key={c.id} className="px-3 py-2.5">
                <div className="text-[10px] font-mono text-muted-foreground">{formatCommentTime(c.postedAt)} PT</div>
                <p className="text-xs text-surface-foreground mt-1 leading-relaxed">{c.text}</p>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </AppShell>
  );
}
