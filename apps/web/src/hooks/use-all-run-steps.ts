"use client";

/**
 * useAllRunSteps — Fetches steps for all runs in parallel for the dashboard view.
 * Returns a map of run_id → Step[] so dashboard cards can show per-agent stats.
 *
 * NOTE: This is a NEW hook that does NOT modify or replace existing hooks.
 * It reuses the existing getRunSteps API function from lib/api.ts.
 */

import { useQueries } from "@tanstack/react-query";
import { getRunSteps } from "@/lib/api";
import type { Run, Step } from "@/types";

export function useAllRunSteps(runs: Run[] | undefined) {
  const queries = useQueries({
    queries: (runs ?? []).map((run) => ({
      queryKey: ["steps", run.run_id],
      queryFn: () => getRunSteps(run.run_id),
      // Only refetch running runs frequently; completed/failed runs are stable
      refetchInterval: run.status === "running" ? 3000 : false,
      staleTime: run.status === "running" ? 2000 : 30000,
    })),
  });

  // Build a map of run_id → steps
  const stepsMap: Record<string, Step[]> = {};
  (runs ?? []).forEach((run, i) => {
    stepsMap[run.run_id] = queries[i]?.data ?? [];
  });

  const isLoading = queries.some((q) => q.isLoading);

  return { stepsMap, isLoading };
}
