"use client";

import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock,
  Hash,
  Coins,
  Copy,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Loader2,
  BookOpen,
  FileText,
  ArrowDownToLine,
  ArrowUpFromLine,
  Gauge,
} from "lucide-react";
import { cn, formatDuration, formatTokens, formatCost, formatTimestamp } from "@/lib/utils";
import { summarizeStep, type StepSummaryResponse } from "@/lib/api";
import type { Step } from "@/types";

interface StepInspectorProps {
  step: Step | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copy}>
      {copied ? (
        <Check className="h-3 w-3 text-green-400" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );
}

function JsonBlock({ label, data }: { label: string; data: unknown }) {
  const [expanded, setExpanded] = useState(true);
  const json = JSON.stringify(data, null, 2);
  const isEmpty =
    data === null ||
    data === undefined ||
    (typeof data === "object" && Object.keys(data as object).length === 0);

  if (isEmpty) return null;

  return (
    <div className="space-y-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {label}
      </button>
      {expanded && (
        <div className="relative">
          <div className="absolute right-2 top-2">
            <CopyButton text={json} />
          </div>
          <pre className="rounded-md bg-muted/50 p-3 text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto">
            {json}
          </pre>
        </div>
      )}
    </div>
  );
}

export function StepInspector({ step, open, onOpenChange }: StepInspectorProps) {
  const [aiSummary, setAiSummary] = useState<StepSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [lastSummarizedId, setLastSummarizedId] = useState<string | null>(null);

  // Reset when step changes
  useEffect(() => {
    if (step && step.step_id !== lastSummarizedId) {
      setAiSummary(null);
      setShowRaw(false);
    }
  }, [step, lastSummarizedId]);

  const handleSummarize = async () => {
    if (!step) return;
    setSummaryLoading(true);
    try {
      const result = await summarizeStep(step.step_id);
      setAiSummary(result);
      setLastSummarizedId(step.step_id);
    } catch {
      // silently fail — user still has raw data
    } finally {
      setSummaryLoading(false);
    }
  };

  if (!step) return null;

  const totalTokens = step.tokens_prompt + step.tokens_completion;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-base">{step.name}</SheetTitle>
          </div>
          <SheetDescription className="flex items-center gap-2">
            <Badge
              variant={step.type as "llm" | "tool" | "plan" | "final" | "error"}
            >
              {step.type}
            </Badge>
            <Badge
              variant={step.status as "running" | "completed" | "failed" | "retrying"}
            >
              {step.status}
            </Badge>
          </SheetDescription>
        </SheetHeader>

        <Separator />

        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-5">
            {/* Summary metrics */}
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                icon={Clock}
                label="Duration"
                value={formatDuration(step.duration_ms)}
              />
              <MetricCard
                icon={Hash}
                label="Total Tokens"
                value={formatTokens(totalTokens)}
              />
              <MetricCard
                icon={Coins}
                label="Cost"
                value={formatCost(step.cost_usd)}
              />
              <MetricCard
                icon={Clock}
                label="Started"
                value={formatTimestamp(step.started_at)}
              />
            </div>

            {/* Token breakdown */}
            {totalTokens > 0 && (
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Token Breakdown
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Prompt: </span>
                    <span className="font-medium">
                      {formatTokens(step.tokens_prompt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Completion: </span>
                    <span className="font-medium">
                      {formatTokens(step.tokens_completion)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* AI Summary Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-400" />
                  <span className="text-sm font-semibold">AI Summary</span>
                </div>
                {!aiSummary && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSummarize}
                    disabled={summaryLoading}
                    className="h-7 text-xs"
                  >
                    {summaryLoading ? (
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3 mr-1.5" />
                    )}
                    {summaryLoading ? "Analyzing..." : "Explain this step"}
                  </Button>
                )}
              </div>

              {aiSummary ? (
                <div className="space-y-3">
                  {/* Plain summary */}
                  <div className="rounded-lg bg-violet-500/5 border border-violet-500/20 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <BookOpen className="h-3 w-3 text-violet-400" />
                      <span className="text-[11px] font-medium text-violet-400 uppercase tracking-wider">
                        What happened
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">
                      {aiSummary.plain_summary}
                    </p>
                  </div>

                  {/* Input summary */}
                  <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <ArrowDownToLine className="h-3 w-3 text-blue-400" />
                      <span className="text-[11px] font-medium text-blue-400 uppercase tracking-wider">
                        Input
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">
                      {aiSummary.input_summary}
                    </p>
                  </div>

                  {/* Output summary */}
                  <div className="rounded-lg bg-green-500/5 border border-green-500/20 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <ArrowUpFromLine className="h-3 w-3 text-green-400" />
                      <span className="text-[11px] font-medium text-green-400 uppercase tracking-wider">
                        Output
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">
                      {aiSummary.output_summary}
                    </p>
                  </div>

                  {/* Performance note */}
                  <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Gauge className="h-3 w-3 text-amber-400" />
                      <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">
                        Performance
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">
                      {aiSummary.performance_note}
                    </p>
                  </div>
                </div>
              ) : !summaryLoading ? (
                <p className="text-xs text-muted-foreground pl-6">
                  Click &quot;Explain this step&quot; to get a human-readable summary of the input
                  and output data.
                </p>
              ) : null}
            </div>

            <Separator />

            {/* Toggle between Raw & Formatted views */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {showRaw ? "Raw Data" : "Formatted Data"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowRaw(!showRaw)}
              >
                <FileText className="h-3 w-3 mr-1.5" />
                {showRaw ? "Show formatted" : "Show raw JSON"}
              </Button>
            </div>

            {showRaw ? (
              <>
                {/* Raw Input/Output JSON */}
                <JsonBlock label="Raw Input" data={step.input} />
                <JsonBlock label="Raw Output" data={step.output} />
              </>
            ) : (
            <>
            {/* LLM-specific: Prompt & Completion */}
            {step.type === "llm" && (
              <>
                {step.input?.prompt && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Prompt
                    </p>
                    <div className="relative">
                      <div className="absolute right-2 top-2">
                        <CopyButton text={String(step.input.prompt)} />
                      </div>
                      <div className="rounded-md bg-blue-500/5 border border-blue-500/20 p-3 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {String(step.input.prompt)}
                      </div>
                    </div>
                  </div>
                )}
                {step.output?.completion && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Completion
                    </p>
                    <div className="relative">
                      <div className="absolute right-2 top-2">
                        <CopyButton text={String(step.output.completion)} />
                      </div>
                      <div className="rounded-md bg-green-500/5 border border-green-500/20 p-3 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {String(step.output.completion)}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Tool-specific */}
            {step.type === "tool" && (
              <>
                {step.input?.tool && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Tool Name
                    </p>
                    <code className="rounded bg-purple-500/10 px-2 py-1 text-sm text-purple-400">
                      {String(step.input.tool)}
                    </code>
                  </div>
                )}
                {step.input?.args && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Arguments
                    </p>
                    <div className="relative">
                      <div className="absolute right-2 top-2">
                        <CopyButton
                          text={JSON.stringify(step.input.args, null, 2)}
                        />
                      </div>
                      <pre className="rounded-md bg-purple-500/5 border border-purple-500/20 p-3 text-xs font-mono overflow-x-auto max-h-32 overflow-y-auto">
                        {JSON.stringify(step.input.args, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Error details */}
            {step.error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Error</span>
                  {step.error.code && (
                    <Badge variant="destructive" className="text-[10px]">
                      {step.error.code}
                    </Badge>
                  )}
                </div>
                <p className="text-sm">{step.error.message}</p>
                {step.error.stack && (
                  <pre className="mt-2 rounded bg-red-500/10 p-2 text-xs font-mono text-red-300 overflow-x-auto max-h-32 overflow-y-auto">
                    {step.error.stack}
                  </pre>
                )}
              </div>
            )}
            </>
            )}

            <Separator />

            {/* Timestamps */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Timestamps
              </p>
              <div className="rounded-md bg-muted/30 p-3 text-xs font-mono space-y-1">
                <div>
                  <span className="text-muted-foreground">step_id:    </span>
                  {step.step_id}
                </div>
                <div>
                  <span className="text-muted-foreground">run_id:     </span>
                  {step.run_id}
                </div>
                {step.parent_step_id && (
                  <div>
                    <span className="text-muted-foreground">parent_id:  </span>
                    {step.parent_step_id}
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">started_at: </span>
                  {step.started_at}
                </div>
                {step.ended_at && (
                  <div>
                    <span className="text-muted-foreground">ended_at:   </span>
                    {step.ended_at}
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}
