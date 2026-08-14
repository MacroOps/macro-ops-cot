import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { SignalBadge, LevelBar, DeltaCell } from "@/components/hud/SignalBadge";
import { MockBadge } from "@/components/hud/MockBadge";
import { useTpmrSystems } from "@/hooks/useTpmrSystems";
import {
  TCTM_STATUS,
  PERF_RISK_LT,
  PERF_RISK_ST,
  PERF_TCTM_LT,
  TCTM_THRESHOLDS,
  type ModelPerfRow,
} from "@/lib/turningPointSpecs";

function Panel({ title, eyebrow, badge, children }: { title: string; eyebrow?: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="hud-panel">
      <div className="px-3 py-2 border-b border-border flex items-start justify-between gap-2">
        <div>
          {eyebrow && (
            <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              {eyebrow}
            </div>
          )}
          <div className="text-[11px] font-semibold uppercase tracking-wider text-surface-foreground">
            {title}
          </div>
        </div>
        {badge}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function PerfTable({ rows }: { rows: ModelPerfRow[] }) {
  return (
    <table className="w-full text-xs">
      <thead className="text-[9px] uppercase tracking-wider text-muted-foreground">
        <tr>
          <th className="text-left font-medium py-1">Signal</th>
          <th className="text-right font-medium py-1">Ann. Return</th>
          <th className="text-right font-medium py-1">% of Time</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.signal} className="border-t border-border/50">
            <td className="py-1.5">{r.signal}</td>
            <td className={`py-1.5 text-right font-mono tabular-nums ${r.annReturn >= 0 ? "text-success" : "text-destructive"}`}>
              {r.annReturn > 0 ? "+" : ""}
              {r.annReturn.toFixed(1)}%
            </td>
            <td className="py-1.5 text-right font-mono tabular-nums">{r.pctTime}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function MarketOverview() {
  return (
    <AppShell title="TPMR · Market Overview">
      <PageHeader
        eyebrow="TurningPoint"
        title="Market Overview"
        description="Top-level directional call, TCTM composite status, and cross-system breakdown by index and sector."
      />

      <div className="p-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Panel title="House View" eyebrow="1A">
          <table className="w-full text-xs">
            <thead className="text-[9px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-medium py-1">Horizon</th>
                <th className="text-left font-medium py-1">Direction</th>
                <th className="text-right font-medium py-1">Signal Date</th>
              </tr>
            </thead>
            <tbody>
              {HOUSE_VIEW.map((r) => (
                <tr key={r.type} className="border-t border-border/50">
                  <td className="py-2">{r.type}</td>
                  <td className="py-2"><SignalBadge value={r.direction} /></td>
                  <td className="py-2 text-right font-mono tabular-nums">{r.signalDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="TCTM 5-Component Status" eyebrow="1B">
          <div className="grid grid-cols-5 gap-2">
            {TCTM_STATUS.map((c) => (
              <div key={c.name} className="border border-border/60 rounded-sm p-2">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground truncate">
                  {c.name}
                </div>
                <div className="mt-1"><SignalBadge value={c.signal} /></div>
                <div className="mt-1 text-[10px] font-mono text-muted-foreground">{c.signalDate}</div>
                <div className="mt-1 font-mono text-xs tabular-nums">
                  {c.count}/{c.total}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Systems Overview by Index" eyebrow="1C">
          <table className="w-full text-xs">
            <thead className="text-[9px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left py-1 font-medium">Index</th>
                <th className="text-left py-1 font-medium">Risk ST</th>
                <th className="text-left py-1 font-medium">Risk LT</th>
                <th className="text-left py-1 font-medium">Trend</th>
              </tr>
            </thead>
            <tbody>
              {INDEX_SYSTEMS.map((r) => (
                <tr key={r.index} className="border-t border-border/50">
                  <td className="py-1.5 font-medium">{r.index}</td>
                  {[r.riskST, r.riskLT, r.trend].map((s, i) => (
                    <td key={i} className="py-1.5">
                      <div className="flex items-center gap-2">
                        <SignalBadge value={s.signal} />
                        <LevelBar value={s.level} />
                      </div>
                      <div className="text-[9px] font-mono text-muted-foreground mt-0.5">
                        {s.date} · {s.days}d
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <div className="px-3 pb-3">
        <Panel title="Sector Analysis — All Systems" eyebrow="1D">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[820px]">
              <thead className="text-[9px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left py-1 font-medium">Sector</th>
                  <th className="text-left py-1 font-medium">Risk ST</th>
                  <th className="text-left py-1 font-medium">Risk LT</th>
                  <th className="text-left py-1 font-medium">Trend</th>
                  <th className="text-right py-1 font-medium">T-Level</th>
                  <th className="text-right py-1 font-medium">R-Level</th>
                </tr>
              </thead>
              <tbody>
                {SECTOR_SYSTEMS.map((r) => (
                  <tr key={r.sector} className="border-t border-border/50">
                    <td className="py-1.5">{r.sector}</td>
                    <td className="py-1.5">
                      <div className="flex items-center gap-2">
                        <SignalBadge value={r.riskST.signal} />
                        <LevelBar value={r.riskST.level} />
                      </div>
                      <div className="text-[9px] font-mono text-muted-foreground mt-0.5">{r.riskST.date}</div>
                    </td>
                    <td className="py-1.5">
                      <div className="flex items-center gap-2">
                        <SignalBadge value={r.riskLT.signal} />
                        <LevelBar value={r.riskLT.level} />
                      </div>
                      <div className="text-[9px] font-mono text-muted-foreground mt-0.5">{r.riskLT.date}</div>
                    </td>
                    <td className="py-1.5">
                      <div className="flex items-center gap-2">
                        <SignalBadge value={r.trend.signal} />
                        <LevelBar value={r.trend.level} />
                      </div>
                      <div className="text-[9px] font-mono text-muted-foreground mt-0.5">{r.trend.date}</div>
                    </td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{r.trend.tLevel}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{r.trend.rLevel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="px-3 pb-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Panel title="Risk On/Off (LT) Performance" eyebrow="1E"><PerfTable rows={PERF_RISK_LT} /></Panel>
        <Panel title="Risk On/Off (ST) Performance" eyebrow="1E"><PerfTable rows={PERF_RISK_ST} /></Panel>
        <Panel title="TCTM (LT) Performance" eyebrow="1E"><PerfTable rows={PERF_TCTM_LT} /></Panel>
      </div>

      <div className="px-3 pb-6">
        <Panel title="TCTM Threshold Conditions" eyebrow="1E">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[520px]">
              <thead className="text-[9px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left py-1 font-medium">Condition</th>
                  <th className="text-left py-1 font-medium">Threshold</th>
                  <th className="text-right py-1 font-medium">Ann. Return</th>
                  <th className="text-right py-1 font-medium">% of Time</th>
                </tr>
              </thead>
              <tbody>
                {TCTM_THRESHOLDS.map((r, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="py-1.5">{r.condition}</td>
                    <td className="py-1.5 font-mono">{r.threshold}</td>
                    <td className={`py-1.5 text-right font-mono tabular-nums ${r.annReturn >= 0 ? "text-success" : "text-destructive"}`}>
                      {r.annReturn > 0 ? "+" : ""}
                      {r.annReturn.toFixed(1)}%
                    </td>
                    <td className="py-1.5 text-right font-mono tabular-nums">
                      <DeltaCell value={null} />
                      <span className="ml-1">{r.pctTime}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
