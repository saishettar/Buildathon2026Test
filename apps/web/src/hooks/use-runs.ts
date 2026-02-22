"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { listRuns, getRun, createRun, listScenarios } from "@/lib/api";
import type { CreateRunRequest, Run } from "@/types";

export function useRuns() {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["runs"],
    queryFn: async () => {
      const freshRuns = await listRuns(50);

      // Merge with cached runs so items never vanish when the
      // in-memory backend restarts (e.g. uvicorn reload).
      const cached = queryClient.getQueryData<Run[]>(["runs"]);
      if (!cached || cached.length === 0) return freshRuns;

      const freshIds = new Set(freshRuns.map((r) => r.run_id));
      const missing = cached.filter((r) => !freshIds.has(r.run_id));
      if (missing.length === 0) return freshRuns;

      // Preserve previously-seen runs absent from the fresh response
      return [...freshRuns, ...missing]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        )
        .slice(0, 50);
    },
    refetchInterval: 3000,
    // Keep showing previous data while refetching to avoid flicker
    placeholderData: keepPreviousData,
  });
}

export function useRun(runId: string | undefined) {
  return useQuery({
    queryKey: ["run", runId],
    queryFn: () => getRun(runId!),
    enabled: !!runId,
    refetchInterval: 3000,
  });
}

export function useScenarios() {
  return useQuery({
    queryKey: ["scenarios"],
    queryFn: listScenarios,
  });
}

export function useCreateRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (req: CreateRunRequest) => createRun(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runs"] });
    },
  });
}
