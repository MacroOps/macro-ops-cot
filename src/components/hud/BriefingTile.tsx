import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  briefing_date: string;
  markdown: string;
  highlights: SnapshotRow[];
}

/** First-paragraph extractor from the briefing markdown */
function firstParagraph(md: string): string {
  const lines = md.split("\n");
  let buf: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) continue;
    if (!trimmed) {
      if (buf.length) break;
      continue;
    }
    buf.push(trimmed);
    if (buf.join(" ").length > 220) break;
  }
  return buf.join(" ");
}

export function BriefingTile() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.functions
      .invoke("daily-briefing", { method: "GET" })
      .then(({ data }) => setBriefing(data))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const isToday = briefing?.briefing_date === today;
  const teaser = briefing ? firstParagraph(briefing.markdown) : null;
  const topHighlights = briefing?.highlights?.slice(0, 3) ?? [];

  return (
    <Link
      to="/briefing"
      className="block hud-panel p-4 hover:border-primary transition-colors group relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full" />

      <div className="relative flex items-start gap-3">
        <div className="h-8 w-8 rounded-sm bg-primary/15 grid place-items-center shrink-0">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-[10px] uppercase tracking-[0.16em] text-primary font-semibold">
              Daily Briefing
            </div>
            {isToday && (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-success/15 text-success rounded-sm font-mono">
                ● Live
              </span>
            )}
            {!isToday && briefing && (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-muted text-muted-foreground rounded-sm font-mono">
                {briefing.briefing_date}
              </span>
            )}
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </div>
          )}

          {!loading && !briefing && (
            <div className="text-xs text-muted-foreground">
              No briefing yet for today.
              <span className="ml-2 text-primary group-hover:underline">
                Generate now →
              </span>
            </div>
          )}

          {!loading && teaser && (
            <p className="text-xs text-surface-foreground line-clamp-2 leading-relaxed">
              {teaser}
            </p>
          )}

          {topHighlights.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {topHighlights.map((h) => {
                const extreme = h.flag === "extreme-hi" || h.flag === "extreme-lo";
                return (
                  <span
                    key={h.key}
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm border ${
                      extreme
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-surface-2/60 text-muted-foreground"
                    }`}
                  >
                    {h.label} {h.value}{h.unit} · {h.percentile}th
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
      </div>
    </Link>
  );
}
