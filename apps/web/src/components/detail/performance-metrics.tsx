"use client";

/**
 * PerformanceMetrics — Detailed metrics panel for the agent detail view.
 * Shows: Token Usage, Cost Analysis, Latency & Timing, Error Handling.
 * Includes a circular score gauge (0-100) and run metadata.
 *
 * NOTE: Purely presentational. All data is derived from run + steps props.
 * No API calls are made here — analysis data is passed in.
 */

import React, { useMemo } from "react";
import {
  Hash,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Activity,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatDuration, formatTokens, formatCost } from "@/lib/utils";
import type { Run, Step } from "@/types";

interface PerformanceMetricsProps {
  run: Run;
  steps: Step[];
}

/** Circular score gauge SVG component */
function ScoreGauge({ score }: { score: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 90
      ? "#22d3ee"
      : score >= 70
      ? "#34d399"
      : score >= 50
      ? "#fbbf24"
      : "#ef4444";

  const bgGlow =
    score >= 90
      ? "shadow-cyan-500/20"
      : score >= 70
      ? "shadow-emerald-500/20"
      : score >= 50
      ? "shadow-amber-500/20"
      : "shadow-red-500/20";

  return (
    <div className={cn("relative inline-flex items-center justify-center rounded-full shadow-lg", bgGlow)}>
      <svg width="104" height="104" className="-rotate-90">
        <circle
          cx="52"
          cy="52"
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="7"
        />
        <circle
          cx="52"
          cy="52"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold" style={{ color }}>
          {score}
        </span>
        <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium">
          Score
        </span>
      </div>
    </div>
  );
}

/** Metric card component */
function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  color = "text-foreground",
  iconColor = "text-muted-foreground",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
  color?: string;
  iconColor?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-1">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", iconColor)} />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          {label}
        </span>
      </div>
      <p className={cn("text-lg font-bold", color)}>{value}</p>
      {subValue && (
        <p className="text-[10px] text-muted-foreground/60">{subValue}</p>
      )}
    </div>
  );
}

export function PerformanceMetrics({ run, steps }: PerformanceMetricsProps) {
  const metrics = useMemo(() => {
    const totalPromptTokens = steps.reduce((a, s) => a + (s.tokens_prompt || 0), 0);
    const totalCompletionTokens = steps.reduce((a, s) => a + (s.tokens_completion || 0), 0);
    const totalTokens = totalPromptTokens + totalCompletionTokens;
    const totalCost = steps.reduce((a, s) => a + (s.cost_usd || 0), 0);
    const totalDuration = steps.reduce((a, s) => a + (s.duration_ms || 0), 0);
    const avgDuration = steps.length > 0 ? totalDuration / steps.length : 0;

    // Compute percentiles for latency
    const durations = steps.map((s) => s.duration_ms).sort((a, b) => a - b);
    const p50 = durations[Math.floor(durations.length * 0.5)] || 0;
    const p95 = durations[Math.floor(durations.length * 0.95)] || 0;
    const p99 = durations[Math.floor(durations.length * 0.99)] || 0;

    const completedSteps = steps.filter((s) => s.status === "completed").length;
    const failedSteps = steps.filter((s) => s.status === "failed").length;
    const retryingSteps = steps.filter((s) => s.status === "retrying").length;
    const errorRate = steps.length > 0 ? Math.round((failedSteps / steps.length) * 100) : 0;

    // Derive a simple performance score
    const successWeight = completedSteps / Math.max(steps.length, 1);
    const latencyScore = Math.max(0, 100 - (avgDuration / 50)); // Penalize high latency
    const score = Math.min(100, Math.round(successWeight * 70 + Math.min(latencyScore, 30)));

    // Common errors
    const errorMessages = steps
      .filter((s) => s.error)
      .map((s) => s.error!.message);
    const errorCounts: Record<string, number> = {};
    errorMessages.forEach((msg) => {
      errorCounts[msg] = (errorCounts[msg] || 0) + 1;
    });
    const topErrors = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    return {
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      totalCost,
      totalDuration,
      avgDuration,
      p50,
      p95,
      p99,
      completedSteps,
      failedSteps,
      retryingSteps,
      errorRate,
      score,
      topErrors,
      stepsCount: steps.length,
    };
  }, [steps]);

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header: Score + Run Metadata */}
        <div className="flex items-start gap-6">
          <ScoreGauge score={metrics.score} />

          <div className="flex-1 space-y-3">
            <h3 className="text-base font-semibold text-foreground">Performance Overview</h3>

            {/* Run Metadata Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={run.status as "running" | "completed" | "failed"} className="text-xs">
                {run.status === "running" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {run.status === "completed" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                {run.status === "failed" && <XCircle className="h-3 w-3 mr-1" />}
                {run.status}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {run.system_type === "mock" ? "🧪 Mock" : run.system_type}
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {formatDuration(metrics.totalDuration)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Activity className="h-3 w-3 mr-1" />
                {metrics.stepsCount} steps
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Hash className="h-3 w-3 mr-1" />
                {formatTokens(metrics.totalTokens)} tokens
              </Badge>
              <Badge variant="outline" className="text-xs">
                <DollarSign className="h-3 w-3 mr-1" />
                {formatCost(metrics.totalCost)}
              </Badge>
            </div>
          </div>
        </div>

        <Separator />

        {/* Token Usage */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
            <Hash className="h-4 w-4 text-cyan-400" />
            Token Usage
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              icon={ArrowUpRight}
              label="Input Tokens"
              value={formatTokens(metrics.totalPromptTokens)}
              iconColor="text-cyan-400"
              color="text-cyan-400"
            />
            <MetricCard
              icon={ArrowDownRight}
              label="Output Tokens"
              value={formatTokens(metrics.totalCompletionTokens)}
              iconColor="text-violet-400"
              color="text-violet-400"
            />
            <MetricCard
              icon={TrendingUp}
              label="Total Tokens"
              value={formatTokens(metrics.totalTokens)}
              subValue={`${((metrics.totalPromptTokens / Math.max(metrics.totalTokens, 1)) * 100).toFixed(0)}% input`}
              iconColor="text-emerald-400"
              color="text-emerald-400"
            />
          </div>
        </div>

        {/* Cost Analysis */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-400" />
            Cost Analysis
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              icon={DollarSign}
              label="Total Cost"
              value={formatCost(metrics.totalCost)}
              iconColor="text-emerald-400"
              color="text-emerald-400"
            />
            <MetricCard
              icon={DollarSign}
              label="Avg Per Step"
              value={formatCost(metrics.stepsCount > 0 ? metrics.totalCost / metrics.stepsCount : 0)}
              iconColor="text-amber-400"
              color="text-amber-400"
            />
            <MetricCard
              icon={DollarSign}
              label="Cost / 1k Tokens"
              value={formatCost(metrics.totalTokens > 0 ? (metrics.totalCost / metrics.totalTokens) * 1000 : 0)}
              iconColor="text-cyan-400"
              color="text-cyan-400"
            />
          </div>
        </div>

        {/* Latency & Timing */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
            <Clock className="h-4 w-4 text-violet-400" />
            Latency & Timing
          </h4>
          <div className="grid grid-cols-4 gap-3">
            <MetricCard
              icon={Clock}
              label="Average"
              value={formatDuration(Math.round(metrics.avgDuration))}
              iconColor="text-violet-400"
              color="text-violet-400"
            />
            <MetricCard
              icon={Clock}
              label="P50"
              value={formatDuration(metrics.p50)}
              iconColor="text-blue-400"
              color="text-blue-400"
            />
            <MetricCard
              icon={Clock}
              label="P95"
              value={formatDuration(metrics.p95)}
              iconColor="text-amber-400"
              color="text-amber-400"
            />
            <MetricCard
              icon={Clock}
              label="P99"
              value={formatDuration(metrics.p99)}
              iconColor="text-red-400"
              color="text-red-400"
            />
          </div>
        </div>

        {/* Error Handling */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Error Handling
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              icon={AlertTriangle}
              label="Error Rate"
              value={`${metrics.errorRate}%`}
              subValue={`${metrics.failedSteps} failed of ${metrics.stepsCount}`}
              iconColor={metrics.errorRate > 0 ? "text-red-400" : "text-emerald-400"}
              color={metrics.errorRate > 0 ? "text-red-400" : "text-emerald-400"}
            />
            <MetricCard
              icon={RotateCcw}
              label="Retries"
              value={metrics.retryingSteps.toString()}
              iconColor="text-orange-400"
              color="text-orange-400"
            />
            <MetricCard
              icon={CheckCircle2}
              label="Completed"
              value={metrics.completedSteps.toString()}
              subValue={`${metrics.stepsCount > 0 ? Math.round((metrics.completedSteps / metrics.stepsCount) * 100) : 0}% success`}
              iconColor="text-emerald-400"
              color="text-emerald-400"
            />
          </div>

          {/* Top Errors */}
          {metrics.topErrors.length > 0 && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-2">
              <h5 className="text-xs font-medium text-red-400">Most Common Errors</h5>
              {metrics.topErrors.map(([msg, count], i) => (
                <div key={i} className="flex items-start gap-2">
                  <XCircle className="h-3 w-3 mt-0.5 text-red-400 shrink-0" />
                  <span className="text-[11px] text-red-300/80 font-mono flex-1 truncate">
                    {msg}
                  </span>
                  <Badge variant="destructive" className="text-[9px] px-1 py-0 shrink-0">
                    ×{count}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
