"use client";

/**
 * AI Optimization Page — Fleet-wide optimization recommendations powered by Claude.
 * Accessible via /optimization from sidebar nav.
 */

import React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { OptimizationDashboard } from "@/components/optimization/OptimizationDashboard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles } from "lucide-react";

export default function OptimizationPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />

      <main className="flex flex-1 flex-col min-w-0 bg-background">
        <ScrollArea className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-6 py-8">
            {/* Page header */}
            <div className="flex items-center gap-3 mb-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  AI Optimization
                </h1>
                <p className="text-sm text-muted-foreground">
                  Claude-powered analysis of your agent fleet with actionable
                  recommendations
                </p>
              </div>
            </div>

            <OptimizationDashboard />
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
