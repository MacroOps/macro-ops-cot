import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Layers,
  Newspaper,
  FlaskConical,
  Settings,
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
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
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

type Leaf = { title: string; url: string };
type Group = { title: string; icon: any; url?: string; children?: Leaf[] };

const NAV: Group[] = [
  { title: "Overview", icon: LayoutDashboard, url: "/overview" },
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
      { title: "Backtests Lab", url: "/backtests" },
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
            MO
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-surface-foreground">
                Macro HUD
              </span>
              <span className="text-[9px] text-muted-foreground tracking-widest uppercase">
                Research Platform
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

        <SidebarGroup>
          <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.14em]">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Settings">
                  <Settings className="h-4 w-4" />
                  {!collapsed && <span className="text-xs">Settings</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
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
