import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { Area, Bar, Line, Pie, ResponsiveContainer as RechartsResponsiveContainer, Scatter } from "recharts";
import { onChartExportMode } from "@/lib/exportChart";

const ANIMATED_SERIES = new Set<unknown>([Line, Area, Bar, Scatter, Pie]);

function withoutSeriesAnimation(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return child;
    if (child.type === Fragment) return cloneElement(child, undefined, withoutSeriesAnimation(child.props.children));
    if (ANIMATED_SERIES.has(child.type)) return cloneElement(child as ReactElement<{ isAnimationActive?: boolean }>, { isAnimationActive: false });
    return child;
  });
}

/**
 * Recharts' ResponsiveContainer, aware of PNG export: while its panel is re-flowed
 * for export, series render without animation so the capture shows them at the
 * export size immediately instead of mid-transition.
 */
export function ResponsiveContainer({ children, ...props }: ComponentProps<typeof RechartsResponsiveContainer>) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(
    () =>
      onChartExportMode((scope, on) => {
        if (hostRef.current && scope.contains(hostRef.current)) setExporting(on);
      }),
    [],
  );

  const chart =
    exporting && isValidElement<{ children?: ReactNode }>(children)
      ? cloneElement(children, undefined, withoutSeriesAnimation(children.props.children))
      : children;

  return (
    <div ref={hostRef} style={{ display: "contents" }} data-chart-remount="">
      <RechartsResponsiveContainer {...props}>{chart}</RechartsResponsiveContainer>
    </div>
  );
}
