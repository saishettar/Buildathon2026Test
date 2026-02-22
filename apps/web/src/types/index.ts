// ─── Universal Contract Types ───────────────────────────────────────────────
// Matches the backend models exactly.

export type RunStatus = "running" | "completed" | "failed";
export type SystemType = "mock" | "openclaw" | "claude" | "openai" | "perplexity" | "other";
export type StepType = "llm" | "tool" | "plan" | "final" | "error";
export type StepStatus = "running" | "completed" | "failed" | "retrying";

export interface RunMetadata {
  user_id: string;
  tags: string[];
}

export interface StepError {
  message: string;
  stack: string | null;
  code: string | null;
}

export interface Run {
  run_id: string;
  created_at: string;
  updated_at: string;
  status: RunStatus;
  system_type: SystemType;
  root_step_id: string | null;
  metadata: RunMetadata;
}

export interface Step {
  step_id: string;
  run_id: string;
  parent_step_id: string | null;
  name: string;
  type: StepType;
  status: StepStatus;
  started_at: string;
  ended_at: string | null;
  duration_ms: number;
  tokens_prompt: number;
  tokens_completion: number;
  cost_usd: number;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error: StepError | null;
}

export interface Scenario {
  id: string;
  label: string;
  real?: boolean;
  description?: string;
  icon?: string;
}

// ─── WebSocket message types ────────────────────────────────────────────────

export type WsMessage =
  | { type: "step_update"; step: Step }
  | { type: "run_update"; run: Run };

// ─── API request / response ─────────────────────────────────────────────────

export interface CreateRunRequest {
  system_type?: SystemType;
  scenario?: string;
  metadata?: Partial<RunMetadata>;
}

export interface RunsListResponse {
  runs: Run[];
}

export interface StepsListResponse {
  steps: Step[];
}

export interface ScenariosResponse {
  scenarios: Scenario[];
}

// ─── Node coloring map ──────────────────────────────────────────────────────

export const STEP_TYPE_COLORS: Record<StepType, string> = {
  llm: "#3b82f6",       // Blue
  tool: "#8b5cf6",      // Purple
  error: "#ef4444",     // Red
  final: "#22c55e",     // Green
  plan: "#f59e0b",      // Amber
};

export const STEP_STATUS_COLORS: Record<StepStatus, string> = {
  running: "#3b82f6",
  completed: "#22c55e",
  failed: "#ef4444",
  retrying: "#f97316",
};
