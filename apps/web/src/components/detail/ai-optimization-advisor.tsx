"use client";

/**
 * AIOptimizationAdvisor — AI-powered optimization panel for the agent detail view.
 * Shows: Performance score with recommendations, actionable suggestions,
 * recommended agents panel, and automation suggestions.
 *
 * NOTE: Currently uses mock/placeholder data for suggestions. The UI structure
 * is ready to be wired to actual AI analysis logic later.
 * The existing AnalysisPanel component is NOT modified or removed.
 */

import React, { useMemo } from "react";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Zap,
  Shield,
  Clock,
  DollarSign,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Bot,
  RotateCcw,
  Calendar,
  Layers,
  GitBranch,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatDuration, formatCost, formatTokens } from "@/lib/utils";
import type { Run, Step } from "@/types";

interface AIOptimizationAdvisorProps {
  run: Run;
  steps: Step[];
}

interface Suggestion {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  category: "cost" | "latency" | "reliability" | "efficiency";
}

interface RecommendedAgent {
  name: string;
  reason: string;
  successRate: number;
  avgCost: string;
}

interface AutomationSuggestion {
  icon: React.ElementType;
  title: string;
  description: string;
  effort: "low" | "medium" | "high";
}

export function AIOptimizationAdvisor({ run, steps }: AIOptimizationAdvisorProps) {
  // Derive context-aware mock suggestions from actual step data
  const { suggestions, recommendedAgents, automations, score } = useMemo(() => {
    const totalTokens = steps.reduce(
      (a, s) => a + (s.tokens_prompt || 0) + (s.tokens_completion || 0),
      0
    );
    const totalCost = steps.reduce((a, s) => a + (s.cost_usd || 0), 0);
    const failedSteps = steps.filter((s) => s.status === "failed");
    const llmSteps = steps.filter((s) => s.type === "llm");
    const toolSteps = steps.filter((s) => s.type === "tool");
    const avgDuration = steps.length > 0
      ? steps.reduce((a, s) => a + (s.duration_ms || 0), 0) / steps.length
      : 0;
    const completedRatio = steps.length > 0
      ? steps.filter((s) => s.status === "completed").length / steps.length
      : 0;

    // Generate contextual suggestions
    const sug: Suggestion[] = [];

    if (llmSteps.length > 0 && totalTokens > 5000) {
      sug.push({
        id: "model-switch",
        icon: TrendingDown,
        title: "Consider a lighter model",
        description: `This run used ${formatTokens(totalTokens)} tokens across ${llmSteps.length} LLM calls. Switching to a smaller model for simple steps could reduce costs by ~30%.`,
        impact: "high",
        category: "cost",
      });
    }

    if (failedSteps.length > 0) {
      sug.push({
        id: "retry-logic",
        icon: Shield,
        title: "Add retry logic for failing steps",
        description: `${failedSteps.length} step(s) failed in this run. Adding automatic retry with exponential backoff could improve reliability by ~${Math.min(failedSteps.length * 15, 45)}%.`,
        impact: "high",
        category: "reliability",
      });
    }

    if (avgDuration > 2000) {
      sug.push({
        id: "parallel-exec",
        icon: Zap,
        title: "Parallelize independent steps",
        description: `Average step latency is ${formatDuration(Math.round(avgDuration))}. Independent tool calls could run in parallel, reducing total execution time by up to 40%.`,
        impact: "medium",
        category: "latency",
      });
    }

    if (toolSteps.length > 3) {
      sug.push({
        id: "batch-tools",
        icon: Layers,
        title: "Batch tool calls",
        description: `${toolSteps.length} separate tool calls were made. Consider batching related API calls to reduce overhead and improve throughput.`,
        impact: "medium",
        category: "efficiency",
      });
    }

    if (totalCost > 0.01) {
      sug.push({
        id: "caching",
        icon: DollarSign,
        title: "Enable response caching",
        description: `Total cost was ${formatCost(totalCost)}. Caching repeated LLM queries for identical inputs could save 20-50% on token costs.`,
        impact: "medium",
        category: "cost",
      });
    }

    // Always add a general suggestion
    sug.push({
      id: "monitoring",
      icon: TrendingUp,
      title: "Set up alerting thresholds",
      description: "Configure alerts for when error rates exceed 5% or latency exceeds P95 baseline. Early detection prevents cascading failures.",
      impact: "low",
      category: "reliability",
    });

    // Recommended agents (mock - placeholder for future AI logic)
    const agents: RecommendedAgent[] = [
      {
        name: "Flight Booking Agent",
        reason: "High success rate on travel workflows",
        successRate: 94,
        avgCost: "$0.023",
      },
      {
        name: "Research Summarizer",
        reason: "Best token efficiency for analysis tasks",
        successRate: 89,
        avgCost: "$0.015",
      },
      {
        name: "Code Assistant",
        reason: "Fastest avg latency for tool-heavy tasks",
        successRate: 91,
        avgCost: "$0.019",
      },
    ];

    // Automation suggestions (mock - placeholder for future AI logic)
    const autos: AutomationSuggestion[] = [
      {
        icon: RotateCcw,
        title: "Auto-retry failed payment steps",
        description: "Automatically retry failed payment/transaction steps with exponential backoff (max 3 retries).",
        effort: "low",
      },
      {
        icon: Calendar,
        title: "Schedule batch runs during off-peak hours",
        description: "Queue non-urgent agent runs for off-peak execution windows (2AM-6AM UTC) to reduce costs.",
        effort: "medium",
      },
      {
        icon: GitBranch,
        title: "Add fallback model for high-latency scenarios",
        description: "When primary model latency exceeds P95 threshold, automatically route to a faster fallback model.",
        effort: "high",
      },
    ];

    // Compute optimization score
    const perfScore = Math.min(100, Math.round(completedRatio * 60 + (sug.length < 3 ? 30 : 15) + (failedSteps.length === 0 ? 10 : 0)));

    return {
      suggestions: sug,
      recommendedAgents: agents,
      automations: autos,
      score: perfScore,
    };
  }, [steps]);

  const impactColors = {
    high: "text-red-400 bg-red-500/10 border-red-500/20",
    medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    low: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  };

  const effortColors = {
    low: "text-emerald-400",
    medium: "text-amber-400",
    high: "text-red-400",
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/20">
            <Sparkles className="h-6 w-6 text-violet-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">AI Optimization Advisor</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Intelligent suggestions to improve performance, reduce costs, and increase reliability.
            </p>
          </div>
        </div>

        <Separator />

        {/* ── Actionable Suggestions ──────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-400" />
            <h4 className="text-sm font-semibold text-foreground/80">Optimization Suggestions</h4>
            <Badge variant="outline" className="text-[10px] ml-auto">
              {suggestions.length} suggestions
            </Badge>
          </div>

          <div className="space-y-2">
            {suggestions.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "rounded-lg border border-border bg-background p-4",
                    "hover:border-muted-foreground/30 transition-colors"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card">
                      <Icon className="h-4 w-4 text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h5 className="text-sm font-medium text-foreground">{s.title}</h5>
                        <Badge
                          className={cn("text-[9px] px-1.5 py-0 border", impactColors[s.impact])}
                        >
                          {s.impact} impact
                        </Badge>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                          {s.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {s.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* ── Recommended Agents ────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-cyan-400" />
            <h4 className="text-sm font-semibold text-foreground/80">Recommended Agents</h4>
            {/* NOTE: Placeholder data — will be wired to actual AI recommendations later */}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {recommendedAgents.map((agent, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg border border-border bg-background p-4 space-y-2",
                  "hover:border-cyan-500/30 transition-colors cursor-pointer"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10">
                    <Bot className="h-3.5 w-3.5 text-cyan-400" />
                  </div>
                  <h5 className="text-xs font-semibold text-foreground">{agent.name}</h5>
                </div>
                <p className="text-[11px] text-muted-foreground">{agent.reason}</p>
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    <span className="text-[10px] text-emerald-400 font-medium">{agent.successRate}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-amber-400" />
                    <span className="text-[10px] text-amber-400 font-medium">{agent.avgCost}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* ── Automation Suggestions ──────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-violet-400" />
            <h4 className="text-sm font-semibold text-foreground/80">Automation Suggestions</h4>
            {/* NOTE: Placeholder data — will be wired to actual AI automation logic later */}
          </div>

          <div className="space-y-2">
            {automations.map((auto, i) => {
              const Icon = auto.icon;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border border-border bg-background p-4",
                    "hover:border-muted-foreground/30 transition-colors"
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                    <Icon className="h-4 w-4 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h5 className="text-sm font-medium text-foreground">{auto.title}</h5>
                      <span className={cn("text-[10px] font-medium", effortColors[auto.effort])}>
                        {auto.effort} effort
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {auto.description}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-1" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer disclaimer */}
        <div className="pt-2 pb-4">
          <p className="text-[10px] text-muted-foreground/60 text-center italic">
            Suggestions are generated based on run analysis. Connect AI analysis for personalized recommendations.
          </p>
        </div>
      </div>
    </ScrollArea>
  );
}
