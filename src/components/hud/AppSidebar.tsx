import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Layers,
  Newspaper,
  FlaskConical,
  Settings,
  LogOut,
  LayoutDashboard,
  Waves,
  Gauge,
  Network,
  GitBranch,
  LineChart,
  Calculator,
  ChevronDown,
  Compass,
  Crosshair,
  ShieldAlert,
  Globe2,
  LayoutGrid,
  Plus,
  Sparkles,
  Bell,
  Telescope,
  Flame,
} from "lucide-react";
import { listWorkspaces, createWorkspace } from "@/lib/workspaces";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useOutseta } from "@outseta/react";

type Leaf = { title: string; url: string };
type Group = { title: string; icon: any; url?: string; children?: Leaf[] };

const NAV: Group[] = [
  { title: "Overview", icon: LayoutDashboard, url: "/overview" },
  { title: "Daily Briefing", icon: Sparkles, url: "/briefing" },
  { title: "Heatmap", icon: Flame, url: "/heatmap" },
  { title: "Analogs", icon: Telescope, url: "/analogs" },
  { title: "Alerts", icon: Bell, url: "/alerts" },
  { title: "Backtests Lab", icon: FlaskConical, url: "/backtests" },
  { title: "Trend Fragility", icon: GitBranch, url: "/trend-fragility" },
  { title: "Risk Cycle", icon: Gauge, url: "/risk-cycle" },
  { title: "Market Internals", icon: Network, url: "/market-internals" },
  {
    title: "Breadth",
    icon: Waves,
    children: [
      { title: "Overview", url: "/breadth/overview" },
      { title: "Components", url: "/breadth/components" },
      { title: "Thrusts", url: "/breadth/thrusts" },
      { title: "Capitulation", url: "/breadth/capitulation" },
    ],
  },
  {
    title: "Positioning (CoT)",
    icon: Activity,
    children: [
      { title: "Global Positioning", url: "/" },
      { title: "Asset Detail", url: "/asset/ES" },
      { title: "Sector Aggregates", url: "/sectors" },
      { title: "News & Divergence", url: "/news" },
      { title: "Eurex Positioning", url: "/eurex" },
      { title: "Offsides (Extremes)", url: "/offsides" },
    ],
  },
  {
    title: "Macro",
    icon: LineChart,
    children: [
      { title: "MO Indicators", url: "/macro/mo-indicators" },
      { title: "US Growth", url: "/macro/us-growth" },
      { title: "Labor", url: "/macro/labor" },
      { title: "Global Growth", url: "/macro/global-growth" },
      { title: "Liquidity", url: "/macro/liquidity" },
      { title: "Inflation", url: "/macro/inflation" },
      { title: "Recession", url: "/macro/recession" },
      { title: "Implied Regime", url: "/macro/implied-regime" },
    ],
  },
  {
    title: "Tools",
    icon: Calculator,
    children: [{ title: "Position Sizing", url: "/tools/position-sizing" }],
  },
  { title: "TPMR Overview", icon: Compass, url: "/tpmr/market-overview" },
  {
    title: "Dual Trend",
    icon: Crosshair,
    children: [
      { title: "S&P 500", url: "/tpmr/dual-trend/sp500" },
      { title: "S&P 400", url: "/tpmr/dual-trend/sp400" },
      { title: "S&P 600", url: "/tpmr/dual-trend/sp600" },
      { title: "ETFs", url: "/tpmr/dual-trend/etfs" },
      { title: "Gold & Silver Miners", url: "/tpmr/dual-trend/gold-silver-miners" },
      { title: "Large Cap Cyclical", url: "/tpmr/dual-trend/large-cap-cyclical" },
      { title: "Thematic Stocks", url: "/tpmr/dual-trend/thematic" },
    ],
  },
  {
    title: "TCTM Guides",
    icon: ShieldAlert,
    children: [
      { title: "Risk-Off", url: "/tpmr/tctm/risk-off" },
      { title: "Capitulation", url: "/tpmr/tctm/capitulation" },
      { title: "Bottom", url: "/tpmr/tctm/bottom" },
      { title: "Thrust", url: "/tpmr/tctm/thrust" },
      { title: "Confirmation", url: "/tpmr/tctm/confirmation" },
    ],
  },
  {
    title: "Signals Lab",
    icon: Globe2,
    children: [
      { title: "Explorer", url: "/signals/explorer" },
      { title: "Scanner", url: "/signals/scanner" },
      { title: "Rankings", url: "/signals/rankings" },
      { title: "Breadth", url: "/tp/breadth" },
      { title: "Trend Signals", url: "/tp/trend-signals" },
      { title: "Risk Composite", url: "/tp/risk-composite" },
      { title: "Sector Trends", url: "/tp/sector-trends" },
    ],
  },
];

function isLeafActive(pathname: string, url: string) {
  if (url === "/") return pathname === "/";
  if (url.startsWith("/asset/")) return pathname.startsWith("/asset/");
  return pathname === url || pathname.startsWith(url + "/");
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="h-7 w-7 rounded-sm bg-primary flex items-center justify-center text-primary-foreground font-mono text-xs font-bold">
            FR
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-surface-foreground">
                Foundation Research
              </span>
              <span className="text-[9px] text-muted-foreground tracking-widest uppercase">
                Terminus Platform
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.14em]">
            Workspaces
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) =>
                item.children ? (
                  <NavGroup
                    key={item.title}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                  />
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isLeafActive(pathname, item.url!)}
                      tooltip={item.title}
                    >
                      <NavLink to={item.url!} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="text-xs">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <WorkspacesGroup collapsed={collapsed} pathname={pathname} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <AccountFooter collapsed={collapsed} />
      </SidebarFooter>
    </Sidebar>
  );
}

function AccountFooter({ collapsed }: { collapsed: boolean }) {
  const { user, openProfile, logout } = useOutseta();
  const name = user?.FullName || user?.FirstName || user?.Email?.split("@")[0] || "Account";
  const initial = (name.trim()[0] || "U").toUpperCase();

  return (
    <div className={`flex items-center gap-0.5 ${collapsed ? "flex-col" : ""}`}>
      <button
        type="button"
        onClick={() => openProfile({ tab: "profile" })}
        className="flex flex-1 min-w-0 items-center gap-2 rounded-sm px-1.5 py-1.5 hover:bg-sidebar-accent text-left"
        aria-label="Profile"
        title="Profile"
      >
        <div className="h-7 w-7 shrink-0 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold text-surface-foreground">
          {initial}
        </div>
        {!collapsed && (
          <span className="truncate text-xs text-sidebar-foreground">{name}</span>
        )}
      </button>
      <button
        type="button"
        className="p-1.5 rounded-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        aria-label="Settings"
        title="Settings (coming soon)"
      >
        <Settings className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={logout}
        className="p-1.5 rounded-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

function WorkspacesGroup({ collapsed, pathname }: { collapsed: boolean; pathname: string }) {
  const [ver, setVer] = useState(0);
  useEffect(() => {
    const h = () => setVer((x) => x + 1);
    window.addEventListener("mhud:workspaces-changed", h);
    return () => window.removeEventListener("mhud:workspaces-changed", h);
  }, []);
  const workspaces = useMemo(() => {
    void ver;
    return listWorkspaces();
  }, [ver]);

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.14em] flex items-center justify-between">
        <span>My Workspaces</span>
        {!collapsed && (
          <NavLink to="/workspace" className="text-muted-foreground hover:text-primary">
            <LayoutGrid className="h-3 w-3" />
          </NavLink>
        )}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {workspaces.length === 0 && !collapsed && (
            <div className="px-2 py-1 text-[10px] text-muted-foreground italic">No workspaces. Pin a chart to start.</div>
          )}
          {workspaces.map((w) => (
            <SidebarMenuItem key={w.id}>
              <SidebarMenuButton
                asChild
                isActive={pathname === `/workspace/${w.id}`}
                tooltip={w.name}
              >
                <NavLink to={`/workspace/${w.id}`} className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="text-xs truncate flex-1">{w.name}</span>
                      <span className="text-[9px] font-mono text-muted-foreground">{w.items.length}</span>
                    </>
                  )}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          {!collapsed && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  const name = prompt("Workspace name", "New Workspace");
                  if (name) createWorkspace(name);
                }}
                tooltip="New workspace"
              >
                <Plus className="h-4 w-4" />
                <span className="text-xs">New workspace</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function NavGroup({
  item,
  pathname,
  collapsed,
}: {
  item: Group;
  pathname: string;
  collapsed: boolean;
}) {
  const hasActiveChild = !!item.children?.some((c) => isLeafActive(pathname, c.url));
  const [open, setOpen] = useState(hasActiveChild);

  useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  if (collapsed) {
    // In collapsed/icon mode, show parent icon as a button (links to first child)
    const first = item.children![0];
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={hasActiveChild}
          tooltip={item.title}
        >
          <NavLink to={first.url} className="flex items-center gap-2">
            <item.icon className="h-4 w-4 shrink-0" />
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={hasActiveChild}
            tooltip={item.title}
            className="w-full"
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="text-xs flex-1 text-left">{item.title}</span>
            <ChevronDown
              className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children!.map((c) => (
              <SidebarMenuSubItem key={c.url}>
                <SidebarMenuSubButton asChild isActive={isLeafActive(pathname, c.url)}>
                  <NavLink to={c.url} className="text-xs">
                    {c.title}
                  </NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
