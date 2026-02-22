"use client";

/**
 * HeroChart — Per-agent performance chart on the dashboard.
 *
 * Two modes:
 * 1. **Overview** – All agents overlaid, smooth area lines, Brush slider for zoom.
 * 2. **Detail**  – Click an agent card to drill in → shows all 5 metrics for that
 *                   single agent in a mini-dashboard of individual charts.
 *
 * Uses Recharts for accurate, interactive, natural-feeling charts.
 */

import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
  ReferenceLine,
} from "recharts";
import { cn, formatDuration, formatTokens, formatCost } from "@/lib/utils";
import {
  Activity,
  Zap,
  TrendingUp,
  Hash,
  Coins,
  BarChart3,
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { Run, Step } from "@/types";

/* ────────────────────────── Types ────────────────────────── */

interface HeroChartProps {
  runs: Run[];
  stepsMap: Record<string, Step[]>;
}

type MetricKey = "latency" | "successRate" | "tokens" | "cost" | "steps";

interface AgentStats {
  avgLatency: number;
  successRate: number;
  totalTokens: number;
  totalCost: number;
  totalSteps: number;
  runCount: number;
  completedRuns: number;
  failedRuns: number;
}

interface AgentInfo {
  agentName: string;
  color: string;
  stats: AgentStats;
  /** All metric chart data rows for this agent (for detail view) */
  detailData: Record<string, unknown>[];
}

/* ────────────────────────── Constants ────────────────────── */

const AGENT_COLORS = [
  "#22d3ee", // cyan
  "#a78bfa", // violet
  "#f97316", // orange
  "#4ade80", // green
  "#f472b6", // pink
  "#facc15", // yellow
  "#38bdf8", // sky
  "#fb923c", // amber
  "#818cf8", // indigo
  "#34d399", // emerald
];

const METRICS: {
  key: MetricKey;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  format: (v: number) => string;
  unit: string;
  color: string;
}[] = [
  { key: "latency",     label: "Avg Latency",  shortLabel: "Latency",  icon: Zap,        format: (v) => formatDuration(v), unit: "ms",  color: "#22d3ee" },
  { key: "successRate", label: "Success Rate",  shortLabel: "Success",  icon: TrendingUp, format: (v) => `${v}%`,           unit: "%",   color: "#4ade80" },
  { key: "tokens",      label: "Tokens Used",   shortLabel: "Tokens",   icon: Hash,       format: (v) => formatTokens(v),   unit: "tok", color: "#a78bfa" },
  { key: "cost",        label: "Cost",          shortLabel: "Cost",     icon: Coins,      format: (v) => formatCost(v),     unit: "USD", color: "#f97316" },
  { key: "steps",       label: "Steps",         shortLabel: "Steps",    icon: Activity,   format: (v) => v.toString(),      unit: "",    color: "#f472b6" },
];

/* ────────────────────────── Helpers ──────────────────────── */

function getAgentName(run: Run, steps: Step[]): string {
  if (run.metadata?.tags?.length > 0) {
    return run.metadata.tags[0]
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
  }
  if (steps.length > 0) return steps[0].name;
  return `Agent ${run.run_id.slice(0, 6)}`;
}

function computeMetric(metric: MetricKey, steps: Step[]): number {
  const total = steps.length || 1;
  const completed = steps.filter((s) => s.status === "completed").length;
  const totalDuration = steps.reduce((a, s) => a + (s.duration_ms || 0), 0);
  const totalTokens = steps.reduce(
    (a, s) => a + (s.tokens_prompt || 0) + (s.tokens_completion || 0),
    0,
  );
  const totalCost = steps.reduce((a, s) => a + (s.cost_usd || 0), 0);

  switch (metric) {
    case "latency":     return Math.round(totalDuration / total);
    case "successRate": return Math.round((completed / total) * 100);
    case "tokens":      return totalTokens;
    case "cost":        return totalCost;
    case "steps":       return total;
    default:            return 0;
  }
}

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/* ────────────────────── Custom Tooltip ──────────────────── */

function OverviewTooltip({
  active,
  payload,
  label,
  metricFormat,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string; stroke: string }>;
  label?: number;
  metricFormat: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const time = label
    ? new Date(label).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "";
  return (
    <div className="bg-card/95 backdrop-blur-md border border-border rounded-xl px-3.5 py-2.5 shadow-xl min-w-[160px]">
      <p className="text-[10px] text-muted-foreground mb-1.5 font-mono tracking-wide">
        {time}
      </p>
      {payload
        .filter((e) => e.value !== undefined && e.value !== null)
        .map((entry) => (
          <div
            key={entry.dataKey}
            className="flex items-center gap-2 py-[3px]"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0 shadow-sm"
              style={{ backgroundColor: entry.stroke || entry.color }}
            />
            <span className="text-[10px] text-muted-foreground truncate max-w-[90px]">
              {entry.dataKey}
            </span>
            <span
              className="text-[11px] font-semibold ml-auto pl-3 tabular-nums"
              style={{ color: entry.stroke || entry.color }}
            >
              {metricFormat(entry.value)}
            </span>
          </div>
        ))}
    </div>
  );
}

function DetailTooltip({
  active,
  payload,
  label,
  metricFormat,
  color,
  metricLabel,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: number;
  metricFormat: (v: number) => string;
  color: string;
  metricLabel: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const time = label
    ? new Date(label).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "";
  return (
    <div className="bg-card/95 backdrop-blur-md border border-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-[9px] text-muted-foreground mb-1 font-mono">{time}</p>
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-[10px] text-muted-foreground">{metricLabel}</span>
        <span
          className="text-[12px] font-bold ml-auto pl-3 tabular-nums"
          style={{ color }}
        >
          {metricFormat(payload[0].value)}
        </span>
      </div>
    </div>
  );
}

/* ────────────────────── Component ───────────────────────── */

export function HeroChart({ runs, stepsMap }: HeroChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("latency");
  const [activeAgents, setActiveAgents] = useState<Set<string>>(new Set());
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const [focusedAgent, setFocusedAgent] = useState<string | null>(null); // detail mode

  // ── Build per-agent info + chart data ──
  const { agentInfos, overviewData } = useMemo(() => {
    const agentMap = new Map<
      string,
      { entries: { run: Run; steps: Step[] }[] }
    >();

    const sorted = [...runs].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    sorted.forEach((run) => {
      const steps = stepsMap[run.run_id] || [];
      const name = getAgentName(run, steps);
      if (!agentMap.has(name)) agentMap.set(name, { entries: [] });
      agentMap.get(name)!.entries.push({ run, steps });
    });

    const infos: AgentInfo[] = [];
    let colorIdx = 0;

    agentMap.forEach((value, agentName) => {
      const allSteps = value.entries.flatMap((r) => r.steps);
      const totalTokens = allSteps.reduce(
        (a, s) => a + (s.tokens_prompt || 0) + (s.tokens_completion || 0),
        0,
      );
      const totalCost = allSteps.reduce((a, s) => a + (s.cost_usd || 0), 0);
      const totalDur = allSteps.reduce((a, s) => a + (s.duration_ms || 0), 0);
      const completed = allSteps.filter((s) => s.status === "completed").length;
      const successRate =
        allSteps.length > 0
          ? Math.round((completed / allSteps.length) * 100)
          : 0;
      const avgLatency =
        allSteps.length > 0 ? Math.round(totalDur / allSteps.length) : 0;

      // Detail data for this agent: every run → all 5 metrics
      const detailData = value.entries.map(({ run, steps }) => {
        const ts = new Date(run.created_at).getTime();
        return {
          timestamp: ts,
          latency: computeMetric("latency", steps),
          successRate: computeMetric("successRate", steps),
          tokens: computeMetric("tokens", steps),
          cost: computeMetric("cost", steps),
          steps: computeMetric("steps", steps),
        };
      });

      infos.push({
        agentName,
        color: AGENT_COLORS[colorIdx % AGENT_COLORS.length],
        stats: {
          avgLatency,
          successRate,
          totalTokens,
          totalCost,
          totalSteps: allSteps.length,
          runCount: value.entries.length,
          completedRuns: value.entries.filter((e) => e.run.status === "completed").length,
          failedRuns: value.entries.filter((e) => e.run.status === "failed").length,
        },
        detailData,
      });
      colorIdx++;
    });

    // Overview data: unified rows for the selected metric
    const timeMap = new Map<number, Record<string, unknown>>();
    agentMap.forEach((value, agentName) => {
      value.entries.forEach(({ run, steps }) => {
        const ts = new Date(run.created_at).getTime();
        if (!timeMap.has(ts)) {
          timeMap.set(ts, { timestamp: ts });
        }
        timeMap.get(ts)![agentName] = computeMetric(selectedMetric, steps);
      });
    });
    const data = Array.from(timeMap.values()).sort(
      (a, b) => (a.timestamp as number) - (b.timestamp as number),
    );

    return { agentInfos: infos, overviewData: data };
  }, [runs, stepsMap, selectedMetric]);

  // ── Initialise activeAgents ──
  useEffect(() => {
    if (agentInfos.length > 0 && activeAgents.size === 0) {
      setActiveAgents(new Set(agentInfos.map((a) => a.agentName)));
    }
  }, [agentInfos, activeAgents.size]);

  const toggleAgent = useCallback((name: string) => {
    setActiveAgents((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        if (next.size > 1) next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const currentMetricConfig = METRICS.find((m) => m.key === selectedMetric)!;

  const visibleAgents = useMemo(
    () => agentInfos.filter((a) => activeAgents.has(a.agentName)),
    [agentInfos, activeAgents],
  );

  const focusedAgentInfo = useMemo(
    () => agentInfos.find((a) => a.agentName === focusedAgent) ?? null,
    [agentInfos, focusedAgent],
  );

  /* ═══════════════════════════════════════════════════════════
     ██  DETAIL VIEW — Single agent, all metrics
     ═══════════════════════════════════════════════════════════ */

  if (focusedAgentInfo) {
    const agent = focusedAgentInfo;
    const data = agent.detailData;
    const s = agent.stats;

    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        {/* Back + Agent Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFocusedAgent(null)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
            All Agents
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full shadow-sm"
              style={{ backgroundColor: agent.color }}
            />
            <h2 className="text-base font-bold text-foreground">
              {agent.agentName}
            </h2>
          </div>
        </div>

        {/* KPI Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            {
              label: "Runs",
              value: s.runCount.toString(),
              icon: Activity,
              accent: agent.color,
            },
            {
              label: "Avg Latency",
              value: formatDuration(s.avgLatency),
              icon: Clock,
              accent: "#22d3ee",
            },
            {
              label: "Success Rate",
              value: `${s.successRate}%`,
              icon: TrendingUp,
              accent: "#4ade80",
            },
            {
              label: "Total Tokens",
              value: formatTokens(s.totalTokens),
              icon: Hash,
              accent: "#a78bfa",
            },
            {
              label: "Total Cost",
              value: formatCost(s.totalCost),
              icon: Coins,
              accent: "#f97316",
            },
            {
              label: "Completed",
              value: `${s.completedRuns} / ${s.runCount}`,
              icon: s.failedRuns > 0 ? XCircle : CheckCircle2,
              accent: s.failedRuns > 0 ? "#ef4444" : "#4ade80",
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-lg border border-border bg-muted/20 px-3 py-2.5"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <kpi.icon
                  className="h-3 w-3"
                  style={{ color: kpi.accent }}
                />
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                  {kpi.label}
                </span>
              </div>
              <p
                className="text-sm font-bold tabular-nums"
                style={{ color: kpi.accent }}
              >
                {kpi.value}
              </p>
            </div>
          ))}
        </div>

        {/* 5 Metric Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {METRICS.map((m) => {
            const avg =
              data.length > 0
                ? data.reduce((a, d) => a + (d[m.key] as number), 0) /
                  data.length
                : 0;

            return (
              <div
                key={m.key}
                className="rounded-lg border border-border bg-background/50 p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <m.icon className="h-3.5 w-3.5" style={{ color: m.color }} />
                    <span className="text-xs font-semibold text-foreground">
                      {m.label}
                    </span>
                  </div>
                  <span
                    className="text-xs font-bold tabular-nums"
                    style={{ color: m.color }}
                  >
                    avg {m.format(avg)}
                  </span>
                </div>
                <div className="h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data}
                      margin={{ top: 4, right: 8, left: 4, bottom: 4 }}
                    >
                      <defs>
                        <linearGradient
                          id={`grad-${m.key}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={m.color}
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="100%"
                            stopColor={m.color}
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        strokeOpacity={0.4}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="timestamp"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        scale="time"
                        tickFormatter={formatTs}
                        tick={{
                          fontSize: 9,
                          fill: "hsl(var(--muted-foreground))",
                        }}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={40}
                      />
                      <YAxis
                        tickFormatter={(v: number) => m.format(v)}
                        tick={{
                          fontSize: 9,
                          fill: "hsl(var(--muted-foreground))",
                        }}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                        domain={["auto", "auto"]}
                      />
                      <Tooltip
                        content={
                          <DetailTooltip
                            color={m.color}
                            metricLabel={m.label}
                            metricFormat={m.format}
                          />
                        }
                        cursor={{
                          stroke: m.color,
                          strokeOpacity: 0.25,
                          strokeWidth: 1,
                        }}
                      />
                      <ReferenceLine
                        y={avg}
                        stroke={m.color}
                        strokeDasharray="4 4"
                        strokeOpacity={0.35}
                        strokeWidth={1}
                      />
                      <Area
                        type="monotone"
                        dataKey={m.key}
                        stroke={m.color}
                        strokeWidth={2}
                        fill={`url(#grad-${m.key})`}
                        dot={{
                          r: 3,
                          fill: m.color,
                          stroke: "hsl(var(--card))",
                          strokeWidth: 2,
                        }}
                        activeDot={{
                          r: 5,
                          fill: m.color,
                          stroke: "hsl(var(--card))",
                          strokeWidth: 2,
                        }}
                        isAnimationActive={true}
                        animationDuration={600}
                        animationEasing="ease-out"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     ██  OVERVIEW — All agents, single metric
     ═══════════════════════════════════════════════════════════ */

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Agent Performance
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Compare metrics across agents · Click a card below to drill in
            </p>
          </div>
        </div>

        {/* Metric Selector */}
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-0.5">
          {METRICS.map((m) => {
            const Icon = m.icon;
            const isActive = selectedMetric === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setSelectedMetric(m.key)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3 w-3" />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Agent Pills */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <span className="text-[10px] text-muted-foreground mr-1">Agents:</span>
        {agentInfos.map((agent) => {
          const isActive = activeAgents.has(agent.agentName);
          return (
            <button
              key={agent.agentName}
              onClick={() => toggleAgent(agent.agentName)}
              onMouseEnter={() => setHoveredAgent(agent.agentName)}
              onMouseLeave={() => setHoveredAgent(null)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200 border",
                isActive
                  ? "border-current shadow-sm"
                  : "border-border text-muted-foreground/50 hover:text-muted-foreground",
              )}
              style={
                isActive
                  ? { color: agent.color, borderColor: agent.color + "60" }
                  : undefined
              }
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: isActive ? agent.color : "currentColor",
                }}
              />
              {agent.agentName}
              <span className="text-[9px] opacity-60">
                ({agent.stats.runCount})
              </span>
            </button>
          );
        })}
      </div>

      {/* Chart Area — smooth area chart with brush slider */}
      <div className="w-full h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={overviewData}
            margin={{ top: 8, right: 16, left: 8, bottom: 4 }}
          >
            <defs>
              {visibleAgents.map((agent) => (
                <linearGradient
                  key={agent.agentName}
                  id={`area-${agent.agentName.replace(/\s/g, "-")}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={agent.color}
                    stopOpacity={
                      hoveredAgent === agent.agentName
                        ? 0.35
                        : hoveredAgent !== null
                          ? 0.04
                          : 0.2
                    }
                  />
                  <stop
                    offset="100%"
                    stopColor={agent.color}
                    stopOpacity={0.01}
                  />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid
              strokeDasharray="4 4"
              stroke="hsl(var(--border))"
              strokeOpacity={0.4}
              vertical={false}
            />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={["dataMin", "dataMax"]}
              scale="time"
              tickFormatter={formatTs}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))", strokeOpacity: 0.3 }}
              minTickGap={50}
            />
            <YAxis
              tickFormatter={(v: number) => currentMetricConfig.format(v)}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              width={60}
              domain={["auto", "auto"]}
            />
            <Tooltip
              content={<OverviewTooltip metricFormat={currentMetricConfig.format} />}
              cursor={{
                stroke: "hsl(var(--foreground))",
                strokeOpacity: 0.12,
                strokeDasharray: "4 4",
              }}
              animationDuration={120}
            />

            {/* Brush slider for zooming / time range selection */}
            <Brush
              dataKey="timestamp"
              height={24}
              stroke="hsl(var(--border))"
              fill="hsl(var(--muted))"
              tickFormatter={formatTs}
              travellerWidth={8}
            />

            {/* One Area per visible agent */}
            {visibleAgents.map((agent) => (
              <Area
                key={agent.agentName}
                type="monotone"
                dataKey={agent.agentName}
                stroke={agent.color}
                strokeWidth={
                  hoveredAgent === agent.agentName
                    ? 3
                    : hoveredAgent !== null
                      ? 1.2
                      : 2
                }
                strokeOpacity={
                  hoveredAgent !== null &&
                  hoveredAgent !== agent.agentName
                    ? 0.2
                    : 1
                }
                fill={`url(#area-${agent.agentName.replace(/\s/g, "-")})`}
                dot={false}
                activeDot={{
                  r: 5,
                  fill: agent.color,
                  stroke: "hsl(var(--card))",
                  strokeWidth: 2,
                }}
                connectNulls
                isAnimationActive={true}
                animationDuration={500}
                animationEasing="ease-out"
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Agent Stats Summary Row — clickable for drill-in */}
      <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
        {visibleAgents.map((agent) => {
          const isHovered = hoveredAgent === agent.agentName;
          return (
            <div
              key={agent.agentName}
              className={cn(
                "flex-shrink-0 rounded-lg border px-3 py-2 min-w-[150px] cursor-pointer transition-all duration-200 group",
                isHovered
                  ? "border-current bg-muted/30 scale-[1.02]"
                  : "border-border hover:border-border/80 hover:bg-muted/10",
              )}
              style={
                isHovered
                  ? { borderColor: agent.color + "50" }
                  : undefined
              }
              onClick={() => setFocusedAgent(agent.agentName)}
              onMouseEnter={() => setHoveredAgent(agent.agentName)}
              onMouseLeave={() => setHoveredAgent(null)}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shadow-sm"
                  style={{ backgroundColor: agent.color }}
                />
                <span className="text-[11px] font-semibold text-foreground truncate">
                  {agent.agentName}
                </span>
                <ArrowLeft className="h-3 w-3 text-muted-foreground/40 ml-auto rotate-180 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                <div className="text-[9px] text-muted-foreground">Latency</div>
                <div className="text-[9px] font-medium text-foreground text-right tabular-nums">
                  {formatDuration(agent.stats.avgLatency)}
                </div>
                <div className="text-[9px] text-muted-foreground">Success</div>
                <div className="text-[9px] font-medium text-foreground text-right tabular-nums">
                  {agent.stats.successRate}%
                </div>
                <div className="text-[9px] text-muted-foreground">Tokens</div>
                <div className="text-[9px] font-medium text-foreground text-right tabular-nums">
                  {formatTokens(agent.stats.totalTokens)}
                </div>
                <div className="text-[9px] text-muted-foreground">Cost</div>
                <div className="text-[9px] font-medium text-foreground text-right tabular-nums">
                  {formatCost(agent.stats.totalCost)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
