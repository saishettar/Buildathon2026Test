"use client";

/**
 * Sparkline — A tiny inline SVG line chart for agent cards.
 * Shows a recent performance trend as a mini chart.
 * No external chart library dependency — uses raw SVG.
 */

import React from "react";
import { cn } from "@/lib/utils";

interface SparklineProps {
  /** Array of numeric data points to plot */
  data: number[];
  /** Width of the SVG in px */
  width?: number;
  /** Height of the SVG in px */
  height?: number;
  /** Stroke color (CSS) */
  color?: string;
  /** Show filled area under the line */
  filled?: boolean;
  className?: string;
}

export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = "#a1a1aa",
  filled = true,
  className,
}: SparklineProps) {
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} className={className}>
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke={color}
          strokeWidth={1.5}
          strokeOpacity={0.3}
          strokeDasharray="4 4"
        />
      </svg>
    );
  }

  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, i) => {
    const x = padding + (i / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <svg width={width} height={height} className={cn("overflow-visible", className)}>
      {filled && (
        <path d={areaPath} fill={color} fillOpacity={0.1} />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={2}
        fill={color}
      />
    </svg>
  );
}
