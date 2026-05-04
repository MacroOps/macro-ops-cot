import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/hud/AppShell";
import { useNewsFeed, type NewsItem, type Severity } from "@/hooks/useNewsFeed";
import { SECTORS, type Sector } from "@/lib/mockData";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpRight, ArrowDownRight, AlertTriangle, Zap, ExternalLink, Filter } from "lucide-react";

const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

const sevColor: Record<Severity, string> = {
  high: "bg-[hsl(var(--pos-short))] text-white",
  medium: "bg-[hsl(var(--chart-accent-2))] text-white",
  low: "bg-muted text-muted-foreground",
};

const divLabel: Record<NewsItem["divergence"], string> = {
  "bull-news-down": "Bullish news → tape down",
  "bear-news-up": "Bearish news → tape up",
  aligned: "Aligned",
  neutral: "Neutral",
};

function timeAgo(iso: string) {
  const diff = (Date.now() - +new Date(iso)) / 3600_000;
  if (diff < 1) return `${Math.round(diff * 60)}m ago`;
  if (diff < 24) return `${Math.round(diff)}h ago`;
  return `${Math.round(diff / 24)}d ago`;
}

const News = () => {
  const { data: items, isLoading } = useNewsFeed();
  const [sector, setSector] = useState<Sector | "All">("All");
  const [onlyDivergence, setOnlyDivergence] = useState(true);
  const [minSeverity, setMinSeverity] = useState<Severity | "any">("any");

  const filtered = useMemo(() => {
    if (!items) return [];
    const sevRank: Record<Severity, number> = { low: 1, medium: 2, high: 3 };
    return items.filter(it => {
      if (sector !== "All" && it.sector !== sector) return false;
      if (onlyDivergence && (it.divergence === "aligned" || it.divergence === "neutral")) return false;
      if (minSeverity !== "any" && sevRank[it.severity] < sevRank[minSeverity]) return false;
      return true;
    });
  }, [items, sector, onlyDivergence, minSeverity]);

  const stats = useMemo(() => {
    const total = items?.length ?? 0;
    const divs = items?.filter(i => i.divergence === "bull-news-down" || i.divergence === "bear-news-up") ?? [];
    return {
      total,
      divergences: divs.length,
      high: divs.filter(d => d.severity === "high").length,
      bullDown: divs.filter(d => d.divergence === "bull-news-down").length,
      bearUp: divs.filter(d => d.divergence === "bear-news-up").length,
    };
  }, [items]);

  return (
    <AppShell title="News & Divergence Feed">
      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border p-px">
        <Stat label="Headlines" value={stats.total} />
        <Stat label="Divergences" value={stats.divergences} accent />
        <Stat label="High Severity" value={stats.high} accent />
        <Stat label="Bull News / Tape Down" value={stats.bullDown} />
        <Stat label="Bear News / Tape Up" value={stats.bearUp} />
      </div>

      {/* Filters */}
      <div className="hud-chart border-b border-border px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-chart-ink-muted">
          <Filter className="h-3 w-3" /> Filters
        </div>

        <div className="flex items-center gap-1">
          {(["All", ...SECTORS] as const).map(s => (
            <button
              key={s}
              onClick={() => setSector(s)}
              className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border transition-colors ${
                sector === s
                  ? "bg-chart-ink text-chart-surface border-chart-ink"
                  : "bg-chart-surface text-chart-surface-foreground border-chart-grid hover:border-chart-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-border" />

        <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-chart-surface-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={onlyDivergence}
            onChange={(e) => setOnlyDivergence(e.target.checked)}
            className="accent-[hsl(var(--chart-accent))]"
          />
          Divergences Only
        </label>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-chart-ink-muted">Severity ≥</span>
          {(["any", "low", "medium", "high"] as const).map(s => (
            <button
              key={s}
              onClick={() => setMinSeverity(s)}
              className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border transition-colors ${
                minSeverity === s
                  ? "bg-chart-ink text-chart-surface border-chart-ink"
                  : "bg-chart-surface text-chart-surface-foreground border-chart-grid hover:border-chart-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="hud-chart">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-chart-ink-muted uppercase tracking-wider">
            No headlines match the current filters
          </div>
        ) : (
          <ul className="divide-y divide-chart-grid">
            {filtered.map(it => (
              <FeedRow key={it.id} item={it} />
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
};

function FeedRow({ item }: { item: NewsItem }) {
  const isDiv = item.divergence === "bull-news-down" || item.divergence === "bear-news-up";
  const retPositive = item.observedReturn1d >= 0;
  const ArrowIcon = retPositive ? ArrowUpRight : ArrowDownRight;
  const retColor = retPositive ? "text-[hsl(var(--pos-long))]" : "text-[hsl(var(--pos-short))]";

  return (
    <li className="px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-4">
        {/* Severity rail */}
        <div className="flex flex-col items-center gap-1 pt-1 w-14 shrink-0">
          <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm font-semibold ${sevColor[item.severity]}`}>
            {item.severity}
          </span>
          {isDiv && (
            <span className="text-[hsl(var(--chart-accent-2))]">
              {item.severity === "high" ? <Zap className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-chart-ink-muted mb-1">
            <Link to={`/asset/${item.symbol}`} className="font-mono font-semibold text-chart-ink hover:underline">
              {item.symbol}
            </Link>
            <span>·</span>
            <span>{item.sector}</span>
            <span>·</span>
            <span>{item.source}</span>
            <span>·</span>
            <span>{timeAgo(item.publishedAt)}</span>
          </div>
          <p className="text-sm text-chart-surface-foreground leading-snug">{item.headline}</p>
          <div className="mt-1.5 text-[10px] uppercase tracking-wider text-chart-ink-muted">
            <span className={isDiv ? "text-[hsl(var(--chart-accent-2))] font-semibold" : ""}>
              {divLabel[item.divergence]}
            </span>
            <span className="mx-2">·</span>
            <span>Net Spec %ile (3y): <span className="font-mono text-chart-ink">{item.netSpecPct3y}</span></span>
          </div>
        </div>

        {/* Return */}
        <div className="text-right shrink-0 w-20">
          <div className={`flex items-center justify-end gap-0.5 font-mono text-sm font-semibold ${retColor}`}>
            <ArrowIcon className="h-3.5 w-3.5" />
            {fmtPct(item.observedReturn1d)}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-chart-ink-muted mt-0.5">1d return</div>
        </div>

        <button className="text-chart-ink-muted hover:text-chart-ink shrink-0 mt-1" aria-label="Open source">
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="hud-chart px-4 py-3">
      <div className="text-[9px] uppercase tracking-[0.14em] text-chart-ink-muted">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold ${accent ? "text-[hsl(var(--chart-accent-2))]" : "text-chart-ink"}`}>
        {value}
      </div>
    </div>
  );
}

export default News;
