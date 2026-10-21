import { useEffect, useState } from "react";
import { AppShell } from "@/components/hud/AppShell";

const CLASSIC_HUD_URL = "https://hud.macro-ops.com/";

export default function ClassicHud() {
  const [ready, setReady] = useState(false);
  const [showWait, setShowWait] = useState(true);

  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => setShowWait(false), 400);
    return () => window.clearTimeout(t);
  }, [ready]);

  return (
    <AppShell title="Classic HUD" hideScrubber hideRibbon fillViewport>
      <div className="flex flex-col h-full min-h-0">
        <div className="shrink-0 h-8 border-b border-border bg-surface" aria-hidden />
        <div className="relative flex-1 min-h-0" aria-busy={!ready}>
          {showWait && (
            <div
              className={`absolute inset-0 z-10 flex items-center justify-center bg-background transition-opacity duration-300 ${
                ready ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}
            >
              <div className="flex flex-col items-center gap-3 px-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-accent-deep">
                  Classic HUD
                </div>
                <div className="text-[11px] text-muted-foreground">Loading the live book</div>
                <div className="relative h-px w-40 overflow-hidden bg-ledger">
                  <div className="absolute inset-y-0 w-1/3 bg-accent animate-hud-ledger" />
                </div>
              </div>
            </div>
          )}
          <iframe
            src={CLASSIC_HUD_URL}
            title="Classic HUD"
            className="absolute inset-0 h-full w-full border-0 bg-background"
            loading="eager"
            referrerPolicy="no-referrer"
            allow="fullscreen"
            onLoad={() => setReady(true)}
          />
        </div>
      </div>
    </AppShell>
  );
}
