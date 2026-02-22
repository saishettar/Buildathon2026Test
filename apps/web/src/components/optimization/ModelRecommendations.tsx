"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ModelRecommendation } from "@/types/optimization";
import { ArrowRight, TrendingDown } from "lucide-react";

interface ModelRecommendationsProps {
  recommendations: ModelRecommendation[];
}

export function ModelRecommendations({ recommendations }: ModelRecommendationsProps) {
  if (recommendations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No model swap recommendations at this time.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recommendations.map((rec, idx) => (
        <Card
          key={idx}
          className="border-border/50 bg-card p-5 transition-colors hover:border-border"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400 flex-shrink-0">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              {/* Model swap header */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-red-400">
                  {rec.current_model}
                </code>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-green-400">
                  {rec.suggested_model}
                </code>
              </div>

              {/* Reason */}
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                {rec.reason}
              </p>

              {/* Savings + scenarios */}
              <div className="flex items-center gap-3 flex-wrap">
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                >
                  💰 {rec.estimated_savings}
                </Badge>
                {rec.affected_scenarios.map((sc) => (
                  <Badge
                    key={sc}
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 bg-muted/50"
                  >
                    {sc}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
