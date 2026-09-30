import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useTheme } from "./ThemeProvider";
import { PaywallGate } from "./PaywallGate";
import { Moon, Sun, Circle } from "lucide-react";
import { RegimeRibbon } from "./RegimeRibbon";
import { AlertsInbox } from "./AlertsInbox";
import { GlobalScrubber } from "./GlobalScrubber";
import { useEntitlements } from "@/hooks/useCollectiveAccess";
import { canAccessPath, homePath, type ViewAsMode } from "@/lib/outseta/entitlements";

function viewAsLabel(mode: ViewAsMode) {
  if (mode === "collective") return "Collective";
  if (mode === "tp") return "Turning Point";
  return "Staff";
}

function ShellHeader({
  title,
  showSidebarTrigger,
  showAlerts,
  viewAsHint,
}: {
  title: string;
  showSidebarTrigger: boolean;
  showAlerts: boolean;
  viewAsHint?: ViewAsMode | null;
}) {
  const { theme, toggle } = useTheme();

  return (
    <header className="h-11 flex items-center justify-between border-b border-border bg-surface/40 px-3">
      <div className="flex items-center gap-3 min-w-0">
        {showSidebarTrigger && <SidebarTrigger className="h-7 w-7" />}
        {showSidebarTrigger && <div className="h-4 w-px bg-border" />}
        <h1 className="text-[11px] uppercase tracking-[0.16em] text-surface-foreground font-semibold truncate">
          {title}
        </h1>
        {viewAsHint && viewAsHint !== "staff" && (
          <span className="shrink-0 text-[9px] uppercase tracking-wider text-muted-foreground border border-border px-1.5 py-0.5 rounded-sm">
            View as {viewAsLabel(viewAsHint)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Circle className="h-2 w-2 fill-success text-success" />
          <span>Live</span>
        </div>
        <div className="hidden md:block h-4 w-px bg-border" />
        {showAlerts && <AlertsInbox />}
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-1 border border-border rounded-sm hover:bg-muted transition-colors"
          aria-label="Toggle theme"
        >
          {theme === "light" ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
          <span className="hidden sm:inline">{theme === "light" ? "Light" : "Dark"}</span>
        </button>
      </div>
    </header>
  );
}

export function AppShell({
  children,
  title,
  hideScrubber = false,
  hideRibbon = false,
  fillViewport = false,
}: {
  children: ReactNode;
  title: string;
  hideScrubber?: boolean;
  hideRibbon?: boolean;
  fillViewport?: boolean;
}) {
  const { isLoading, signedIn, hasAccess, isCollective, isTurningPoint, isStaff, canViewAs, viewAs } = useEntitlements();
  const { pathname } = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col w-full bg-background">
        <ShellHeader title={title} showSidebarTrigger={false} showAlerts={false} />
        <div className="flex-1 flex items-center justify-center text-[10px] uppercase tracking-wider text-muted-foreground">
          Loading
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex flex-col w-full bg-background">
        <ShellHeader title={title} showSidebarTrigger={false} showAlerts={false} />
        <PaywallGate signedIn={signedIn} />
      </div>
    );
  }

  const flags = { isCollective, isTurningPoint, isStaff };
  if (!canAccessPath(pathname, flags)) {
    return <Navigate to={homePath(flags)} replace />;
  }

  return (
    <SidebarProvider>
      <div className={`${fillViewport ? "h-screen" : "min-h-screen"} flex w-full bg-background`}>
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <ShellHeader
            title={title}
            showSidebarTrigger
            showAlerts
            viewAsHint={canViewAs ? viewAs : null}
          />
          {!hideRibbon && <RegimeRibbon />}
          <main
            className={
              fillViewport ? "flex-1 min-h-0 overflow-hidden flex flex-col" : "flex-1 overflow-auto"
            }
          >
            {children}
          </main>
          {!hideScrubber && <GlobalScrubber />}
        </div>
      </div>
    </SidebarProvider>
  );
}
