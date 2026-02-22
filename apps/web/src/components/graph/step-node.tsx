"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Badge } from "@/components/ui/badge";
import { cn, formatDuration, formatTokens } from "@/lib/utils";
import type { Step, StepType, StepStatus } from "@/types";

const TYPE_BORDER: Record<StepType, string> = {
  llm: "border-l-zinc-300",
  tool: "border-l-zinc-400",
  plan: "border-l-zinc-500",
  final: "border-l-white",
  error: "border-l-red-500",
};

const STATUS_RING: Record<StepStatus, string> = {
  running: "ring-2 ring-zinc-400/40",
  completed: "",
  failed: "ring-2 ring-red-500/40",
  retrying: "ring-2 ring-zinc-500/40",
};

const TYPE_ICON: Record<StepType, string> = {
  llm: "◆",
  tool: "▪",
  plan: "▸",
  final: "●",
  error: "✕",
};

function StepNodeComponent({ data, selected }: NodeProps<Step>) {
  const step = data;
  const totalTokens = step.tokens_prompt + step.tokens_completion;

  return (
    <div
      className={cn(
        "node-animate-in rounded-lg border-l-4 border bg-card shadow-md transition-all duration-200 cursor-pointer min-w-[240px]",
        TYPE_BORDER[step.type] || "border-l-gray-500",
        STATUS_RING[step.status] || "",
        selected && "ring-2 ring-primary",
        "hover:shadow-lg hover:scale-[1.02]"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-muted-foreground !w-2 !h-2 !border-0"
      />

      <div className="px-3 py-2.5">
        {/* Header: type icon + name */}
        <div className="flex items-center gap-2">
          <span className="text-base">{TYPE_ICON[step.type] || "📌"}</span>
          <span className="text-sm font-semibold truncate max-w-[170px]">
            {step.name}
          </span>
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <Badge
            variant={step.type as "llm" | "tool" | "plan" | "final" | "error"}
            className="text-[10px] px-1.5 py-0"
          >
            {step.type}
          </Badge>
          <Badge
            variant={step.status as "running" | "completed" | "failed" | "retrying"}
            className={cn(
              "text-[10px] px-1.5 py-0",
              step.status === "running" && "animate-pulse"
            )}
          >
            {step.status}
          </Badge>
        </div>

        {/* Metrics row */}
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
          {step.duration_ms > 0 && (
            <span>{formatDuration(step.duration_ms)}</span>
          )}
          {totalTokens > 0 && <span>{formatTokens(totalTokens)} tok</span>}
          {step.status === "running" && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse" />
              processing
            </span>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-muted-foreground !w-2 !h-2 !border-0"
      />
    </div>
  );
}

export const StepNode = memo(StepNodeComponent);
