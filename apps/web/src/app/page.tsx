"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { ChatPanel } from "@/components/chat/chat-panel";
import { useRuns } from "@/hooks/use-runs";
import { Activity, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { data: runs } = useRuns();

  // Auto-select the first running or latest run
  useEffect(() => {
    if (runs && runs.length > 0) {
      const running = runs.find((r) => r.status === "running");
      if (running) {
        router.push(`/runs/${running.run_id}`);
      }
    }
  }, [runs, router]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex flex-1 items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 mb-6">
            <Activity className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome to UAOP
          </h2>
          <p className="mt-2 text-muted-foreground">
            Universal Agent Observability Platform
          </p>
          <p className="mt-4 text-sm text-muted-foreground/80">
            Start a demo run from the sidebar to see real-time agent execution
            traces, or select an existing run to inspect.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <ArrowRight className="h-4 w-4" />
            <span>Click "Start Demo Run" in the sidebar</span>
          </div>
        </div>
      </main>
      <ChatPanel />
    </div>
  );
}
