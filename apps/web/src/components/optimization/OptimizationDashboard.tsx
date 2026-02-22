"use client";

import React from "react";
import { ScoreGauge } from "./ScoreGauge";
import { AgentRecommendations } from "./AgentRecommendations";
import { AutomationSuggestions } from "./AutomationSuggestions";
import { ModelRecommendations } from "./ModelRecommendations";
import { AgentsToWatch } from "./AgentsToWatch";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  useOptimization,
  useRefreshOptimization,
} from "@/hooks/use-optimization";
import {
  RefreshCw,
  Sparkles,
  AlertCircle,
  Loader2,
  Brain,
  Bot,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";

function LoadingSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="relative">
        <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
        <Sparkles className="h-5 w-5 text-purple-300 absolute -top-1 -right-1 animate-pulse" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-foreground">
          Analyzing your agents…
        </h3>
        <p className="text-sm text-muted-foreground max-w-md">
          The AI is reviewing 1,000 runs and 7,388 steps to find optimization
          opportunities. This usually takes 5–10 seconds.
        </p>
      </div>
      <div className="w-full max-w-2xl space-y-4 mt-8">
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15">
        <AlertCircle className="h-7 w-7 text-red-400" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-foreground">
          Unable to load optimization data
        </h3>
        <p className="text-sm text-muted-foreground max-w-md">{message}</p>
      </div>
    </div>
  );
}

function NoKeyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15">
        <AlertCircle className="h-7 w-7 text-amber-400" />
      </div>
      <div className="text-center space-y-2 max-w-lg">
        <h3 className="text-lg font-semibold text-foreground">
          API Key Not Configured
        </h3>
        <p className="text-sm text-muted-foreground">
          Set the <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">ANTHROPIC_API_KEY</code> environment
          variable on the API server to enable AI-powered optimization analysis.
        </p>
      </div>
    </div>
  );
}

export function OptimizationDashboard() {
  const { data, isLoading, isError, error } = useOptimization();
  const refresh = useRefreshOptimization();

  if (isLoading) return <LoadingSkeleton />;
  if (isError) return <ErrorState message={error?.message || "Unknown error"} />;
  if (!data) return <ErrorState message="No data received" />;

  // Detect "no API key" state
  if (data.overall_score === 0 && data.summary.includes("ANTHROPIC_API_KEY")) {
    return <NoKeyState />;
  }

  return (
    <div className="space-y-8">
      {/* ── Overall Score ──────────────────────────────────────────────── */}
      <section className="flex flex-col md:flex-row items-center gap-8 rounded-xl border border-border/50 bg-card p-6">
        <ScoreGauge score={data.overall_score} />
        <div className="flex-1 min-w-0 text-center md:text-left">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Fleet Health Score
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {data.summary}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => refresh()}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Re-analyze
          </Button>
        </div>
      </section>

      {/* ── Agent Recommendations ─────────────────────────────────────── */}
      {data.agent_recommendations.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-foreground">
              Agent Recommendations
            </h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {data.agent_recommendations.length}
            </span>
          </div>
          <AgentRecommendations recommendations={data.agent_recommendations} />
        </section>
      )}

      <Separator className="opacity-50" />

      {/* ── Automation Suggestions ────────────────────────────────────── */}
      {data.automation_suggestions.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Bot className="h-5 w-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-foreground">
              Automation Suggestions
            </h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {data.automation_suggestions.length}
            </span>
          </div>
          <AutomationSuggestions suggestions={data.automation_suggestions} />
        </section>
      )}

      <Separator className="opacity-50" />

      {/* ── Model Recommendations ─────────────────────────────────────── */}
      {data.model_recommendations.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-foreground">
              Model Recommendations
            </h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {data.model_recommendations.length}
            </span>
          </div>
          <ModelRecommendations recommendations={data.model_recommendations} />
        </section>
      )}

      <Separator className="opacity-50" />

      {/* ── Agents to Watch ───────────────────────────────────────────── */}
      {data.agents_to_watch.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-foreground">
              Agents to Watch
            </h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {data.agents_to_watch.length}
            </span>
          </div>
          <AgentsToWatch agents={data.agents_to_watch} />
        </section>
      )}
    </div>
  );
}
