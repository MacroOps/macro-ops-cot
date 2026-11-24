import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { SignalBadge, LevelBar } from "@/components/hud/SignalBadge";
import { useTpmrSystems } from "@/hooks/useTpmrSystems";
import { useTpDtPortfolio } from "@/hooks/useTpDtPortfolio";
import { useTctmStatus } from "@/hooks/useTctmStatus";
import { formatShortDate } from "@/lib/tctm/status";

function cashText(n: number | null) {
  return n == null || Number.isNaN(n) ? "—" : `${n.toFixed(2)}%`;
}

function Panel({ title, eyebrow, badge, children }: { title: string; eyebrow?: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="hud-panel flex flex-col">
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
      <div className="p-3 flex-1 flex flex-col">{children}</div>
    </div>
  );
}

export default function MarketOverview() {
  const { data, isLoading, error } = useTpmrSystems();
  const dtBook = useTpDtPortfolio();
  const tctm = useTctmStatus();
  const spx = data?.spx;
  const cashRaw = dtBook.data?.cashWeightPct;
  const cash = cashRaw == null || Number.isNaN(cashRaw) ? null : Math.max(0, Math.min(100, cashRaw));
  const invested = cash == null ? null : 100 - cash;

  return (
    <AppShell title="TPMR · Market Overview">
      <PageHeader
        eyebrow="TurningPoint"
        title="Market Overview"
        description="Dual Trend cash level, TCTM composite status, and cross-system breakdown by index and sector."
      />

      {error && (
        <div className="mx-3 mt-3 rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          Signal API error: {(error as Error).message}
        </div>
      )}

      <div className="p-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Panel
          title="Cash Level"
          eyebrow="1A"
          badge={
            dtBook.data?.asOf ? (
              <span className="text-[9px] text-muted-foreground">{dtBook.data.asOf}</span>
            ) : null
          }
        >
          {dtBook.isLoading ? (
            <div className="py-3 text-xs text-muted-foreground">Loading…</div>
          ) : dtBook.error ? (
            <div className="py-3 text-xs text-destructive">Cash level unavailable</div>
          ) : (
            <div className="flex flex-1 flex-col justify-between gap-4">
              <div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  Dual Trend Portfolio · Cash weight
                </div>
                <div className="mt-1 text-4xl font-semibold tabular-nums text-surface-foreground">
                  {cashText(cash)}
                </div>
              </div>

              <div>
                <div className="flex h-2 overflow-hidden rounded-sm bg-muted/40">
                  <div className="h-full bg-primary" style={{ width: `${cash ?? 0}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-muted-foreground">
                  <span>Cash {cashText(cash)}</span>
                  <span>Invested {cashText(invested)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-2">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Holdings</div>
                  <div className="text-sm tabular-nums text-surface-foreground">
                    {dtBook.data?.holdings ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Sectors</div>
                  <div className="text-sm tabular-nums text-surface-foreground">
                    {dtBook.data?.sectors ?? "—"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title="TCTM 5-Component Status"
          eyebrow="1B"
          badge={
            tctm.data?.asOf ? (
              <span className="text-[9px] text-muted-foreground">{formatShortDate(tctm.data.asOf)}</span>
            ) : null
          }
        >
          {tctm.isLoading ? (
            <div className="py-3 text-xs text-muted-foreground">Loading…</div>
          ) : tctm.error || !tctm.data ? (
            <div className="py-3 text-xs text-destructive">TCTM status unavailable</div>
          ) : (
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 gap-y-0">
              <div className="pb-1 text-[9px] uppercase tracking-wider text-muted-foreground">Model</div>
              <div className="pb-1 text-[9px] uppercase tracking-wider text-muted-foreground">Status</div>
              <div className="pb-1 text-[9px] uppercase tracking-wider text-muted-foreground">Last signal</div>
              <div className="pb-1 text-[9px] uppercase tracking-wider text-muted-foreground text-right">Active</div>
              {tctm.data.rows.map((c) => (
                <div key={c.id} className="contents">
                  <div className="py-1.5 border-t border-border/60 text-[11px] text-surface-foreground">
                    {c.name}
                  </div>
                  <div className="py-1.5 border-t border-border/60">
                    <SignalBadge
                      value={c.state === "neutral" ? "Neutral" : "Triggered"}
                      direction={c.state === "neutral" ? undefined : c.state}
                    />
                  </div>
                  <div className="py-1.5 border-t border-border/60 text-[10px] tabular-nums text-muted-foreground">
                    {formatShortDate(c.signalDate)}
                  </div>
                  <div
                    className="py-1.5 border-t border-border/60 flex items-center justify-end gap-1.5"
                    title={`${c.count} of ${c.total} components active`}
                  >
                    <div className="h-1.5 w-8 rounded-sm bg-muted/40 overflow-hidden">
                      <div
                        className={
                          c.state === "bear"
                            ? "h-full bg-destructive"
                            : c.state === "bull"
                              ? "h-full bg-success"
                              : "h-full bg-muted-foreground/40"
                        }
                        style={{ width: `${c.total ? (c.count / c.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-[10px] tabular-nums text-surface-foreground">
                      {c.count}/{c.total}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Systems Overview by Index"
          eyebrow="1C"
          badge={spx ? <span className="text-[9px] text-muted-foreground">{spx.label}</span> : null}
        >
          {isLoading || !spx ? (
            <div className="py-3 text-xs text-muted-foreground">{isLoading ? "Loading…" : "No data"}</div>
          ) : (
            <div className="grid flex-1 grid-cols-[1fr_auto_auto_auto] grid-rows-[auto_repeat(3,1fr)] items-center gap-x-3">
              <div className="pb-1 text-[9px] uppercase tracking-wider text-muted-foreground">System</div>
              <div className="pb-1 text-[9px] uppercase tracking-wider text-muted-foreground">Status</div>
              <div className="pb-1 text-[9px] uppercase tracking-wider text-muted-foreground">Level</div>
              <div className="pb-1 text-[9px] uppercase tracking-wider text-muted-foreground text-right">Since</div>
              {[
                { key: "riskST", label: "Risk ST", s: spx.riskST },
                { key: "riskLT", label: "Risk LT", s: spx.riskLT },
                { key: "trend", label: "Trend", s: spx.trend },
              ].map(({ key, label, s }) => (
                <div key={key} className="contents">
                  <div className="flex h-full items-center border-t border-border/60 text-[11px] text-surface-foreground">
                    {label}
                  </div>
                  <div className="flex h-full items-center border-t border-border/60">
                    <SignalBadge value={s.signal} />
                  </div>
                  <div className="flex h-full items-center border-t border-border/60">
                    <LevelBar value={s.level} />
                  </div>
                  <div className="flex h-full flex-col items-end justify-center border-t border-border/60 tabular-nums">
                    <span className="text-[10px] text-surface-foreground">{s.date}</span>
                    <span className="text-[9px] text-muted-foreground">{s.days}d</span>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                {isLoading && (
                  <tr><td colSpan={6} className="py-3 text-muted-foreground">Loading…</td></tr>
                )}
                {(data?.sectors ?? []).map((r) => (
                  <tr key={r.code} className="border-t border-border/50">
                    <td className="py-1.5">{r.label}</td>
                    <td className="py-1.5">
                      <div className="flex items-center gap-2">
                        <SignalBadge value={r.riskST.signal} />
                        <LevelBar value={r.riskST.level} />
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">{r.riskST.date} · {r.riskST.days}d</div>
                    </td>
                    <td className="py-1.5">
                      <div className="flex items-center gap-2">
                        <SignalBadge value={r.riskLT.signal} />
                        <LevelBar value={r.riskLT.level} />
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">{r.riskLT.date} · {r.riskLT.days}d</div>
                    </td>
                    <td className="py-1.5">
                      <div className="flex items-center gap-2">
                        <SignalBadge value={r.trend.signal} />
                        <LevelBar value={r.trend.level} />
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">{r.trend.date} · {r.trend.days}d</div>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{r.trend.tLevel}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.trend.rLevel}</td>
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
