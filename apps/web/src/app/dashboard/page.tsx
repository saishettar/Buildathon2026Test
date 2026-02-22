"use client";

/**
 * Dashboard Page — Main agent observability dashboard.
 * Shows: Hero chart, Summary KPI stats, Agent cards grid.
 * Accessible via /dashboard after landing page CTA.
 */

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { ChatPanel } from "@/components/chat/chat-panel";
import { HeroChart } from "@/components/dashboard/hero-chart";
import { SummaryStats } from "@/components/dashboard/summary-stats";
import { AgentCard } from "@/components/dashboard/agent-card";
import { useRuns } from "@/hooks/use-runs";
import { useAllRunSteps } from "@/hooks/use-all-run-steps";
import { Activity, ArrowRight, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const router = useRouter();
  const { data: runs, isLoading: runsLoading } = useRuns();
  const { stepsMap, isLoading: stepsLoading } = useAllRunSteps(runs);
  const hasAutoRedirected = useRef(false);

  // Auto-select the first running run (only once)
  useEffect(() => {
    if (!hasAutoRedirected.current && runs && runs.length > 0) {
      const running = runs.find((r) => r.status === "running");
      if (running) {
        hasAutoRedirected.current = true;
        router.push(`/runs/${running.run_id}`);
      }
    }
  }, [runs, router]);

  const hasRuns = runs && runs.length > 0;
  const isLoading = runsLoading || stepsLoading;

  return (
    <div className="flex h-screen">
      <Sidebar />

      <main className="flex flex-1 flex-col min-w-0 bg-background">
        {!hasRuns && !runsLoading ? (
          /* ── Empty State ─────────────────────────────────────────── */
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center max-w-md">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-foreground/10 mb-6">
                <Activity className="h-10 w-10 text-foreground" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Welcome to Tenor
              </h2>
              <p className="mt-2 text-muted-foreground">
                AI Agent Observability Platform
              </p>
              <p className="mt-4 text-sm text-muted-foreground/70">
                Start a demo run from the sidebar to see real-time agent execution
                traces, or select an existing run to inspect.
              </p>
              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <ArrowRight className="h-4 w-4" />
                <span>Click &quot;Start Demo Run&quot; in the sidebar</span>
              </div>
            </div>
          </div>
        ) : (
          /* ── Dashboard Content ──────────────────────────────────── */
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
              {/* Dashboard Title */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-foreground" />
                    Agent Dashboard
                  </h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Real-time overview of all AI agent runs and performance
                  </p>
                </div>
                {runs && (
                  <span className="text-xs text-muted-foreground/60">
                    {runs.length} total runs
                  </span>
                )}
              </div>

              {/* Hero Chart */}
              {isLoading ? (
                <Skeleton className="h-[280px] w-full rounded-xl bg-card" />
              ) : runs ? (
                <HeroChart runs={runs} stepsMap={stepsMap} />
              ) : null}

              {/* Summary Stats */}
              {isLoading ? (
                <div className="grid grid-cols-5 gap-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-lg bg-card" />
                  ))}
                </div>
              ) : runs ? (
                <SummaryStats runs={runs} stepsMap={stepsMap} />
              ) : null}

              {/* Agent Cards Grid */}
              <div>
                <h2 className="text-sm font-semibold text-foreground/80 mb-3">Agent Runs</h2>
                {isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-52 rounded-xl bg-card" />
                    ))}
                  </div>
                ) : runs ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {runs.map((run) => (
                      <AgentCard
                        key={run.run_id}
                        run={run}
                        steps={stepsMap[run.run_id] || []}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </ScrollArea>
        )}
      </main>

      <ChatPanel />
    </div>
  );
}
