"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  Loader2,
  TrendingUp,
  Zap,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { analyzeRun, type RunAnalysis } from "@/lib/api";

interface AnalysisPanelProps {
  runId: string;
  runStatus?: string;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 90
      ? "text-white"
      : score >= 70
      ? "text-zinc-300"
      : score >= 50
      ? "text-zinc-500"
      : "text-red-400";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="88" height="88" className="-rotate-90">
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth="6"
        />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          className={cn("transition-all duration-1000", color.replace("text-", "stroke-"))}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn("text-2xl font-bold", color)}>{score}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Score
        </span>
      </div>
    </div>
  );
}

function AnalysisSection({
  icon: Icon,
  title,
  content,
  variant = "default",
}: {
  icon: React.ElementType;
  title: string;
  content: string;
  variant?: "default" | "warning" | "success";
}) {
  const iconColor =
    variant === "warning"
      ? "text-zinc-400"
      : variant === "success"
      ? "text-zinc-400"
      : "text-zinc-400";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", iconColor)} />
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed pl-6">
        {content}
      </p>
    </div>
  );
}

export function AnalysisPanel({ runId, runStatus }: AnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<RunAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await analyzeRun(runId);
      setAnalysis(result);
    } catch (err) {
      setError("Failed to generate analysis. Ensure the API is running.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!analysis && !isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4 max-w-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800 border border-zinc-700">
            <Sparkles className="h-8 w-8 text-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">AI Performance Analysis</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Claude will analyze token usage, costs, latency, errors, and
              suggest optimizations for this workflow run.
            </p>
          </div>
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
          <Button
            onClick={runAnalysis}
            disabled={runStatus === "running"}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {runStatus === "running" ? "Wait for run to complete" : "Analyze Performance"}
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-foreground" />
          <p className="text-sm text-muted-foreground">
            Claude is analyzing your workflow...
          </p>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        {/* Header with Score */}
        <div className="flex items-start gap-6">
          <ScoreRing score={analysis.score} />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Performance Report</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={runAnalysis}
                disabled={isLoading}
              >
                <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isLoading && "animate-spin")} />
                Re-analyze
              </Button>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {analysis.summary}
            </p>
          </div>
        </div>

        <Separator />

        {/* Analysis Sections */}
        <div className="space-y-5">
          <AnalysisSection
            icon={TrendingUp}
            title="Token Usage"
            content={analysis.token_analysis}
          />
          <AnalysisSection
            icon={DollarSign}
            title="Cost Analysis"
            content={analysis.cost_analysis}
            variant="warning"
          />
          <AnalysisSection
            icon={Clock}
            title="Latency & Timing"
            content={analysis.latency_analysis}
          />
          <AnalysisSection
            icon={AlertTriangle}
            title="Error Handling"
            content={analysis.error_analysis}
            variant={analysis.error_analysis.toLowerCase().includes("no error") ? "success" : "warning"}
          />
        </div>

        <Separator />

        {/* Recommendations */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-foreground" />
            <h4 className="text-sm font-semibold">Recommendations</h4>
          </div>
          <div className="space-y-2 pl-6">
            {analysis.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-zinc-400 shrink-0" />
                <p className="text-sm text-muted-foreground">{rec}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Usage footer */}
        {analysis.usage?.input_tokens && (
          <div className="pt-2">
            <p className="text-[10px] text-muted-foreground/50 text-right">
              Analysis used {analysis.usage.input_tokens} input + {analysis.usage.output_tokens} output tokens
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
