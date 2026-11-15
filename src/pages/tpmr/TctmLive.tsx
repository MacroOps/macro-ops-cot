import { useCallback, useEffect, useRef } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { mountTctm } from "@/lib/tctm/dashboard.js";
import "./tctm-live.css";

export default function TctmLive() {
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanup.current?.();
      cleanup.current = null;
    };
  }, []);

  // AppShell renders this div only after entitlements resolve, so a mount
  // effect on first paint would see a null ref and never retry.
  const setHost = useCallback((el: HTMLDivElement | null) => {
    if (cleanup.current) {
      cleanup.current();
      cleanup.current = null;
    }
    if (el) cleanup.current = mountTctm(el);
  }, []);

  return (
    <AppShell title="TPMR · TCTM - Live" hideRibbon hideScrubber>
      <div ref={setHost} className="tctm-app" />
    </AppShell>
  );
}
