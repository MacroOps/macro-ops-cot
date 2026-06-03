import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Sparkles, AlertCircle, TrendingUp, TrendingDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface SnapshotRow {
  key: string;
  label: string;
  category: string;
  value: number;
  delta_1w: number;
  percentile: number;
  unit: string;
  flag: string;
  crossed_hi?: boolean;
  crossed_lo?: boolean;
}

interface Briefing {
  id: string;
  briefing_date: string;
  markdown: string;
  snapshot: SnapshotRow[];
  highlights: SnapshotRow[];
  model: string | null;
  created_at: string;
}

const ROUTE_FOR_CATEGORY: Record<string, string> = {
  Trend: "/trend-fragility",
  Risk: "/risk-cycle",
  Breadth: "/breadth/overview",
  Internals: "/market-internals",
  Macro: "/macro/mo-indicators",
};

export default function Briefing() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke("daily-briefing", { method: "GET" });
    if (error) setError(error.message);
    else setBriefing(data);
    setLoading(false);
  }

  async function generate(force = false) {
    setGenerating(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke("daily-briefing", { body: { force } });
    if (error) setError(error.message);
    else if (data?.error) setError(data.error);
    else setBriefing(data);
    setGenerating(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Research"
        title="Daily Briefing"
        subtitle={briefing ? `${briefing.briefing_date} · model ${briefing.model ?? "—"}` : "AI-generated morning brief from the indicator snapshot"}
        actions={
          <div className="flex items-center gap-2">
            {briefing && (
              <Button size="sm" variant="outline" onClick={() => generate(true)} disabled={generating}>
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                <span className="ml-1.5 text-[10px] uppercase tracking-wider">Regenerate</span>
              </Button>
            )}
            {!briefing && !loading && (
              <Button size="sm" onClick={() => generate(false)} disabled={generating}>
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                <span className="ml-1.5 text-[10px] uppercase tracking-wider">Generate Today's Brief</span>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 px-4 pb-8">
        <div className="space-y-4">
          {loading && (
            <div className="hud-panel p-6 flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading briefing…
            </div>
          )}

          {error && (
            <div className="hud-panel p-4 border-destructive/40 flex gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {!loading && !briefing && !error && (
            <div className="hud-panel p-8 text-center space-y-3">
              <Sparkles className="h-8 w-8 mx-auto text-primary" />
              <div className="text-sm">No briefing yet for today.</div>
              <Button onClick={() => generate(false)} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Generate Today's Brief
              </Button>
            </div>
          )}

          {briefing && (
            <div className="hud-panel p-6">
              <div className="prose prose-sm max-w-none prose-headings:text-surface-foreground prose-headings:font-semibold prose-headings:uppercase prose-headings:tracking-wider prose-headings:text-[12px] prose-h2:border-b prose-h2:border-border prose-h2:pb-1 prose-h2:mt-5 prose-h2:mb-3 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-strong:text-surface-foreground">
                <ReactMarkdown>{briefing.markdown}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Snapshot Highlights</div>
          {briefing?.highlights?.map((h) => {
            const route = ROUTE_FOR_CATEGORY[h.category] ?? "/overview";
            const isUp = h.delta_1w >= 0;
            const extreme = h.flag === "extreme-hi" || h.flag === "extreme-lo";
            return (
              <Link
                key={h.key}
                to={route}
                className={cn(
                  "block hud-panel p-3 hover:border-primary transition-colors group",
                  extreme && "border-primary/40",
                )}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wider">{h.label}</div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                </div>
                <div className="flex items-baseline gap-2 font-mono tabular-nums">
                  <span className="text-lg font-semibold">{h.value}{h.unit}</span>
                  <span className={cn("text-[10px] flex items-center", isUp ? "text-success" : "text-destructive")}>
                    {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {isUp ? "+" : ""}{h.delta_1w}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{h.percentile}th</span>
                </div>
                {(h.crossed_hi || h.crossed_lo) && (
                  <div className="mt-1.5 text-[9px] uppercase tracking-wider text-primary font-semibold">
                    ⚠ Crossed {h.crossed_hi ? "upper" : "lower"} threshold
                  </div>
                )}
              </Link>
            );
          })}
          {briefing && (!briefing.highlights || briefing.highlights.length === 0) && (
            <div className="text-[11px] text-muted-foreground italic">No extreme readings today.</div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
