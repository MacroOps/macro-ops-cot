import { AppShell } from "@/components/hud/AppShell";

const CLASSIC_HUD_URL = "https://hud.macro-ops.com/";

export default function ClassicHud() {
  return (
    <AppShell title="Classic HUD" hideScrubber hideRibbon fillViewport>
      <div className="flex flex-col h-full min-h-0">
        <div className="shrink-0 h-8 border-b border-border bg-surface" aria-hidden />
        <iframe
          src={CLASSIC_HUD_URL}
          title="Classic HUD"
          className="flex-1 w-full min-h-0 border-0 bg-background"
          loading="eager"
          referrerPolicy="no-referrer"
          allow="fullscreen"
        />
      </div>
    </AppShell>
  );
}
