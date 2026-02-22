"use client";

/**
 * Agent Detail View — Enhanced with new sections:
 * - Section A: Live Trace (existing ExecutionGraph) + new ExecutionChain view
 * - Section B: Performance Metrics panel
 * - Section C: AI Optimization Advisor
 * - Existing: Run Explorer, AI Analysis (AnalysisPanel), StepInspector, ChatPanel
 *
 * NOTE: All existing functionality is FULLY PRESERVED:
 * - useRun/useSteps hooks, useRunWebSocket
 * - ExecutionGraph, RunExplorer, AnalysisPanel, StepInspector, ChatPanel
 * - Tab navigation and inspector slide-over
 * New tabs are ADDED alongside existing ones.
 */

import React, { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { DetailHeader } from "@/components/detail/detail-header";
import { ExecutionGraph } from "@/components/graph/execution-graph";
import { ExecutionChain } from "@/components/detail/execution-chain";
import { StepInspector } from "@/components/inspector/step-inspector";
import { RunExplorer } from "@/components/explorer/run-explorer";
import { ChatPanel } from "@/components/chat/chat-panel";
import { AnalysisPanel } from "@/components/analysis/analysis-panel";
import { PerformanceMetrics } from "@/components/detail/performance-metrics";
import { AIOptimizationAdvisor } from "@/components/detail/ai-optimization-advisor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useRun } from "@/hooks/use-runs";
import { useSteps } from "@/hooks/use-steps";
import { useRunWebSocket } from "@/hooks/use-websocket";
import type { Step } from "@/types";
import {
  GitBranch,
  Table2,
  Sparkles,
  Link2,
  BarChart3,
  Lightbulb,
} from "lucide-react";

export default function RunPage() {
  const params = useParams();
  const runId = params.runId as string;

  // ── Existing data fetching — NOT MODIFIED ──────────────────────────
  const { data: run, isLoading: runLoading } = useRun(runId);
  const { data: steps, isLoading: stepsLoading } = useSteps(runId);

  // WebSocket for real-time updates — NOT MODIFIED
  useRunWebSocket(runId);

  // Inspector state — NOT MODIFIED
  const [selectedStep, setSelectedStep] = useState<Step | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const handleStepClick = useCallback((step: Step) => {
    setSelectedStep(step);
    setInspectorOpen(true);
  }, []);

  const isLoading = runLoading || stepsLoading;
  const currentSteps = steps ?? [];

  return (
    <div className="flex h-screen">
      <Sidebar selectedRunId={runId} />

      <div className="flex flex-1 flex-col min-w-0 bg-background">
        {/* Enhanced Header with back navigation */}
        <DetailHeader run={run} steps={currentSteps} isLoading={runLoading} />

        {/* Main Content with Enhanced Tabs */}
        <Tabs defaultValue="trace" className="flex flex-1 flex-col min-h-0">
          <div className="border-b border-border px-4 bg-card">
            <TabsList className="h-10 bg-transparent">
              <TabsTrigger value="trace" className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">
                <GitBranch className="h-3.5 w-3.5" />
                Live Trace
              </TabsTrigger>
              <TabsTrigger value="chain" className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">
                <Link2 className="h-3.5 w-3.5" />
                Execution Chain
              </TabsTrigger>
              <TabsTrigger value="explorer" className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">
                <Table2 className="h-3.5 w-3.5" />
                Run Explorer
              </TabsTrigger>
              <TabsTrigger value="metrics" className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">
                <BarChart3 className="h-3.5 w-3.5" />
                Metrics
              </TabsTrigger>
              <TabsTrigger value="analysis" className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                AI Analysis
              </TabsTrigger>
              <TabsTrigger value="optimization" className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground">
                <Lightbulb className="h-3.5 w-3.5" />
                AI Optimization
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── Tab: Live Trace (existing ExecutionGraph) ────────────── */}
          <TabsContent value="trace" className="flex-1 m-0 min-h-0">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="space-y-4 text-center">
                  <Skeleton className="mx-auto h-12 w-12 rounded-full bg-card" />
                  <Skeleton className="h-4 w-32 mx-auto bg-card" />
                  <Skeleton className="h-3 w-48 mx-auto bg-card" />
                </div>
              </div>
            ) : (
              <ExecutionGraph
                steps={currentSteps}
                onNodeClick={handleStepClick}
                selectedStepId={selectedStep?.step_id}
              />
            )}
          </TabsContent>

          {/* ── Tab: Execution Chain (NEW — vertical flowchart) ──────── */}
          <TabsContent value="chain" className="flex-1 m-0 min-h-0 overflow-auto">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Skeleton className="h-12 w-12 rounded-full bg-card" />
              </div>
            ) : (
              <ExecutionChain
                steps={currentSteps}
                onStepClick={handleStepClick}
                selectedStepId={selectedStep?.step_id}
              />
            )}
          </TabsContent>

          {/* ── Tab: Run Explorer (existing) ─────────────────────────── */}
          <TabsContent value="explorer" className="flex-1 m-0 min-h-0">
            <RunExplorer
              steps={currentSteps}
              onStepClick={handleStepClick}
              selectedStepId={selectedStep?.step_id}
            />
          </TabsContent>

          {/* ── Tab: Performance Metrics (NEW) ───────────────────────── */}
          <TabsContent value="metrics" className="flex-1 m-0 min-h-0">
            {run ? (
              <PerformanceMetrics run={run} steps={currentSteps} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">Loading run data...</p>
              </div>
            )}
          </TabsContent>

          {/* ── Tab: AI Analysis (existing AnalysisPanel) ────────────── */}
          <TabsContent value="analysis" className="flex-1 m-0 min-h-0">
            <AnalysisPanel runId={runId} runStatus={run?.status} />
          </TabsContent>

          {/* ── Tab: AI Optimization (NEW) ────────────────────────────── */}
          <TabsContent value="optimization" className="flex-1 m-0 min-h-0">
            {run ? (
              <AIOptimizationAdvisor run={run} steps={currentSteps} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">Loading run data...</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Inspector Slide-over — NOT MODIFIED */}
      <StepInspector
        step={selectedStep}
        open={inspectorOpen}
        onOpenChange={setInspectorOpen}
      />

      {/* Chat Panel — NOT MODIFIED */}
      <ChatPanel runId={runId} />
    </div>
  );
}
