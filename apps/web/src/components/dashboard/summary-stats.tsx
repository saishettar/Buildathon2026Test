"use client";

/**
 * SummaryStats — Row of KPI stat boxes displayed near the hero chart.
 * Shows aggregate metrics like total runs, overall success rate, avg latency, total cost.
 *
 * NOTE: Purely presentational. Data is derived from runs/steps passed as props.
 */

import React, { useMemo } from "react";
import {
  Activity,
  TrendingUp,
  Zap,
  Coins,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn, formatDuration, formatCost } from "@/lib/utils";
import type { Run, Step } from "@/types";

interface SummaryStatsProps {
  runs: Run[];
  stepsMap: Record<string, Step[]>;
}

interface StatItem {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ElementType;
  color: string;
  trend?: "up" | "down" | "neutral";
}

export function SummaryStats({ runs, stepsMap }: SummaryStatsProps) {
  const stats: StatItem[] = useMemo(() => {
    const totalRuns = runs.length;
    const completedRuns = runs.filter((r) => r.status === "completed").length;
    const failedRuns = runs.filter((r) => r.status === "failed").length;
    const runningRuns = runs.filter((r) => r.status === "running").length;
    const overallSuccessRate =
      totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0;

    let totalSteps = 0;
    let totalDuration = 0;
    let totalCostUsd = 0;
    let totalTokens = 0;

    Object.values(stepsMap).forEach((steps) => {
      steps.forEach((s) => {
        totalSteps++;
        totalDuration += s.duration_ms || 0;
        totalCostUsd += s.cost_usd || 0;
        totalTokens += (s.tokens_prompt || 0) + (s.tokens_completion || 0);
      });
    });

    const avgLatency = totalSteps > 0 ? Math.round(totalDuration / totalSteps) : 0;

    return [
      {
        label: "Total Runs",
        value: totalRuns.toString(),
        subValue: `${runningRuns} active`,
        icon: Activity,
        color: "text-foreground",
        trend: "neutral" as const,
      },
      {
        label: "Success Rate",
        value: `${overallSuccessRate}%`,
        subValue: `${completedRuns}/${totalRuns} runs`,
        icon: TrendingUp,
        color: overallSuccessRate >= 80 ? "text-foreground" : overallSuccessRate >= 50 ? "text-zinc-400" : "text-red-400",
        trend: overallSuccessRate >= 80 ? "up" as const : "down" as const,
      },
      {
        label: "Avg Latency",
        value: formatDuration(avgLatency),
        subValue: `${totalSteps} total steps`,
        icon: Zap,
        color: "text-zinc-300",
        trend: "neutral" as const,
      },
      {
        label: "Total Cost",
        value: formatCost(totalCostUsd),
        subValue: `${totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens} tokens`,
        icon: Coins,
        color: "text-foreground",
        trend: "neutral" as const,
      },
      {
        label: "Errors",
        value: failedRuns.toString(),
        subValue: `${totalRuns > 0 ? Math.round((failedRuns / totalRuns) * 100) : 0}% error rate`,
        icon: failedRuns > 0 ? AlertTriangle : CheckCircle2,
        color: failedRuns > 0 ? "text-red-400" : "text-zinc-400",
        trend: failedRuns > 0 ? "down" as const : "up" as const,
      },
    ];
  }, [runs, stepsMap]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className={cn(
              "rounded-lg border border-border bg-card p-3",
              "hover:border-muted-foreground/30 transition-colors"
            )}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Icon className={cn("h-3.5 w-3.5", stat.color)} />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                {stat.label}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-xl font-bold", stat.color)}>
                {stat.value}
              </span>
            </div>
            {stat.subValue && (
              <p className="text-[10px] text-muted-foreground/60 mt-1">{stat.subValue}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
