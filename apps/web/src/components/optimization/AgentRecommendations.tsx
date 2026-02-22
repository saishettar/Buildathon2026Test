"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AgentRecommendation } from "@/types/optimization";
import {
  DollarSign,
  Shield,
  Zap,
  GitMerge,
  ArrowUpRight,
} from "lucide-react";

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-500/15 text-red-400 border-red-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-green-500/15 text-green-400 border-green-500/30",
};

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  cost: <DollarSign className="h-4 w-4" />,
  reliability: <Shield className="h-4 w-4" />,
  speed: <Zap className="h-4 w-4" />,
  consolidation: <GitMerge className="h-4 w-4" />,
};

const CATEGORY_STYLES: Record<string, string> = {
  cost: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  reliability: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  speed: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  consolidation: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

interface AgentRecommendationsProps {
  recommendations: AgentRecommendation[];
}

export function AgentRecommendations({ recommendations }: AgentRecommendationsProps) {
  const sorted = [...recommendations].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
  });

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No agent recommendations at this time.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {sorted.map((rec, idx) => (
        <Card
          key={idx}
          className="relative overflow-hidden border-border/50 bg-card p-5 transition-colors hover:border-border"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <code className="text-sm font-semibold text-foreground truncate">
                {rec.scenario}
              </code>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 uppercase tracking-wider ${PRIORITY_STYLES[rec.priority] || ""}`}
              >
                {rec.priority}
              </Badge>
            </div>
          </div>

          {/* Category + title */}
          <div className="flex items-center gap-2 mb-2">
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0.5 flex items-center gap-1 ${CATEGORY_STYLES[rec.category] || ""}`}
            >
              {CATEGORY_ICON[rec.category]}
              {rec.category}
            </Badge>
          </div>
          <h4 className="text-sm font-medium text-foreground mb-2">
            {rec.title}
          </h4>

          {/* Suggestion */}
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            {rec.suggestion}
          </p>

          {/* Impact */}
          <div className="flex items-start gap-1.5 rounded-md bg-muted/50 p-2">
            <ArrowUpRight className="h-3.5 w-3.5 text-green-400 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-muted-foreground">
              {rec.estimated_impact}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
