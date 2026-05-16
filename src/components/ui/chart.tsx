import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

// Simplified shadcn-style chart wrapper. Provides drop-in replacements for
// ChartConfig / ChartContainer / ChartTooltip / ChartTooltipContent.

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
    color?: string;
  };
};

type ChartContextProps = { config: ChartConfig };
const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const ctx = React.useContext(ChartContext);
  if (!ctx) throw new Error("useChart must be used within <ChartContainer />");
  return ctx;
}

export const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig;
    children: React.ReactElement;
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  // Build inline CSS vars from config: --color-<key> -> config[key].color
  const styleVars: Record<string, string> = {};
  for (const [key, item] of Object.entries(config)) {
    if (item.color) styleVars[`--color-${key}`] = item.color;
  }

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        ref={ref}
        data-chart={chartId}
        style={styleVars as React.CSSProperties}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-tooltip-cursor]:fill-foreground/10",
          className
        )}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "ChartContainer";

export const ChartTooltip = RechartsPrimitive.Tooltip;

export const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    active?: boolean;
    payload?: any[];
    label?: any;
    hideLabel?: boolean;
    indicator?: "line" | "dot" | "dashed";
  }
>(({ active, payload, label, className, hideLabel, indicator = "dot" }, ref) => {
  const { config } = useChart();
  if (!active || !payload?.length) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
        className
      )}
    >
      {!hideLabel && label != null && (
        <div className="font-medium text-foreground">{label}</div>
      )}
      <div className="grid gap-1.5">
        {payload.map((item: any, i: number) => {
          const key = item.dataKey || item.name;
          const itemConfig = config[key] || {};
          const color = item.color || item.payload?.fill || itemConfig.color;
          return (
            <div key={i} className="flex w-full items-center gap-2">
              <span
                className={cn(
                  "shrink-0 rounded-[2px]",
                  indicator === "dot" ? "h-2.5 w-2.5" : "h-0.5 w-3"
                )}
                style={{ background: color }}
              />
              <span className="text-muted-foreground">
                {itemConfig.label || item.name}
              </span>
              <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                {item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
ChartTooltipContent.displayName = "ChartTooltipContent";
