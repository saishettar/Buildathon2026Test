"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOptimization } from "@/lib/optimization-api";

export function useOptimization() {
  return useQuery({
    queryKey: ["optimization"],
    queryFn: getOptimization,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

export function useRefreshOptimization() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: ["optimization"] });
}
