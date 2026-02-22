"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRunSteps } from "@/lib/api";
import type { Step } from "@/types";
import { useCallback } from "react";

export function useSteps(runId: string | undefined) {
  return useQuery({
    queryKey: ["steps", runId],
    queryFn: () => getRunSteps(runId!),
    enabled: !!runId,
    // Poll as a fallback in case the WebSocket disconnects
    refetchInterval: 3000,
  });
}

/**
 * Utility to upsert a step in the cached steps list.
 * Used by WebSocket handler to merge real-time updates.
 */
export function useUpsertStep() {
  const queryClient = useQueryClient();

  return useCallback(
    (step: Step) => {
      queryClient.setQueryData<Step[]>(
        ["steps", step.run_id],
        (oldSteps) => {
          if (!oldSteps) return [step];
          const idx = oldSteps.findIndex((s) => s.step_id === step.step_id);
          if (idx >= 0) {
            const updated = [...oldSteps];
            updated[idx] = step;
            return updated;
          }
          return [...oldSteps, step];
        }
      );
    },
    [queryClient]
  );
}
