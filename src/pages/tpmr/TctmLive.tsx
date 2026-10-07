import { Link } from "react-router-dom";
import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import {
  TCTM_LIVE_COMPONENTS,
  TCTM_LIVE_LEAD,
  TCTM_LIVE_SECTIONS,
  TCTM_LIVE_STAGES,
  TCTM_LIVE_UPDATED,
  type TctmTone,
} from "@/lib/tctmLive";

function toneClass(signal: TctmTone) {
  if (signal === "Bullish") return "bg-success/15 text-success border-success/30";
  if (signal === "Bearish") return "bg-destructive/15 text-destructive border-destructive/30";
  return "bg-muted text-muted-foreground border-border";
}

function StageCard({
  label,
  signal,
  date,
  count,
  href,
}: (typeof TCTM_LIVE_STAGES)[number]) {
  const inner = (
    <div className="hud-panel p-3 h-full hover:border-primary/40 transition-colors">
      <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-center gap-2">
        <span className={`inline-flex text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-sm border ${toneClass(signal)}`}>
          {signal}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Date</div>
          <div className="font-mono tabular-nums">{date ?? "—"}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Count</div>
          <div className="font-mono tabular-nums">{count == null ? "—" : `${count}%`}</div>
        </div>
      </div>
    </div>
  );
  if (!href) return inner;
  return (
    <Link to={href} className="block h-full">
      {inner}
    </Link>
  );
}

export default function TctmLive() {
  return (
    <AppShell title="TPMR · TCTM - Live">
      <PageHeader
        eyebrow="TurningPoint · TCTM"
        title="TCTM - Live"
        description={`Dean's manual composite snapshot. Last updated ${TCTM_LIVE_UPDATED}. Charts are static until the next paste.`}
      />

      <div className="p-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {TCTM_LIVE_STAGES.map((s) => (
          <StageCard key={s.id} {...s} />
        ))}
      </div>

      <div className="px-3 pb-3 max-w-5xl">
        <div className="hud-panel p-4 space-y-3">
          {TCTM_LIVE_LEAD.map((p) => (
            <p key={p} className="text-sm leading-relaxed text-surface-foreground/90">
              {p}
            </p>
          ))}
        </div>
      </div>

      <div className="px-3 pb-8 max-w-5xl space-y-6">
        {TCTM_LIVE_SECTIONS.map((section) => (
          <section key={section.title} className="hud-panel overflow-hidden">
            <div className="px-3 py-2 border-b border-border text-[11px] font-semibold uppercase tracking-wider">
              {section.title}
            </div>
            <div className="p-3 space-y-3">
              {section.body.map((p) => (
                <p key={p} className="text-sm leading-relaxed text-surface-foreground/90">
                  {p}
                </p>
              ))}
              {section.images.map((img) => (
                <img
                  key={img.src}
                  src={img.src}
                  alt={img.alt}
                  className="w-full border border-border rounded-sm bg-card"
                />
              ))}
            </div>
          </section>
        ))}

        <section className="hud-panel">
          <div className="px-3 py-2 border-b border-border text-[11px] font-semibold uppercase tracking-wider">
            Component functionality
          </div>
          <div className="divide-y divide-border">
            {TCTM_LIVE_COMPONENTS.map((c, i) => (
              <div key={c.title} className="px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider">
                  {i + 1}. {c.title}
                </div>
                <p className="text-sm text-surface-foreground/90 mt-1 leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
