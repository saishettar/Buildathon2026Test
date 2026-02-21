"use client";

import React, { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { HeaderStats } from "@/components/layout/header-stats";
import { ExecutionGraph } from "@/components/graph/execution-graph";
import { StepInspector } from "@/components/inspector/step-inspector";
import { RunExplorer } from "@/components/explorer/run-explorer";
import { ChatPanel } from "@/components/chat/chat-panel";
import { AnalysisPanel } from "@/components/analysis/analysis-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useRun } from "@/hooks/use-runs";
import { useSteps } from "@/hooks/use-steps";
import { useRunWebSocket } from "@/hooks/use-websocket";
import type { Step } from "@/types";
import { GitBranch, Table2, Sparkles } from "lucide-react";

export default function RunPage() {
  const params = useParams();
  const runId = params.runId as string;

  const { data: run, isLoading: runLoading } = useRun(runId);
  const { data: steps, isLoading: stepsLoading } = useSteps(runId);

  // WebSocket for real-time updates
  useRunWebSocket(runId);

  // Inspector state
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

      <div className="flex flex-1 flex-col min-w-0">
        {/* Header Stats */}
        <HeaderStats run={run} steps={currentSteps} isLoading={runLoading} />

        {/* Main Content with Tabs */}
        <Tabs defaultValue="trace" className="flex flex-1 flex-col min-h-0">
          <div className="border-b px-4">
            <TabsList className="h-10">
              <TabsTrigger value="trace" className="gap-1.5">
                <GitBranch className="h-3.5 w-3.5" />
                Live Trace
              </TabsTrigger>
              <TabsTrigger value="explorer" className="gap-1.5">
                <Table2 className="h-3.5 w-3.5" />
                Run Explorer
              </TabsTrigger>
              <TabsTrigger value="analysis" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                AI Analysis
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="trace" className="flex-1 m-0 min-h-0">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="space-y-4 text-center">
                  <Skeleton className="mx-auto h-12 w-12 rounded-full" />
                  <Skeleton className="h-4 w-32 mx-auto" />
                  <Skeleton className="h-3 w-48 mx-auto" />
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

          <TabsContent value="explorer" className="flex-1 m-0 min-h-0">
            <RunExplorer
              steps={currentSteps}
              onStepClick={handleStepClick}
              selectedStepId={selectedStep?.step_id}
            />
          </TabsContent>

          <TabsContent value="analysis" className="flex-1 m-0 min-h-0">
            <AnalysisPanel runId={runId} runStatus={run?.status} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Inspector Slide-over */}
      <StepInspector
        step={selectedStep}
        open={inspectorOpen}
        onOpenChange={setInspectorOpen}
      />

      {/* Chat Panel */}
      <ChatPanel runId={runId} />
    </div>
  );
}
