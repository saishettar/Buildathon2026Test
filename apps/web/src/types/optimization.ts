// ─── AI Optimization Types ──────────────────────────────────────────────────

export interface AgentRecommendation {
  scenario: string;
  priority: "high" | "medium" | "low";
  category: "cost" | "reliability" | "speed" | "consolidation";
  title: string;
  suggestion: string;
  estimated_impact: string;
  addresses_dimension?: "reliability" | "cost_efficiency" | "performance" | "error_health" | "model_optimization";
}

export interface AutomationSuggestion {
  title: string;
  description: string;
  affected_scenarios: string[];
  effort: "low" | "medium" | "high";
  impact: "high" | "medium" | "low";
}

export interface ModelRecommendation {
  current_model: string;
  suggested_model: string;
  affected_scenarios: string[];
  reason: string;
  estimated_savings: string;
}

export interface AgentToWatch {
  scenario: string;
  reason: string;
  metric: string;
}

export interface OptimizationResponse {
  overall_score: number;
  summary: string;
  agent_recommendations: AgentRecommendation[];
  automation_suggestions: AutomationSuggestion[];
  model_recommendations: ModelRecommendation[];
  agents_to_watch: AgentToWatch[];
}
