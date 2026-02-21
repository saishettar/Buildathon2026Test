import type {
  Run,
  Step,
  CreateRunRequest,
  RunsListResponse,
  StepsListResponse,
  ScenariosResponse,
} from "@/types";

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

// ─── Runs ───────────────────────────────────────────────────────────────────

export async function createRun(req: CreateRunRequest): Promise<Run> {
  return fetchJson<Run>(`${API_URL}/api/runs`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function listRuns(limit = 50): Promise<Run[]> {
  const data = await fetchJson<RunsListResponse>(
    `${API_URL}/api/runs?limit=${limit}`
  );
  return data.runs;
}

export async function getRun(runId: string): Promise<Run> {
  return fetchJson<Run>(`${API_URL}/api/runs/${runId}`);
}

// ─── Steps ──────────────────────────────────────────────────────────────────

export async function getRunSteps(runId: string): Promise<Step[]> {
  const data = await fetchJson<StepsListResponse>(
    `${API_URL}/api/runs/${runId}/steps`
  );
  return data.steps;
}

// ─── Scenarios ──────────────────────────────────────────────────────────────

export async function listScenarios(): Promise<ScenariosResponse> {
  return fetchJson<ScenariosResponse>(`${API_URL}/api/scenarios`);
}

// ─── Chat ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatApiResponse {
  reply: string;
  usage: { input_tokens?: number; output_tokens?: number };
}

export async function sendChatMessage(
  messages: ChatMessage[],
  runId?: string
): Promise<ChatApiResponse> {
  return fetchJson<ChatApiResponse>(`${API_URL}/api/chat`, {
    method: "POST",
    body: JSON.stringify({ messages, run_id: runId }),
  });
}
