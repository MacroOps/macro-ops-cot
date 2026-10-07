import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import {
  TCTM_GLOSSARY_BEARISH,
  TCTM_GLOSSARY_BULLISH,
  TCTM_GLOSSARY_COMPONENTS,
  TCTM_GLOSSARY_DUAL_LT,
  TCTM_GLOSSARY_DUAL_ST,
  TCTM_GLOSSARY_METRICS,
  TCTM_GLOSSARY_MODELS,
  TCTM_GLOSSARY_PROCESS,
  TCTM_GLOSSARY_RISK_LT,
  TCTM_GLOSSARY_RISK_ST,
  TCTM_GLOSSARY_TREND_SYSTEM,
  type GlossaryBlock,
} from "@/lib/tctmGlossary";

function Panel({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="hud-panel scroll-mt-4">
      <div className="px-3 py-2 border-b border-border text-[11px] font-semibold uppercase tracking-wider">
        {title}
      </div>
      <div className="p-3 space-y-3">{children}</div>
    </section>
  );
}

function Prose({ children }: { children: string }) {
  return <p className="text-sm leading-relaxed text-surface-foreground/90">{children}</p>;
}

function BlockCopy({ block }: { block: GlossaryBlock }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider">{block.title}</div>
      {block.body.map((p) => (
        <Prose key={p}>{p}</Prose>
      ))}
      {block.bullets && (
        <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed text-surface-foreground/90">
          {block.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const TOC = [
  { href: "#house-view", label: "House View" },
  { href: "#tctm", label: "TCTM" },
  { href: "#risk-trend", label: "Risk-On/Off & Trend" },
  { href: "#dual-trend", label: "Dual Trend" },
  { href: "#process", label: "Process" },
  { href: "#metrics", label: "Signal metrics" },
];

export default function TctmGlossary() {
  return (
    <AppShell title="TPMR · Glossary">
      <PageHeader
        eyebrow="TurningPoint · TCTM"
        title="Glossary"
        description="Dean's Turning Point definitions. Static copy from TPMR, linked to the Terminus guides."
      />

      <div className="px-3 py-3 max-w-5xl space-y-4 pb-10">
        <nav className="flex flex-wrap gap-2">
          {TOC.map((t) => (
            <a
              key={t.href}
              href={t.href}
              className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border border-border text-muted-foreground hover:text-surface-foreground hover:border-primary/40"
            >
              {t.label}
            </a>
          ))}
        </nav>

        <Panel id="house-view" title="House View (Stock Market Outlook)">
          <Prose>
            Turning Point Market Research employs a disciplined framework to shape its market outlook. The House View draws on multiple models to form short- and long-term perspectives for the S&P 500, with primary weight given to the components of the Tactical Composite Trend Model.
          </Prose>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">The models include</div>
            <ul className="list-disc pl-5 space-y-1 text-sm text-surface-foreground/90">
              {TCTM_GLOSSARY_MODELS.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-wider pt-1">Bearish Scenarios</div>
          {TCTM_GLOSSARY_BEARISH.map((b) => (
            <BlockCopy key={b.title} block={b} />
          ))}
          <div className="text-[11px] font-semibold uppercase tracking-wider pt-1">Bullish Scenarios</div>
          {TCTM_GLOSSARY_BULLISH.map((b) => (
            <BlockCopy key={b.title} block={b} />
          ))}
        </Panel>

        <Panel id="tctm" title="Tactical Composite Trend Model (TCTM)">
          <Prose>
            The Tactical Composite Trend Model (TCTM) is a unique, multi-layered system that blends long-term trend-following with market breadth composites to detect critical stock market turning points in advance of significant trend changes.
          </Prose>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Component functionality</div>
          <div className="divide-y divide-border border border-border rounded-sm">
            {TCTM_GLOSSARY_COMPONENTS.map((c, i) => (
              <div key={c.title} className="px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider">
                  {i + 1}. {c.href ? (
                    <Link to={c.href} className="hover:text-primary">
                      {c.title}
                    </Link>
                  ) : (
                    c.title
                  )}
                </div>
                <p className="text-sm text-surface-foreground/90 mt-1 leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
          <Prose>
            Together, these components form a tactical roadmap for navigating market cycles, with each composite offering a distinct insight into the transition between bearish and bullish regimes.
          </Prose>
          <p className="text-sm leading-relaxed text-muted-foreground">
            For a more extensive explanation of the Tactical Composite Trend Model, see{" "}
            <Link to="/tpmr/tctm-live" className="text-surface-foreground underline underline-offset-2 hover:text-primary">
              TCTM - Live
            </Link>{" "}
            and the composite Guides.
          </p>
        </Panel>

        <Panel id="risk-trend" title="Risk-On/Off Models and Trend System">
          <BlockCopy block={TCTM_GLOSSARY_RISK_ST} />
          <BlockCopy block={TCTM_GLOSSARY_RISK_LT} />
          <BlockCopy block={TCTM_GLOSSARY_TREND_SYSTEM} />
        </Panel>

        <Panel id="dual-trend" title="Dual Trend Systems">
          <BlockCopy block={TCTM_GLOSSARY_DUAL_LT} />
          <p className="text-sm">
            <Link to="/tpmr/dual-trend/sp500" className="underline underline-offset-2 hover:text-primary">
              Open Dual Trend universes
            </Link>
          </p>
          <BlockCopy block={TCTM_GLOSSARY_DUAL_ST} />
        </Panel>

        <Panel id="process" title="Dual Trend System Process">
          <Prose>
            Our Dual Trend Systems systematically capture and manage uptrends in stocks by combining short-term and long-term trend confirmation. The process accommodates both investors seeking sustained leadership and traders seeking swing opportunities.
          </Prose>
          {TCTM_GLOSSARY_PROCESS.map((p) => (
            <div key={p.title} className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider">{p.title}</div>
              {p.body.map((line) => (
                <Prose key={line}>{line}</Prose>
              ))}
            </div>
          ))}
          <Prose>
            Flow Summary: Initiation → Transition → Established Uptrend (Investor Hold / Trader Swings) → Risk Management (Short-Term Exit)
          </Prose>
          <Prose>
            By combining these two timeframes, the Dual Trend System adapts to different market conditions and objectives, enabling investors to stay with leading stocks through durable uptrends while providing traders with a structure to capture repeatable swing opportunities.
          </Prose>
        </Panel>

        <Panel id="metrics" title="Signal Performance Metrics">
          <div className="divide-y divide-border border border-border rounded-sm">
            {TCTM_GLOSSARY_METRICS.map((m) => (
              <div key={m.term} className="grid grid-cols-1 sm:grid-cols-[11rem_1fr] gap-1 sm:gap-3 px-3 py-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider">{m.term}</div>
                <p className="text-sm leading-relaxed text-surface-foreground/90">{m.body}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
