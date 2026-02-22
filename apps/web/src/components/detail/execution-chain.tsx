"use client";

/**
 * ExecutionChain — Vertical flowchart view of agent execution steps.
 * Alternative to the ReactFlow graph — a clean linear chain/timeline.
 * Shows each step as a node with: name, type badge, status badge, execution time, token count.
 * Nodes are connected by vertical lines. Failed steps have red borders.
 *
 * NOTE: This is purely presentational. The step data is identical to what ExecutionGraph uses.
 * The existing ExecutionGraph component is NOT modified or removed.
 */

import React from "react";
import {
  Brain,
  Wrench,
  Target,
  Flag,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCcw,
  Clock,
  Hash,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatDuration, formatTokens } from "@/lib/utils";
import type { Step, StepType, StepStatus } from "@/types";

interface ExecutionChainProps {
  steps: Step[];
  onStepClick?: (step: Step) => void;
  selectedStepId?: string;
}

const STEP_ICONS: Record<StepType, React.ElementType> = {
  llm: Brain,
  tool: Wrench,
  plan: Target,
  final: Flag,
  error: AlertTriangle,
};

const STATUS_ICONS: Record<StepStatus, React.ElementType> = {
  running: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
  retrying: RotateCcw,
};

const TYPE_COLORS: Record<StepType, string> = {
  llm: "border-l-blue-500",
  tool: "border-l-purple-500",
  plan: "border-l-amber-500",
  final: "border-l-emerald-500",
  error: "border-l-red-500",
};

const STATUS_LINE_COLORS: Record<StepStatus, string> = {
  running: "bg-blue-500/40",
  completed: "bg-cyan-500/30",
  failed: "bg-red-500/40",
  retrying: "bg-orange-500/40",
};

export function ExecutionChain({ steps, onStepClick, selectedStepId }: ExecutionChainProps) {
  // Sort steps by started_at for chain ordering
  const sortedSteps = [...steps].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  );

  if (sortedSteps.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-2">
          <Target className="h-10 w-10 mx-auto text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">No steps yet</p>
          <p className="text-xs text-muted-foreground/60">Steps will appear here as the agent executes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="relative">
        {sortedSteps.map((step, index) => {
          const StepIcon = STEP_ICONS[step.type] || Target;
          const StatusIcon = STATUS_ICONS[step.status] || CheckCircle2;
          const isLast = index === sortedSteps.length - 1;
          const isFailed = step.status === "failed";
          const isSelected = step.step_id === selectedStepId;
          const totalTokens = (step.tokens_prompt || 0) + (step.tokens_completion || 0);

          return (
            <div key={step.step_id} className="relative">
              {/* Connecting line */}
              {!isLast && (
                <div
                  className={cn(
                    "absolute left-6 top-[68px] w-0.5 h-8",
                    isFailed ? "bg-red-500/60" : STATUS_LINE_COLORS[step.status]
                  )}
                />
              )}

              {/* Step Node */}
              <button
                onClick={() => onStepClick?.(step)}
                className={cn(
                  "relative w-full text-left rounded-lg border-l-4 border border-border bg-card p-4 mb-2",
                  "transition-all duration-200 hover:bg-accent hover:border-muted-foreground/30",
                  "focus:outline-none focus:ring-2 focus:ring-cyan-500/30",
                  TYPE_COLORS[step.type],
                  isFailed && "border-red-500/50 bg-red-500/5",
                  isSelected && "ring-2 ring-cyan-500/40 border-cyan-500/40"
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      step.type === "llm" && "bg-blue-500/15 text-blue-400",
                      step.type === "tool" && "bg-purple-500/15 text-purple-400",
                      step.type === "plan" && "bg-amber-500/15 text-amber-400",
                      step.type === "final" && "bg-emerald-500/15 text-emerald-400",
                      step.type === "error" && "bg-red-500/15 text-red-400"
                    )}
                  >
                    <StepIcon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-foreground truncate">
                        {step.name}
                      </h4>
                    </div>

                    <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
                      <Badge variant={step.type as "llm" | "tool" | "plan" | "final" | "error"} className="text-[10px] px-1.5 py-0">
                        {step.type}
                      </Badge>
                      <Badge variant={step.status as "running" | "completed" | "failed" | "retrying"} className="text-[10px] px-1.5 py-0">
                        <StatusIcon className={cn("h-2.5 w-2.5 mr-0.5", step.status === "running" && "animate-spin")} />
                        {step.status}
                      </Badge>

                      {/* Metrics */}
                      <div className="flex items-center gap-3 ml-auto text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(step.duration_ms)}
                        </span>
                        {totalTokens > 0 && (
                          <span className="flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {formatTokens(totalTokens)} tok
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Error message if failed */}
                    {step.error && (
                      <div className="mt-2 rounded bg-red-500/10 border border-red-500/20 px-2 py-1.5">
                        <p className="text-[11px] text-red-400 font-mono truncate">
                          {step.error.message}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </button>

              {/* Connector arrow for non-last items */}
              {!isLast && (
                <div className="flex justify-center py-0.5">
                  <ChevronDown className={cn("h-3 w-3", isFailed ? "text-red-500/60" : "text-muted-foreground/60")} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
