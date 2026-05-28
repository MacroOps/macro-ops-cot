import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { SignalBadge } from "@/components/hud/SignalBadge";
import { TCTM_GUIDES } from "@/lib/turningPointSpecs";

export default function TctmGuide({ slug }: { slug: keyof typeof TCTM_GUIDES }) {
  const g = TCTM_GUIDES[slug];
  return (
    <AppShell title={`TPMR · ${g.title}`}>
      <PageHeader eyebrow="TurningPoint · TCTM" title={g.title} description={g.short} />

      <div className="p-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="hud-panel lg:col-span-2">
          <div className="px-3 py-2 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-surface-foreground">
            How It Works
          </div>
          <div className="p-3 text-xs text-surface-foreground/90 leading-relaxed space-y-2">
            <p>{g.howItWorks}</p>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground pt-2">Trigger Threshold</div>
            <div className="font-mono text-xs">{g.threshold}</div>
          </div>
        </div>

        <div className="hud-panel">
          <div className="px-3 py-2 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-surface-foreground">
            Composite Status
          </div>
          <div className="p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current</div>
            <SignalBadge value="Neutral" />
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground pt-2">Components</div>
            <div className="font-mono text-2xl tabular-nums">
              {Math.round(g.components.length * 0.3)}<span className="text-muted-foreground text-base"> / {g.components.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 pb-3">
        <div className="hud-panel">
          <div className="px-3 py-2 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-surface-foreground">
            Component Definitions
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[9px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left py-1 px-3 font-medium w-1/3">Component</th>
                  <th className="text-left py-1 px-3 font-medium">Definition</th>
                </tr>
              </thead>
              <tbody>
                {g.components.map((c) => (
                  <tr key={c.name} className="border-t border-border/50">
                    <td className="py-1.5 px-3 font-medium">{c.name}</td>
                    <td className="py-1.5 px-3 text-surface-foreground/90">{c.definition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="px-3 pb-6">
        <div className="hud-panel">
          <div className="px-3 py-2 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-surface-foreground">
            Component Signals Across Bear Markets &amp; Corrections
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[9px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left py-1 px-3 font-medium">Event</th>
                  <th className="text-left py-1 px-3 font-medium">Date</th>
                  <th className="text-right py-1 px-3 font-medium">Triggered</th>
                  <th className="text-right py-1 px-3 font-medium">Signal</th>
                </tr>
              </thead>
              <tbody>
                {g.history.map((h, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="py-1.5 px-3">{h.event}</td>
                    <td className="py-1.5 px-3 font-mono">{h.date}</td>
                    <td className="py-1.5 px-3 text-right font-mono tabular-nums">
                      {h.triggered}/{h.total}
                    </td>
                    <td className="py-1.5 px-3 text-right">
                      <SignalBadge value={h.signal ? "Triggered" : "Neutral"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
