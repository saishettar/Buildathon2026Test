"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { listRuns, getRun, createRun, listScenarios } from "@/lib/api";
import type { CreateRunRequest } from "@/types";

export function useRuns() {
  return useQuery({
    queryKey: ["runs"],
    queryFn: () => listRuns(50),
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
