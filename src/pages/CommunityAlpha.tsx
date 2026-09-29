import { useEffect, useRef, useState } from "react";
import { useOutseta } from "@outseta/react";
import { AppShell } from "@/components/hud/AppShell";
import { outsetaEdgePost } from "@/lib/outseta/edge";
import { mountDashboard } from "./communityAlphaDashboard";
import "./community-alpha.css";

type Mode = "live" | "staging";
type Payload = { generated_at: string | null; days: unknown[] };

const MODE_KEY = "ca-data-mode";

export default function CommunityAlpha() {
  const { user } = useOutseta();
  const [mode, setMode] = useState<Mode>(() => {
    try { return sessionStorage.getItem(MODE_KEY) === "staging" ? "staging" : "live"; } catch { return "live"; }
  });
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dateListRef = useRef<HTMLUListElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { document.title = "Community Alpha — Terminus"; }, []);

  useEffect(() => {
    try { sessionStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
    if (!user) return;
    let cancelled = false;
    setData(null);
    setError(null);
    outsetaEdgePost<Payload>("community-alpha-read", { mode })
      .then((d) => { if (!cancelled) setData({ generated_at: d.generated_at, days: d.days ?? [] }); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [mode, user]);

  useEffect(() => {
    if (!data || !dateListRef.current || !mainRef.current || !searchRef.current || !clearRef.current) return;
    searchRef.current.value = "";
    clearRef.current.classList.remove("visible");
    return mountDashboard(
      { dateList: dateListRef.current, main: mainRef.current, search: searchRef.current, searchClear: clearRef.current },
      data,
    );
  }, [data]);

  const ready = !!user && !!data && !error;

  return (
    <AppShell title="Community Alpha" hideScrubber hideRibbon fillViewport>
    <div className="ca-page">
      <div className="ca-inner">
      {mode === "staging" && <div className="ca-staging-banner" role="status">STAGING — test data</div>}
      <header className="app-header">
        <div className="ca-mode" role="group" aria-label="Data source">
          <button type="button" className={mode === "live" ? "on" : ""} aria-pressed={mode === "live"} onClick={() => setMode("live")}>Live</button>
          <button type="button" className={mode === "staging" ? "on" : ""} aria-pressed={mode === "staging"} onClick={() => setMode("staging")}>Staging</button>
        </div>
        <div className="search-side" style={ready ? undefined : { visibility: "hidden" }}>
          <span className="search-hint">Press <kbd>/</kbd> to search</span>
          <div className="search-wrap">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="7" /><path d="m21 21-3.5-3.5" /></svg>
            <input ref={searchRef} type="text" id="search" className="search-input" placeholder="Search ticker, member, channel, keyword…" autoComplete="off" spellCheck={false} />
            <button ref={clearRef} className="search-clear" id="search-clear" aria-label="Clear search" title="Clear search (Esc)">&times;</button>
          </div>
        </div>
      </header>

      {error ? (
        <div className="ca-status">Couldn't load Community Alpha: {error}</div>
      ) : !data ? (
        <div className="ca-status">Loading…</div>
      ) : null}

      <div className="layout" style={ready ? undefined : { display: "none" }}>
        <aside className="sidebar">
          <div className="sidebar-header">Weekly digests</div>
          <ul className="date-list" id="date-list" ref={dateListRef} />
        </aside>
        <main className="main">
          <div className="main-inner" id="main" ref={mainRef} />
        </main>
      </div>
      </div>
    </div>
    </AppShell>
  );
}
