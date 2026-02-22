"use client";

/**
 * AgentCard — Compact card representing an AI agent run in the dashboard grid.
 * Shows: agent name, status indicator, sparkline trend, key stats, last-run timestamp.
 * Clicking navigates to the Agent Detail View.
 *
 * NOTE: This is a presentational component only. All data fetching happens in the parent.
 */

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Clock,
  Hash,
  Coins,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Sparkline } from "@/components/dashboard/sparkline";
import { cn, formatDuration, formatTokens, formatCost, formatTimestamp } from "@/lib/utils";
import type { Run, Step, RunStatus } from "@/types";

interface AgentCardProps {
  run: Run;
  steps: Step[];
}

const STATUS_CONFIG: Record<RunStatus, { icon: React.ElementType; color: string; dotColor: string; label: string }> = {
  running: {
    icon: Loader2,
    color: "text-zinc-300",
    dotColor: "bg-zinc-300",
    label: "Running",
  },
  completed: {
    icon: CheckCircle2,
    color: "text-zinc-400",
    dotColor: "bg-zinc-400",
    label: "Completed",
  },
  failed: {
    icon: XCircle,
    color: "text-red-400",
    dotColor: "bg-red-400",
    label: "Failed",
  },
};

export function AgentCard({ run, steps }: AgentCardProps) {
  const router = useRouter();
  const statusConfig = STATUS_CONFIG[run.status];
  const StatusIcon = statusConfig.icon;

  // Compute aggregate stats from steps
  const stats = useMemo(() => {
    const totalTokens = steps.reduce(
      (acc, s) => acc + (s.tokens_prompt || 0) + (s.tokens_completion || 0),
      0
    );
    const totalCost = steps.reduce((acc, s) => acc + (s.cost_usd || 0), 0);
    const totalDuration = steps.reduce((acc, s) => acc + (s.duration_ms || 0), 0);
    const completedSteps = steps.filter((s) => s.status === "completed").length;
    const failedSteps = steps.filter((s) => s.status === "failed").length;
    const successRate = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;
    const avgLatency = steps.length > 0 ? Math.round(totalDuration / steps.length) : 0;

    return {
      totalRuns: steps.length,
      successRate,
      avgLatency,
      totalTokens,
      totalCost,
      totalDuration,
      failedSteps,
    };
  }, [steps]);

  // Generate sparkline data from step durations for a mini performance trend
  const sparklineData = useMemo(() => {
    if (steps.length === 0) return [];
    return steps.slice(-12).map((s) => s.duration_ms || 0);
  }, [steps]);

  // Determine sparkline color based on status
  const sparklineColor =
    run.status === "failed"
      ? "#ef4444"
      : run.status === "running"
      ? "#d4d4d8"
      : "#a1a1aa";

  // Determine the scenario / agent name from the run metadata tags
  const agentName = useMemo(() => {
    if (run.metadata?.tags?.length > 0) {
      return run.metadata.tags[0]
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    // Fallback: derive from first step name or run_id
    if (steps.length > 0) return steps[0].name;
    return `Agent ${run.run_id.slice(0, 6)}`;
  }, [run, steps]);

  return (
    <button
      onClick={() => router.push(`/runs/${run.run_id}`)}
      className={cn(
        "group relative w-full rounded-xl border text-left transition-all duration-200",
        "bg-card border-border hover:border-zinc-500/40 hover:shadow-lg hover:shadow-zinc-500/5",
        "focus:outline-none focus:ring-2 focus:ring-zinc-400/40",
        run.status === "failed" && "border-red-500/30 hover:border-red-500/50",
        run.status === "running" && "border-zinc-500/30 hover:border-zinc-400/50"
      )}
    >
      {/* Status indicator bar at top */}
      <div
        className={cn(
          "absolute top-0 left-4 right-4 h-[2px] rounded-b-full opacity-60 group-hover:opacity-100 transition-opacity",
          run.status === "completed" && "bg-zinc-400",
          run.status === "failed" && "bg-red-400",
          run.status === "running" && "bg-zinc-300"
        )}
      />

      <div className="p-4 space-y-3">
        {/* Header: Name + Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-foreground transition-colors">
              {agentName}
            </h3>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
              {run.run_id.slice(0, 8)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className={cn("h-2 w-2 rounded-full", statusConfig.dotColor, run.status === "running" && "animate-pulse")} />
            <StatusIcon
              className={cn(
                "h-4 w-4",
                statusConfig.color,
                run.status === "running" && "animate-spin"
              )}
            />
          </div>
        </div>

        {/* Sparkline */}
        <div className="flex items-center justify-between">
          <Sparkline
            data={sparklineData}
            width={140}
            height={28}
            color={sparklineColor}
            filled
          />
          <Badge
            variant={run.status as "running" | "completed" | "failed"}
            className="text-[10px] px-1.5 py-0 shrink-0"
          >
            {run.system_type}
          </Badge>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Steps</span>
            <span className="text-[11px] font-medium text-foreground ml-auto">
              {stats.totalRuns}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Success</span>
            <span
              className={cn(
                "text-[11px] font-medium ml-auto",
                stats.successRate >= 80 ? "text-foreground" : stats.successRate >= 50 ? "text-zinc-400" : "text-red-400"
              )}
            >
              {stats.successRate}%
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Latency</span>
            <span className="text-[11px] font-medium text-foreground ml-auto">
              {formatDuration(stats.avgLatency)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Hash className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Tokens</span>
            <span className="text-[11px] font-medium text-foreground ml-auto">
              {formatTokens(stats.totalTokens)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 col-span-2">
            <Coins className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Cost</span>
            <span className="text-[11px] font-medium text-foreground ml-auto">
              {formatCost(stats.totalCost)}
            </span>
          </div>
        </div>

        {/* Footer: Last run timestamp */}
        <div className="flex items-center gap-1.5 pt-1 border-t border-border">
          <Clock className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-[10px] text-muted-foreground">
            Last run: {formatTimestamp(run.updated_at)}
          </span>
        </div>
      </div>
    </button>
  );
}
