import { type ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useTheme } from "./ThemeProvider";
import { OutsetaAuthControls } from "./OutsetaAuthControls";
import { Moon, Sun, Circle } from "lucide-react";
import { RegimeRibbon } from "./RegimeRibbon";
import { AlertsInbox } from "./AlertsInbox";
import { GlobalScrubber } from "./GlobalScrubber";

export function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const { theme, toggle } = useTheme();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-11 flex items-center justify-between border-b border-border bg-surface/40 px-3">
            <div className="flex items-center gap-3 min-w-0">
              <SidebarTrigger className="h-7 w-7" />
              <div className="h-4 w-px bg-border" />
              <h1 className="text-[11px] uppercase tracking-[0.16em] text-surface-foreground font-semibold truncate">
                {title}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Circle className="h-2 w-2 fill-success text-success" />
                <span>Live</span>
              </div>
              <div className="hidden md:block h-4 w-px bg-border" />
              <AlertsInbox />
              <OutsetaAuthControls />
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

          <RegimeRibbon />
          <main className="flex-1 overflow-auto">{children}</main>
          <GlobalScrubber />
        </div>
      </div>
    </SidebarProvider>
  );
}
