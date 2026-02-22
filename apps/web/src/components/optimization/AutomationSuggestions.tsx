"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AutomationSuggestion } from "@/types/optimization";
import { Bot, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

const EFFORT_STYLES: Record<string, string> = {
  low: "bg-green-500/15 text-green-400 border-green-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  high: "bg-red-500/15 text-red-400 border-red-500/30",
};

const IMPACT_ICON: Record<string, React.ReactNode> = {
  high: <ArrowUpRight className="h-3 w-3" />,
  medium: <Minus className="h-3 w-3" />,
  low: <ArrowDownRight className="h-3 w-3" />,
};

const IMPACT_STYLES: Record<string, string> = {
  high: "bg-green-500/15 text-green-400 border-green-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

interface AutomationSuggestionsProps {
  suggestions: AutomationSuggestion[];
}

export function AutomationSuggestions({ suggestions }: AutomationSuggestionsProps) {
  if (suggestions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No automation suggestions at this time.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {suggestions.map((item, idx) => (
        <Card
          key={idx}
          className="border-border/50 bg-card p-5 transition-colors hover:border-border"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/15 text-purple-400 flex-shrink-0">
              <Bot className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              {/* Title + badges */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h4 className="text-sm font-medium text-foreground">
                  {item.title}
                </h4>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${EFFORT_STYLES[item.effort] || ""}`}
                >
                  {item.effort} effort
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 flex items-center gap-0.5 ${IMPACT_STYLES[item.impact] || ""}`}
                >
                  {IMPACT_ICON[item.impact]}
                  {item.impact} impact
                </Badge>
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                {item.description}
              </p>

              {/* Affected scenarios */}
              <div className="flex flex-wrap gap-1.5">
                {item.affected_scenarios.map((sc) => (
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
