"use client";

/**
 * Landing Page — Beautiful intro page for Tenor.
 * Users see this first, then click through to the dashboard.
 */

import React from "react";
import { useRouter } from "next/navigation";
import { TenorLogo } from "@/components/brand/tenor-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  ArrowRight,
  GitBranch,
  Zap,
  BarChart3,
  Bot,
  Sparkles,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: GitBranch,
    title: "Live Execution Traces",
    description: "Watch AI agent workflows execute in real-time with interactive DAG visualizations.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  {
    icon: BarChart3,
    title: "Performance Metrics",
    description: "Token usage, cost analysis, latency percentiles, and health scores at a glance.",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    icon: Bot,
    title: "AI-Powered Analysis",
    description: "Claude-powered insights that analyze your agent runs and suggest optimizations.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Eye,
    title: "Step-Level Inspection",
    description: "Drill into every LLM call, tool invocation, prompt, completion, and error detail.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
];

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      {/* Animated background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[400px] -right-[400px] w-[800px] h-[800px] rounded-full bg-cyan-500/[0.03] dark:bg-cyan-500/[0.04] blur-3xl" />
        <div className="absolute -bottom-[300px] -left-[300px] w-[700px] h-[700px] rounded-full bg-violet-500/[0.03] dark:bg-violet-500/[0.04] blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/[0.02] dark:bg-emerald-500/[0.02] blur-3xl" />

        {/* Subtle grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03] dark:opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5">
        <TenorLogo size="md" />
        <ThemeToggle />
      </header>

      {/* Hero */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 pt-12 pb-20">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 backdrop-blur-sm px-4 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-xs font-medium text-muted-foreground">
              AI Agent Observability Platform
            </span>
          </div>

          {/* Logo */}
          <div className="flex justify-center">
            <TenorLogo size="xl" />
          </div>

          {/* Tagline */}
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
            See every step your{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              AI agents
            </span>{" "}
            take
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Real-time execution traces, performance metrics, and AI-powered optimization
            for your agentic workflows — all in one place.
          </p>

          {/* CTA Buttons */}
          <div className="flex items-center justify-center gap-4 pt-2">
            <Button
              size="lg"
              onClick={() => router.push("/dashboard")}
              className="gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-600 hover:to-violet-600 text-white border-0 shadow-lg shadow-cyan-500/20 px-8 h-12 text-base"
            >
              Launch Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-24 max-w-4xl w-full mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group rounded-xl border border-border bg-card/50 backdrop-blur-sm p-6 transition-all duration-300 hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/5"
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${feature.bg}`}>
                      <Icon className={`h-5 w-5 ${feature.color}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground group-hover:text-foreground/90">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom attribution */}
        <div className="mt-20 flex items-center gap-2 text-xs text-muted-foreground/50">
          <Zap className="h-3 w-3" />
          <span>Powered by FastAPI &middot; Next.js &middot; Claude AI</span>
        </div>
      </main>
    </div>
  );
}
