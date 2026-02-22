"use client";

/**
 * DetailHeader — Enhanced header for the agent detail view.
 * Shows run metadata with status badge, mock/live indicator, duration, steps, tokens, cost.
 *
 * NOTE: This is an ADDITIONAL header component for the detail view.
 * The existing HeaderStats component is NOT removed or modified.
 */

import React, { useMemo } from "react";
import {
  Clock,
  Coins,
  Hash,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDuration, formatTokens, formatCost, shortId } from "@/lib/utils";
import type { Run, Step } from "@/types";

interface DetailHeaderProps {
  run?: Run;
  steps: Step[];
  isLoading?: boolean;
}

export function DetailHeader({ run, steps, isLoading }: DetailHeaderProps) {
  const router = useRouter();

  const stats = useMemo(() => {
    if (!steps.length) return null;
    const totalDuration = steps.reduce((a, s) => a + (s.duration_ms || 0), 0);
    const totalPromptTokens = steps.reduce((a, s) => a + (s.tokens_prompt || 0), 0);
    const totalCompletionTokens = steps.reduce((a, s) => a + (s.tokens_completion || 0), 0);
    const totalCost = steps.reduce((a, s) => a + (s.cost_usd || 0), 0);
    return { totalDuration, totalPromptTokens, totalCompletionTokens, totalTokens: totalPromptTokens + totalCompletionTokens, totalCost, stepsCount: steps.length };
  }, [steps]);

  if (isLoading || !run) {
    return (
      <div className="flex items-center gap-4 border-b border-border bg-card px-4 py-3">
        <div className="h-5 w-32 bg-border rounded animate-pulse" />
      </div>
    );
  }

  const StatusIcon =
    run.status === "running" ? Loader2 : run.status === "completed" ? CheckCircle2 : XCircle;

  // Derive agent name from tags
  const agentName = run.metadata?.tags?.length > 0
    ? run.metadata.tags[0].replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : `Run ${shortId(run.run_id)}`;

  return (
    <div className="flex items-center gap-4 border-b border-border bg-card px-4 py-2.5">
      {/* Back button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => router.push("/dashboard")}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      {/* Agent Name */}
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground truncate">{agentName}</h2>
        <p className="text-[10px] text-muted-foreground/60 font-mono">{shortId(run.run_id)}</p>
      </div>

      {/* Status */}
      <div className="flex items-center gap-1.5 ml-2">
        <StatusIcon
          className={cn(
            "h-4 w-4",
            run.status === "running" && "animate-spin text-blue-400",
            run.status === "completed" && "text-cyan-400",
            run.status === "failed" && "text-red-400"
          )}
        />
        <Badge variant={run.status as "running" | "completed" | "failed"} className="text-[10px]">
          {run.status}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {run.system_type === "mock" ? "🧪 Mock" : run.system_type}
        </Badge>
      </div>

      <div className="h-4 w-px bg-border mx-1" />

      {/* Stats */}
      {stats && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground/60" />
            {formatDuration(stats.totalDuration)}
          </span>
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3 text-muted-foreground/60" />
            {stats.stepsCount} steps
          </span>
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3 text-muted-foreground/60" />
            {formatTokens(stats.totalTokens)}
            <span className="text-[10px] text-muted-foreground/60">
              ({formatTokens(stats.totalPromptTokens)}p / {formatTokens(stats.totalCompletionTokens)}c)
            </span>
          </span>
          <span className="flex items-center gap-1">
            <Coins className="h-3 w-3 text-muted-foreground/60" />
            <span className="text-emerald-400 font-medium">{formatCost(stats.totalCost)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
