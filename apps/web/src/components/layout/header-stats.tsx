"use client";

import {
  Clock,
  Coins,
  Hash,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDuration, formatTokens, formatCost } from "@/lib/utils";
import type { Run, Step } from "@/types";

interface HeaderStatsProps {
  run?: Run;
  steps?: Step[];
  isLoading?: boolean;
}

export function HeaderStats({ run, steps, isLoading }: HeaderStatsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-6 border-b bg-card px-6 py-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-20" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex items-center gap-4 border-b bg-card px-6 py-3">
        <span className="text-sm text-muted-foreground">
          Select a run to view details
        </span>
      </div>
    );
  }

  const totalDuration = steps?.reduce((acc, s) => acc + (s.duration_ms || 0), 0) ?? 0;
  const totalPromptTokens = steps?.reduce((acc, s) => acc + (s.tokens_prompt || 0), 0) ?? 0;
  const totalCompletionTokens = steps?.reduce((acc, s) => acc + (s.tokens_completion || 0), 0) ?? 0;
  const totalTokens = totalPromptTokens + totalCompletionTokens;
  const totalCost = steps?.reduce((acc, s) => acc + (s.cost_usd || 0), 0) ?? 0;
  const stepsCount = steps?.length ?? 0;

  const StatusIcon = run.status === "running"
    ? Loader2
    : run.status === "completed"
    ? CheckCircle2
    : XCircle;

  return (
    <div className="flex items-center gap-6 border-b bg-card px-6 py-3">
      {/* Run Status */}
      <div className="flex items-center gap-2">
        <StatusIcon
          className={cn(
            "h-4 w-4",
            run.status === "running" && "animate-spin text-zinc-300",
            run.status === "completed" && "text-zinc-400",
            run.status === "failed" && "text-red-400"
          )}
        />
        <Badge variant={run.status as "running" | "completed" | "failed"}>
          {run.status}
        </Badge>
        <Badge variant="outline" className="ml-1">
          {run.system_type}
        </Badge>
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Duration */}
      <div className="flex items-center gap-1.5 text-sm">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Duration:</span>
        <span className="font-medium">{formatDuration(totalDuration)}</span>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-1.5 text-sm">
        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Steps:</span>
        <span className="font-medium">{stepsCount}</span>
      </div>

      {/* Tokens */}
      <div className="flex items-center gap-1.5 text-sm">
        <Hash className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Tokens:</span>
        <span className="font-medium">{formatTokens(totalTokens)}</span>
        <span className="text-xs text-muted-foreground/70">
          ({formatTokens(totalPromptTokens)}p / {formatTokens(totalCompletionTokens)}c)
        </span>
      </div>

      {/* Cost */}
      <div className="flex items-center gap-1.5 text-sm">
        <Coins className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Cost:</span>
        <span className="font-medium text-foreground">{formatCost(totalCost)}</span>
      </div>
    </div>
  );
}
