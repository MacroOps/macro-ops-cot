import { useEffect, useRef, useState } from "react";
import { useOutseta } from "@outseta/react";
import { Search, X } from "lucide-react";
import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEntitlements } from "@/hooks/useCollectiveAccess";
import { outsetaEdgePost } from "@/lib/outseta/edge";
import { mountDashboard } from "./communityAlphaDashboard";
import "./community-alpha.css";

type Mode = "live" | "staging";
type Payload = { generated_at: string | null; days: unknown[] };

const MODE_KEY = "ca-data-mode";

export default function CommunityAlpha() {
  const { user } = useOutseta();
  const { isStaff } = useEntitlements();
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
    if (!isStaff && mode === "staging") setMode("live");
  }, [isStaff, mode]);

  useEffect(() => {
    try { sessionStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
    if (!user) return;
    if (mode === "staging" && !isStaff) return;
    let cancelled = false;
    setData(null);
    setError(null);
    outsetaEdgePost<Payload>("community-alpha-read", { mode })
      .then((d) => { if (!cancelled) setData({ generated_at: d.generated_at, days: d.days ?? [] }); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [mode, user, isStaff]);

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
          {isStaff && mode === "staging" && <div className="ca-staging-banner" role="status">STAGING — test data</div>}
          <PageHeader
            eyebrow="Research"
            title="Community Alpha"
            actions={(
              <div className="ca-header-actions">
                <div className="search-side" style={ready ? undefined : { visibility: "hidden" }}>
                  <span className="search-hint">Press <kbd>/</kbd> to search</span>
                  <div className="search-wrap">
                    <Search className="search-icon" aria-hidden="true" />
                    <Input ref={searchRef} type="text" id="search" className="search-input" placeholder="Search ticker, member, channel, keyword…" autoComplete="off" spellCheck={false} />
                    <Button ref={clearRef} type="button" variant="ghost" size="icon" className="search-clear" id="search-clear" aria-label="Clear search" title="Clear search (Esc)">
                      <X aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                {isStaff && (
                  <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
                    <TabsList className="ca-mode" aria-label="Data source">
                      <TabsTrigger value="live" aria-pressed={mode === "live"}>Live</TabsTrigger>
                      <TabsTrigger value="staging" aria-pressed={mode === "staging"}>Staging</TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
              </div>
            )}
          />

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
