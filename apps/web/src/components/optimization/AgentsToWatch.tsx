"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import type { AgentToWatch } from "@/types/optimization";
import { AlertTriangle } from "lucide-react";

interface AgentsToWatchProps {
  agents: AgentToWatch[];
}

export function AgentsToWatch({ agents }: AgentsToWatchProps) {
  if (agents.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        All agents are operating normally.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {agents.map((a, idx) => (
        <Card
          key={idx}
          className="border-amber-500/30 bg-amber-500/5 p-5 transition-colors hover:border-amber-500/50"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 flex-shrink-0">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            <div className="flex-1 min-w-0">
              <code className="text-sm font-semibold text-amber-300">
                {a.scenario}
              </code>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1.5 mb-2">
                {a.reason}
              </p>
              <div className="rounded-md bg-muted/50 px-2.5 py-1.5">
                <span className="text-[11px] font-medium text-amber-400">
                  ⚠ {a.metric}
                </span>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
