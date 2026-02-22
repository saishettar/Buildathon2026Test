"use client";

/**
 * HeroChart — Main time-series line chart at the top of the dashboard.
 * Plots key metrics (requests, success rate, latency) with multiple overlaid series.
 * Uses raw SVG — no external chart library dependency.
 *
 * NOTE: Uses mock/derived data from runs for now. The chart structure is ready
 * to be wired to real time-series data when available.
 */

import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { Run, Step } from "@/types";

interface HeroChartProps {
  runs: Run[];
  stepsMap: Record<string, Step[]>;
}

interface MetricSeries {
  name: string;
  color: string;
  data: number[];
  currentValue: string;
  unit: string;
}

export function HeroChart({ runs, stepsMap }: HeroChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Derive metric series from run data
  const { series, timeLabels } = useMemo(() => {
    // Sort runs by created_at ascending
    const sorted = [...runs].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const recentRuns = sorted.slice(-20); // last 20 runs for the chart

    const labels = recentRuns.map((r) => {
      const d = new Date(r.created_at);
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    });

    // Compute per-run metrics
    const stepsCountData: number[] = [];
    const successRateData: number[] = [];
    const avgLatencyData: number[] = [];
    const tokenUsageData: number[] = [];
    const costData: number[] = [];

    recentRuns.forEach((run) => {
      const steps = stepsMap[run.run_id] || [];
      const total = steps.length || 1;
      const completed = steps.filter((s) => s.status === "completed").length;
      const totalDuration = steps.reduce((a, s) => a + (s.duration_ms || 0), 0);
      const totalTokens = steps.reduce(
        (a, s) => a + (s.tokens_prompt || 0) + (s.tokens_completion || 0),
        0
      );
      const totalCost = steps.reduce((a, s) => a + (s.cost_usd || 0), 0);

      stepsCountData.push(total);
      successRateData.push(Math.round((completed / total) * 100));
      avgLatencyData.push(Math.round(totalDuration / total));
      tokenUsageData.push(totalTokens);
      costData.push(totalCost * 10000); // Scale for visibility
    });

    const lastSuccessRate = successRateData[successRateData.length - 1] ?? 0;
    const lastLatency = avgLatencyData[avgLatencyData.length - 1] ?? 0;
    const lastTokens = tokenUsageData[tokenUsageData.length - 1] ?? 0;
    const lastSteps = stepsCountData[stepsCountData.length - 1] ?? 0;

    const metricseries: MetricSeries[] = [
      {
        name: "Success Rate",
        color: "#22d3ee",
        data: successRateData,
        currentValue: `${lastSuccessRate}%`,
        unit: "%",
      },
      {
        name: "Avg Latency",
        color: "#a78bfa",
        data: avgLatencyData,
        currentValue: `${lastLatency}ms`,
        unit: "ms",
      },
      {
        name: "Total Steps",
        color: "#34d399",
        data: stepsCountData,
        currentValue: `${lastSteps}`,
        unit: "",
      },
      {
        name: "Token Usage",
        color: "#fbbf24",
        data: tokenUsageData,
        currentValue: lastTokens > 1000 ? `${(lastTokens / 1000).toFixed(1)}k` : `${lastTokens}`,
        unit: "tok",
      },
    ];

    return { series: metricseries, timeLabels: labels };
  }, [runs, stepsMap]);

  // Chart dimensions
  const chartWidth = 800;
  const chartHeight = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Render a single line path for a series
  const renderLine = (s: MetricSeries) => {
    if (s.data.length < 2) return null;

    const min = Math.min(...s.data);
    const max = Math.max(...s.data);
    const range = max - min || 1;

    const points = s.data.map((v, i) => ({
      x: padding.left + (i / (s.data.length - 1)) * innerWidth,
      y: padding.top + innerHeight - ((v - min) / range) * innerHeight,
    }));

    // Smooth curve using quadratic bezier
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const cx = (points[i - 1].x + points[i].x) / 2;
      path += ` Q ${points[i - 1].x + (points[i].x - points[i - 1].x) * 0.5} ${points[i - 1].y}, ${cx} ${(points[i - 1].y + points[i].y) / 2}`;
    }
    // Finish to last point
    path += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;

    // Area path
    const areaPath = `${path} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${padding.top + innerHeight} Z`;

    return (
      <g key={s.name}>
        <path d={areaPath} fill={s.color} fillOpacity={0.05} />
        <path
          d={path}
          fill="none"
          stroke={s.color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={0.8}
        />
        {/* End dot */}
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={3}
          fill={s.color}
          stroke="hsl(var(--card))"
          strokeWidth={2}
        />
      </g>
    );
  };

  // Grid lines
  const gridLines = Array.from({ length: 5 }).map((_, i) => {
    const y = padding.top + (i / 4) * innerHeight;
    return (
      <line
        key={i}
        x1={padding.left}
        y1={y}
        x2={padding.left + innerWidth}
        y2={y}
        stroke="hsl(var(--border))"
        strokeWidth={0.5}
        strokeDasharray="4 4"
      />
    );
  });

  // Time labels on x-axis (show every Nth)
  const labelInterval = Math.max(1, Math.floor(timeLabels.length / 8));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {/* Chart Title */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Agent Performance Overview</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time metrics across all agent runs</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* SVG Chart */}
        <div className="flex-1 min-w-0">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Background */}
            <rect
              x={padding.left}
              y={padding.top}
              width={innerWidth}
              height={innerHeight}
              fill="transparent"
            />

            {/* Grid */}
            {gridLines}

            {/* Lines */}
            {series.map(renderLine)}

            {/* X-axis labels */}
            {timeLabels.map((label, i) => {
              if (i % labelInterval !== 0 && i !== timeLabels.length - 1) return null;
              const x = padding.left + (i / Math.max(timeLabels.length - 1, 1)) * innerWidth;
              return (
                <text
                  key={i}
                  x={x}
                  y={chartHeight - 5}
                  textAnchor="middle"
                  className="fill-muted-foreground/60 text-[9px]"
                >
                  {label}
                </text>
              );
            })}

            {/* Hover overlay columns */}
            {timeLabels.map((_, i) => {
              const x = padding.left + (i / Math.max(timeLabels.length - 1, 1)) * innerWidth;
              return (
                <rect
                  key={`hover-${i}`}
                  x={x - innerWidth / timeLabels.length / 2}
                  y={padding.top}
                  width={innerWidth / timeLabels.length}
                  height={innerHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="cursor-crosshair"
                />
              );
            })}

            {/* Hover line */}
            {hoveredIndex !== null && (
              <line
                x1={padding.left + (hoveredIndex / Math.max(timeLabels.length - 1, 1)) * innerWidth}
                y1={padding.top}
                x2={padding.left + (hoveredIndex / Math.max(timeLabels.length - 1, 1)) * innerWidth}
                y2={padding.top + innerHeight}
                stroke="#22d3ee"
                strokeWidth={1}
                strokeOpacity={0.3}
                strokeDasharray="4 4"
              />
            )}
          </svg>

          {/* Timeline Brush Bar */}
          <div className="mt-2 mx-12">
            <div className="relative h-6 rounded-full bg-background border border-border overflow-hidden">
              <div className="absolute inset-y-0 left-[10%] right-[10%] bg-cyan-500/10 border-l border-r border-cyan-500/30 rounded" />
              <div className="flex justify-between px-2 h-full items-center">
                {["0%", "25%", "50%", "75%", "100%"].map((label) => (
                  <span key={label} className="text-[8px] text-muted-foreground/60 font-mono">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Legend / Current Values */}
        <div className="w-40 shrink-0 space-y-3 pt-2">
          {series.map((s) => (
            <div key={s.name} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-muted-foreground truncate">{s.name}</p>
                <p className="text-sm font-semibold" style={{ color: s.color }}>
                  {s.currentValue}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
