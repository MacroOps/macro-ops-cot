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
  Users,
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
import { useEntitlements } from "@/hooks/useCollectiveAccess";
import { canAccessTier, type AccessFlags, type AccessTier, type ViewAsMode } from "@/lib/outseta/entitlements";

type Leaf = { title: string; url: string; access?: AccessTier };
type Group = { title: string; icon: any; url?: string; access?: AccessTier; children?: Leaf[] };

const NAV: Group[] = [
  { title: "Overview", icon: LayoutDashboard, url: "/overview", access: "staff" },
  { title: "Classic HUD", icon: LayoutGrid, url: "/classic-hud", access: "collective" },
  { title: "Macro Portfolio", icon: BarChart3, url: "/portfolio", access: "collective" },
  { title: "Daily Briefing", icon: Sparkles, url: "/briefing", access: "collective" },
  { title: "Heatmap", icon: Flame, url: "/heatmap", access: "staff" },
  { title: "Analogs", icon: Telescope, url: "/analogs", access: "staff" },
  { title: "Alerts", icon: Bell, url: "/alerts", access: "collective" },
  { title: "Community Alpha", icon: Users, url: "/community-alpha", access: "collective" },
  { title: "Backtests Lab", icon: FlaskConical, url: "/backtests", access: "staff" },
  { title: "Trend Fragility", icon: GitBranch, url: "/trend-fragility", access: "staff" },
  { title: "Risk Cycle", icon: Gauge, url: "/risk-cycle", access: "staff" },
  { title: "Market Internals", icon: Network, url: "/market-internals", access: "staff" },
  {
    title: "Breadth",
    icon: Waves,
    children: [
      { title: "Overview", url: "/breadth/overview", access: "staff" },
      { title: "Components", url: "/breadth/components", access: "staff" },
      { title: "Thrusts", url: "/breadth/thrusts", access: "staff" },
      { title: "Capitulation", url: "/breadth/capitulation", access: "staff" },
    ],
  },
  {
    title: "Positioning (CoT)",
    icon: Activity,
    children: [
      { title: "Global Positioning", url: "/", access: "staff" },
      { title: "Asset Detail", url: "/asset/ES", access: "staff" },
      { title: "Sector Aggregates", url: "/sectors", access: "staff" },
      { title: "News & Divergence", url: "/news", access: "staff" },
      { title: "Eurex Positioning", url: "/eurex", access: "collective" },
      { title: "Offsides (Extremes)", url: "/offsides", access: "collective" },
    ],
  },
  {
    title: "Macro",
    icon: LineChart,
    children: [
      { title: "MO Indicators", url: "/macro/mo-indicators", access: "staff" },
      { title: "US Growth", url: "/macro/us-growth", access: "staff" },
      { title: "Labor", url: "/macro/labor", access: "staff" },
      { title: "Global Growth", url: "/macro/global-growth", access: "staff" },
      { title: "Liquidity", url: "/macro/liquidity", access: "staff" },
      { title: "Inflation", url: "/macro/inflation", access: "staff" },
      { title: "Recession", url: "/macro/recession", access: "staff" },
      { title: "Implied Regime", url: "/macro/implied-regime", access: "staff" },
    ],
  },
  {
    title: "Tools",
    icon: Calculator,
    children: [
      { title: "Position Sizing", url: "/tools/position-sizing", access: "collective" },
    ],
  },
  { title: "TPMR Overview", icon: Compass, url: "/tpmr/market-overview", access: "staff" },
  {
    title: "Dual Trend",
    icon: Crosshair,
    children: [
      { title: "S&P 500", url: "/tpmr/dual-trend/sp500", access: "staff" },
      { title: "S&P 400", url: "/tpmr/dual-trend/sp400", access: "staff" },
      { title: "S&P 600", url: "/tpmr/dual-trend/sp600", access: "staff" },
      { title: "ETFs", url: "/tpmr/dual-trend/etfs", access: "staff" },
      { title: "Gold & Silver Miners", url: "/tpmr/dual-trend/gold-silver-miners", access: "staff" },
      { title: "Large Cap Cyclical", url: "/tpmr/dual-trend/large-cap-cyclical", access: "staff" },
      { title: "Thematic Stocks", url: "/tpmr/dual-trend/thematic", access: "staff" },
    ],
  },
  {
    title: "TCTM Guides",
    icon: ShieldAlert,
    children: [
      { title: "Risk-Off", url: "/tpmr/tctm/risk-off", access: "staff" },
      { title: "Capitulation", url: "/tpmr/tctm/capitulation", access: "staff" },
      { title: "Bottom", url: "/tpmr/tctm/bottom", access: "staff" },
      { title: "Thrust", url: "/tpmr/tctm/thrust", access: "staff" },
      { title: "Confirmation", url: "/tpmr/tctm/confirmation", access: "staff" },
    ],
  },
  {
    title: "Signals Lab",
    icon: Globe2,
    children: [
      { title: "Explorer", url: "/signals/explorer", access: "tp" },
      { title: "Scanner", url: "/signals/scanner", access: "tp" },
      { title: "Rankings", url: "/signals/rankings", access: "tp" },
      { title: "Breadth", url: "/tp/breadth", access: "tp" },
      { title: "Trend Signals", url: "/tp/trend-signals", access: "tp" },
      { title: "Risk Composite", url: "/tp/risk-composite", access: "tp" },
      { title: "Sector Trends", url: "/tp/sector-trends", access: "tp" },
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
  const { isCollective, isTurningPoint, isStaff } = useEntitlements();
  const flags: AccessFlags = { isCollective, isTurningPoint, isStaff };
  const nav = NAV.map((item) => {
    if (item.children) {
      const children = item.children.filter((c) => canAccessTier(c.access ?? "staff", flags));
      return { ...item, children };
    }
    return item;
  }).filter((item) => {
    if (item.children) return item.children.length > 0;
    return canAccessTier(item.access ?? "staff", flags);
  });

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="h-7 w-7 rounded-sm bg-primary flex items-center justify-center text-primary-foreground font-mono text-[10px] font-medium tracking-wider">
            FR
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-serif italic font-light text-[15px] text-surface-foreground">
                Foundation Research
              </span>
              <span className="font-mono text-[9px] text-accent-deep tracking-[0.22em] uppercase">
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
              {nav.map((item) =>
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

      <SidebarFooter className="border-t border-sidebar-border space-y-1">
        <ViewAsControl collapsed={collapsed} />
        <AccountFooter collapsed={collapsed} />
      </SidebarFooter>
    </Sidebar>
  );
}

function ViewAsControl({ collapsed }: { collapsed: boolean }) {
  const { canViewAs, viewAs, setViewAs } = useEntitlements();
  if (!canViewAs) return null;

  return (
    <div className={collapsed ? "px-1" : "px-2 pb-1"}>
      {!collapsed && (
        <label htmlFor="terminus-view-as" className="block text-[9px] uppercase tracking-[0.14em] text-muted-foreground mb-1">
          View as
        </label>
      )}
      <select
        id="terminus-view-as"
        value={viewAs}
        onChange={(e) => setViewAs(e.target.value as ViewAsMode)}
        className="w-full bg-sidebar border border-sidebar-border rounded-sm text-[10px] px-1.5 py-1 text-sidebar-foreground"
        title="Preview another product without changing Outseta"
        aria-label="View as"
      >
        <option value="staff">Staff</option>
        <option value="collective">Collective</option>
        <option value="tp">Turning Point</option>
      </select>
    </div>
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
