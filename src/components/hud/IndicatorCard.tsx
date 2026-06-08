import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  Brush,
  Customized,
  ReferenceLine,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  HudTooltip,
  PercentileBandsLayer,
  EndLabelLayer,
  HoverAxisChipLayer,
  computePercentiles,
} from "@/components/charts/HudChartPrimitives";
import { mockSeries, lastValue, type MockOptions } from "@/lib/mockSeries";
import { ConstructionPopover } from "@/components/hud/ConstructionPopover";
import type { ComponentSpec } from "@/lib/indicatorSpecs";
import { useCopilot } from "@/components/copilot/CopilotContext";
import { useChartSync } from "@/components/hud/ChartSyncContext";
import {
  Sparkles,
  BarChart3,
  Pin,
  MessageSquarePlus,
  Maximize2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { listAnnotations, addAnnotation, removeAnnotation, type Annotation } from "@/lib/annotations";
import { listWorkspaces, addItem, createWorkspace } from "@/lib/workspaces";
import { toast } from "@/hooks/use-toast";

type Variant = "line" | "area" | "bar";

interface IndicatorCardProps {
  title?: string;
  subtitle?: string;
  seed: number;
  variant?: Variant;
  height?: number;
  min?: number;
  max?: number;
  drift?: number;
  volatility?: number;
  points?: number;
  thresholds?: { hi?: number; lo?: number };
  unit?: string;
  actions?: ReactNode;
  mockOverride?: MockOptions;
  brush?: boolean;
  component?: ComponentSpec;
  /** Stable id used by the sync layer & annotations store. Defaults to `seed`. */
  indicatorKey?: string;
}

export function IndicatorCard(props: IndicatorCardProps) {
  return <IndicatorCardInner {...props} />;
}

function IndicatorCardInner({
  title,
  subtitle,
  seed,
  variant = "line",
  height = 160,
  min,
  max,
  drift = 0,
  volatility = 0.2,
  points = 78,
  thresholds,
  unit = "",
  actions,
  mockOverride,
  brush = false,
  component,
  indicatorKey,
}: IndicatorCardProps) {
  const sync = useChartSyncSafe();
  const [fullscreen, setFullscreen] = useState(false);
  const [annoVer, setAnnoVer] = useState(0);

  const resolvedTitle = title ?? component?.title ?? "";
  const resolvedMin = min ?? component?.scale?.min ?? 0;
  const resolvedMax = max ?? component?.scale?.max ?? 100;
  const resolvedThresholds = thresholds ?? component?.thresholds;
  const key = indicatorKey ?? `seed:${seed}`;

  // Full series, then slice by range preset.
  const fullData = useMemo(
    () =>
      mockSeries({
        seed,
        min: resolvedMin,
        max: resolvedMax,
        drift,
        volatility,
        points,
        ...mockOverride,
      }),
    [seed, resolvedMin, resolvedMax, drift, volatility, points, mockOverride],
  );

  const sliced = useMemo(() => {
    if (!sync) return fullData;
    const n = sync.pointsFor(fullData.length);
    return fullData.slice(-n);
  }, [fullData, sync]);

  const data = fullscreen ? fullData : sliced;
  const v = lastValue(data);

  useEffect(() => {
    const h = () => setAnnoVer((x) => x + 1);
    window.addEventListener("mhud:annotations-changed", h);
    return () => window.removeEventListener("mhud:annotations-changed", h);
  }, []);

  const annotations = useMemo<Annotation[]>(() => {
    void annoVer;
    return listAnnotations(key).filter((a) => data.some((d) => d.t === a.t));
  }, [key, data, annoVer]);

  const hoverPoint = useMemo(() => {
    if (!sync?.hoverT) return null;
    return data.find((d) => d.t === sync.hoverT) ?? null;
  }, [sync?.hoverT, data]);

  const headerValue = hoverPoint ? hoverPoint.v : v;
  const headerLabel = hoverPoint ? hoverPoint.t : null;
  const wow = useMemo(() => {
    if (data.length < 2) return 0;
    const prev = data[data.length - 2].v;
    const last = data[data.length - 1].v;
    return last - prev;
  }, [data]);
  const wowTone = wow > 0 ? "text-success" : wow < 0 ? "text-destructive" : "text-muted-foreground";

  return (
    <>
      <div className="hud-panel flex flex-col group/card relative">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-surface-foreground truncate">
              {resolvedTitle}
            </div>
            {(subtitle || headerLabel) && (
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5 truncate">
                {headerLabel ? `@ ${headerLabel}` : subtitle}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-baseline gap-1.5">
              <span className={`font-mono tabular-nums text-xs ${hoverPoint ? "text-primary" : "text-surface-foreground"}`}>
                {headerValue.toFixed(1)}
                {unit}
              </span>
              {!hoverPoint && (
                <span className={`font-mono tabular-nums text-[9px] ${wowTone}`}>
                  {wow > 0 ? "▲" : wow < 0 ? "▼" : "·"}{Math.abs(wow).toFixed(2)}
                </span>
              )}
            </div>
            <ChartToolbar
              title={resolvedTitle}
              subtitle={subtitle}
              seed={seed}
              value={v}
              min={resolvedMin}
              max={resolvedMax}
              unit={unit}
              thresholds={resolvedThresholds}
              recent={data.slice(-12)}
              indicatorKey={key}
              hoverPoint={hoverPoint ?? data[data.length - 1]}
              variant={variant}
              drift={drift}
              onFullscreen={() => setFullscreen(true)}
            />
            {actions}
            {component && <ConstructionPopover spec={component} />}
          </div>
        </div>
        <div className="p-1 hud-chart rounded-none" style={{ height: brush ? height + 28 : height }}>
          <ChartBody
            data={data}
            variant={variant}
            min={resolvedMin}
            max={resolvedMax}
            seed={seed}
            unit={unit}
            title={resolvedTitle}
            thresholds={resolvedThresholds}
            brush={brush}
            height={height}
            annotations={annotations}
            hoverT={sync?.hoverT ?? null}
            onHover={sync?.setHoverT}
          />
        </div>
      </div>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-[11px] uppercase tracking-[0.16em] flex items-center gap-2">
              {resolvedTitle}
              <span className="text-muted-foreground font-mono normal-case tracking-normal text-[10px]">
                · {subtitle}
              </span>
            </DialogTitle>
          </DialogHeader>
          <StatsStrip data={fullData} unit={unit} thresholds={resolvedThresholds} />
          <div className="h-[420px]">
            <ChartBody
              data={fullData}
              variant={variant}
              min={resolvedMin}
              max={resolvedMax}
              seed={seed * 7}
              unit={unit}
              title={resolvedTitle}
              thresholds={resolvedThresholds}
              brush
              height={420}
              annotations={listAnnotations(key)}
              hoverT={sync?.hoverT ?? null}
              onHover={sync?.setHoverT}
            />
          </div>
          <AnnotationList indicatorKey={key} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function useChartSyncSafe() {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useChartSync();
  } catch {
    return null;
  }
}

function ChartBody({
  data,
  variant,
  min,
  max,
  seed,
  unit,
  title,
  thresholds,
  brush,
  height,
  annotations,
  hoverT,
  onHover,
}: {
  data: { t: string; v: number }[];
  variant: Variant;
  min: number;
  max: number;
  seed: number;
  unit: string;
  title: string;
  thresholds?: { hi?: number; lo?: number };
  brush: boolean;
  height: number;
  annotations: Annotation[];
  hoverT: string | null;
  onHover?: (t: string | null) => void;
}) {
  const stroke = "hsl(var(--chart-accent))";
  const cursorStyle = { stroke: "hsl(var(--chart-halo))", strokeWidth: 1, strokeDasharray: "2 3", strokeOpacity: 0.6 };

  // Extremity bands are tied to the chart's y-axis domain (top/bottom 10%),
  // NOT the data distribution — so they always mark true extremes of the scale.
  const bands = useMemo(() => {
    const span = max - min;
    return {
      ...computePercentiles(data.map((d) => d.v)),
      p10: min + span * 0.1,
      p90: min + span * 0.9,
    };
  }, [data, min, max]);

  const handleMouseMove = (state: { activeLabel?: string | number } | null) => {
    if (!onHover) return;
    const t = state?.activeLabel;
    if (typeof t === "string") onHover(t);
  };
  const handleLeave = () => onHover?.(null);

  const sharedRefs = (
    <>
      {thresholds?.hi != null && (
        <ReferenceLine y={thresholds.hi} stroke="hsl(var(--chart-ink-muted))" strokeDasharray="3 3" />
      )}
      {thresholds?.lo != null && (
        <ReferenceLine y={thresholds.lo} stroke="hsl(var(--chart-ink-muted))" strokeDasharray="3 3" />
      )}
      {hoverT && data.some((d) => d.t === hoverT) && (
        <ReferenceLine x={hoverT} stroke="hsl(var(--chart-halo))" strokeOpacity={0.5} strokeDasharray="2 2" />
      )}
      {annotations.map((a) => (
        <ReferenceDot
          key={a.id}
          x={a.t}
          y={a.v}
          r={4}
          fill="hsl(var(--primary))"
          stroke="hsl(var(--background))"
          strokeWidth={1.5}
        />
      ))}
    </>
  );

  // Recharts <Customized /> wants a component (not an inline render fn) to
  // avoid remount-per-render warnings.
  const BandsLayer = (p: object) => <PercentileBandsLayer {...(p as Record<string, unknown>)} p10={bands.p10} p90={bands.p90} />;
  const EndLayer = (p: object) => (
    <EndLabelLayer {...(p as Record<string, unknown>)} data={data} unit={unit} bands={bands} />
  );
  const HoverChip = (p: object) => (
    <HoverAxisChipLayer {...(p as Record<string, unknown>)} hoverT={hoverT} data={data} unit={unit} />
  );
  const tooltipNode = <HudTooltip data={data} unit={unit} />;

  const rightPad = 12;
  const bottomPad = hoverT ? 14 : 0;
  const margin = { top: 6, right: rightPad, left: 0, bottom: bottomPad };
  // Breathing room so the latest print never sits flush against the chart edge.
  const yPad = (max - min) * 0.08;
  const yDomain: [number, number] = [min - yPad, max + yPad];

  return (
    <ResponsiveContainer width="100%" height="100%">
      {variant === "bar" ? (
        <BarChart data={data} margin={margin} onMouseMove={handleMouseMove} onMouseLeave={handleLeave}>
          <XAxis dataKey="t" hide />
          <YAxis domain={yDomain} hide />
          <Tooltip content={tooltipNode} cursor={{ fill: "hsl(var(--chart-grid) / 0.5)" }} />
          <Customized component={BandsLayer} />
          <Bar dataKey="v" fill={stroke} isAnimationActive={false} />
          {sharedRefs}
          <Customized component={EndLayer} />
          <Customized component={HoverChip} />
          {brush && (
            <Brush dataKey="t" height={20} stroke={stroke} fill="hsl(var(--chart-grid) / 0.4)" travellerWidth={6} y={height - 6} />
          )}
        </BarChart>
      ) : variant === "area" ? (
        <AreaChart data={data} margin={margin} onMouseMove={handleMouseMove} onMouseLeave={handleLeave}>
          <defs>
            <linearGradient id={`g${seed}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.32} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" hide />
          <YAxis domain={yDomain} hide />
          <Tooltip content={tooltipNode} cursor={cursorStyle} />
          <Customized component={BandsLayer} />
          <Area
            type="monotone"
            dataKey="v"
            stroke={stroke}
            strokeWidth={1.5}
            fill={`url(#g${seed})`}
            isAnimationActive
            animationDuration={650}
            animationEasing="ease-out"
          />
          {sharedRefs}
          <Customized component={EndLayer} />
          <Customized component={HoverChip} />
          {brush && (
            <Brush dataKey="t" height={20} stroke={stroke} fill="hsl(var(--chart-grid) / 0.4)" travellerWidth={6} y={height - 6} />
          )}
        </AreaChart>
      ) : (
        <LineChart data={data} margin={margin} onMouseMove={handleMouseMove} onMouseLeave={handleLeave}>
          <XAxis dataKey="t" hide />
          <YAxis domain={yDomain} hide />
          <Tooltip content={tooltipNode} cursor={cursorStyle} />
          <Customized component={BandsLayer} />
          <Line
            type="monotone"
            dataKey="v"
            stroke={stroke}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive
            animationDuration={650}
            animationEasing="ease-out"
          />
          {sharedRefs}
          <Customized component={EndLayer} />
          <Customized component={HoverChip} />
          {brush && (
            <Brush dataKey="t" height={20} stroke={stroke} fill="hsl(var(--chart-grid) / 0.4)" travellerWidth={6} y={height - 6} />
          )}
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}



function StatsStrip({
  data,
  unit,
  thresholds,
}: {
  data: { t: string; v: number }[];
  unit?: string;
  thresholds?: { hi?: number; lo?: number };
}) {
  const stats = useMemo(() => {
    if (!data.length) return null;
    const values = data.map((d) => d.v);
    const last = values[values.length - 1];
    const mean = values.reduce((s, x) => s + x, 0) / values.length;
    const variance = values.reduce((s, x) => s + (x - mean) ** 2, 0) / values.length;
    const stdev = Math.sqrt(variance) || 1;
    const z = (last - mean) / stdev;
    const sorted = [...values].sort((a, b) => a - b);
    const rank = sorted.filter((x) => x <= last).length;
    const pct = (rank / sorted.length) * 100;
    const at = (days: number) => {
      const idx = Math.max(0, data.length - 1 - Math.round(days / 7));
      return values[idx];
    };
    const chg = (d: number) => (((last - at(d)) / Math.abs(at(d) || 1)) * 100);
    const regime = thresholds?.hi != null && last >= thresholds.hi
      ? "Above upper"
      : thresholds?.lo != null && last <= thresholds.lo
        ? "Below lower"
        : "In range";
    return { last, mean, z, pct, m1: chg(30), m3: chg(90), y1: chg(365), regime };
  }, [data, thresholds]);

  if (!stats) return null;
  const cell = "px-3 py-2 border-r border-border last:border-r-0 flex-1 min-w-[80px]";
  return (
    <div className="flex border border-border rounded-sm bg-surface/30 text-[10px] font-mono">
      <Stat label="Last" value={`${stats.last.toFixed(2)}${unit ?? ""}`} cn={cell} />
      <Stat label="Z-score" value={stats.z.toFixed(2)} cn={cell} tone={Math.abs(stats.z) > 1.5 ? "warn" : undefined} />
      <Stat label="Percentile" value={`${stats.pct.toFixed(0)}%`} cn={cell} />
      <Stat label="1M Δ" value={`${stats.m1 >= 0 ? "+" : ""}${stats.m1.toFixed(1)}%`} cn={cell} tone={stats.m1 >= 0 ? "up" : "down"} />
      <Stat label="3M Δ" value={`${stats.m3 >= 0 ? "+" : ""}${stats.m3.toFixed(1)}%`} cn={cell} tone={stats.m3 >= 0 ? "up" : "down"} />
      <Stat label="1Y Δ" value={`${stats.y1 >= 0 ? "+" : ""}${stats.y1.toFixed(1)}%`} cn={cell} tone={stats.y1 >= 0 ? "up" : "down"} />
      <Stat label="Regime" value={stats.regime} cn={cell} />
    </div>
  );
}

function Stat({ label, value, cn, tone }: { label: string; value: string; cn: string; tone?: "up" | "down" | "warn" }) {
  const toneCls = tone === "up" ? "text-success" : tone === "down" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-surface-foreground";
  return (
    <div className={cn}>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`tabular-nums font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}

function ChartToolbar(props: {
  title: string;
  subtitle?: string;
  seed: number;
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  thresholds?: { hi?: number; lo?: number };
  recent: { t: string; v: number }[];
  indicatorKey: string;
  hoverPoint?: { t: string; v: number };
  variant: Variant;
  drift: number;
  onFullscreen: () => void;
}) {
  const { openCopilot } = useCopilot();
  const ctx = {
    title: props.title,
    subtitle: props.subtitle,
    seed: props.seed,
    value: props.value,
    min: props.min,
    max: props.max,
    unit: props.unit,
    thresholdHi: props.thresholds?.hi,
    thresholdLo: props.thresholds?.lo,
    recent: props.recent,
  };

  // Deep link to the Backtests Lab pre-armed for this chart.
  const backtestHref = (() => {
    const sp = new URLSearchParams();
    sp.set("indicator", props.indicatorKey);
    sp.set("cond", props.thresholds?.hi != null && props.value >= props.thresholds.hi ? "gte" : "lte");
    const th = props.thresholds?.hi ?? props.thresholds?.lo ?? Math.round(((props.min ?? 0) + (props.max ?? 100)) * 0.75);
    sp.set("th", String(th));
    sp.set("h", "12");
    return `/backtests?${sp.toString()}`;
  })();

  return (
    <div className="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 focus-within:opacity-100 transition-opacity">
      <IconBtn
        title="Ask Copilot"
        onClick={() => openCopilot({ context: ctx, prompt: `What is ${props.title} telling me right now?` })}
      >
        <Sparkles className="h-3 w-3" />
      </IconBtn>
      <a
        href={backtestHref}
        onClick={(e) => {
          if (e.shiftKey) {
            e.preventDefault();
            openCopilot({ context: ctx, prompt: `Run a historical backtest of ${props.title} crossing its thresholds and summarize.` });
          }
          e.stopPropagation();
        }}
        title="Backtest this chart in the Lab (shift-click for inline)"
        className="h-5 w-5 grid place-items-center rounded-sm text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
      >
        <BarChart3 className="h-3 w-3" />
      </a>
      <AnnotatePopover
        indicatorKey={props.indicatorKey}
        point={props.hoverPoint ?? props.recent[props.recent.length - 1]}
      />
      <PinPopover
        item={{
          title: props.title,
          subtitle: props.subtitle,
          seed: props.seed,
          variant: props.variant,
          min: props.min,
          max: props.max,
          drift: props.drift,
          thresholdHi: props.thresholds?.hi,
          thresholdLo: props.thresholds?.lo,
          unit: props.unit,
          indicatorKey: props.indicatorKey,
        }}
      />
      <IconBtn title="Fullscreen" onClick={props.onFullscreen}>
        <Maximize2 className="h-3 w-3" />
      </IconBtn>
    </div>
  );
}

function IconBtn({ children, onClick, title }: { children: ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick();
      }}
      title={title}
      className="h-5 w-5 grid place-items-center rounded-sm text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
    >
      {children}
    </button>
  );
}

function AnnotatePopover({ indicatorKey, point }: { indicatorKey: string; point?: { t: string; v: number } }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  if (!point) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          title={`Annotate @ ${point.t}`}
          className="h-5 w-5 grid place-items-center rounded-sm text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <MessageSquarePlus className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-2" align="end">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          New annotation @ <span className="font-mono">{point.t}</span> · <span className="font-mono">{point.v.toFixed(2)}</span>
        </div>
        <textarea
          autoFocus
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. CTA reset after Fed pause…"
          className="w-full bg-surface border border-border rounded-sm px-2 py-1.5 text-xs focus:outline-none focus:border-primary"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="text-[10px] uppercase tracking-wider px-2 py-1 text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!note.trim()) return;
              addAnnotation({ indicatorKey, t: point.t, v: point.v, note: note.trim() });
              setNote("");
              setOpen(false);
              toast({ title: "Annotation saved", description: point.t });
            }}
            className="text-[10px] uppercase tracking-wider px-2 py-1 bg-primary text-primary-foreground rounded-sm"
          >
            Save
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PinPopover({ item }: { item: Omit<Parameters<typeof addItem>[1], "id"> }) {
  const [open, setOpen] = useState(false);
  const [ver, setVer] = useState(0);
  const [newName, setNewName] = useState("");
  const workspaces = useMemo(() => listWorkspaces(), [open, ver]);

  useEffect(() => {
    const h = () => setVer((x) => x + 1);
    window.addEventListener("mhud:workspaces-changed", h);
    return () => window.removeEventListener("mhud:workspaces-changed", h);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          title="Pin to workspace"
          className="h-5 w-5 grid place-items-center rounded-sm text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <Pin className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-1.5 py-1">
          Pin to workspace
        </div>
        <div className="max-h-40 overflow-auto">
          {workspaces.length === 0 && (
            <div className="text-[10px] text-muted-foreground px-1.5 py-1 italic">No workspaces yet.</div>
          )}
          {workspaces.map((w) => (
            <button
              key={w.id}
              onClick={() => {
                addItem(w.id, item);
                setOpen(false);
                toast({ title: "Added to workspace", description: w.name });
              }}
              className="w-full text-left text-xs px-2 py-1 rounded-sm hover:bg-surface-2 flex items-center justify-between"
            >
              <span className="truncate">{w.name}</span>
              <span className="text-[9px] font-mono text-muted-foreground">{w.items.length}</span>
            </button>
          ))}
        </div>
        <div className="border-t border-border mt-2 pt-2 flex gap-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New workspace…"
            className="flex-1 bg-surface border border-border rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-primary"
          />
          <button
            onClick={() => {
              const name = newName.trim() || "Untitled Workspace";
              const w = createWorkspace(name);
              addItem(w.id, item);
              setNewName("");
              setOpen(false);
              toast({ title: "Workspace created", description: name });
            }}
            className="text-[10px] uppercase tracking-wider px-2 bg-primary text-primary-foreground rounded-sm"
          >
            Create
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AnnotationList({ indicatorKey }: { indicatorKey: string }) {
  const [ver, setVer] = useState(0);
  useEffect(() => {
    const h = () => setVer((x) => x + 1);
    window.addEventListener("mhud:annotations-changed", h);
    return () => window.removeEventListener("mhud:annotations-changed", h);
  }, []);
  const items = useMemo(() => {
    void ver;
    return listAnnotations(indicatorKey);
  }, [indicatorKey, ver]);
  if (!items.length) return null;
  return (
    <div className="border-t border-border pt-2 mt-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Annotations</div>
      <div className="space-y-1 max-h-32 overflow-auto">
        {items.map((a) => (
          <div key={a.id} className="flex items-start gap-2 text-[11px] px-2 py-1 bg-surface-2/40 rounded-sm">
            <span className="font-mono tabular-nums text-muted-foreground shrink-0">{a.t}</span>
            <span className="font-mono tabular-nums text-primary shrink-0">{a.v.toFixed(1)}</span>
            <span className="flex-1 text-surface-foreground">{a.note}</span>
            <button
              onClick={() => removeAnnotation(a.id)}
              className="text-muted-foreground hover:text-destructive shrink-0"
              aria-label="Delete"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardGrid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const map = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  } as const;
  return <div className={`grid ${map[cols]} gap-3 p-3`}>{children}</div>;
}
