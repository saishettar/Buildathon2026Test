import type {
  OptimizationResponse,
} from "@/types/optimization";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function getOptimization(): Promise<OptimizationResponse> {
  return fetchJson<OptimizationResponse>(`${API_URL}/api/optimization`);
}
