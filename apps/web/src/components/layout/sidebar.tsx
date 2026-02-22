"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ChevronDown,
  Circle,
  Home,
  Play,
  Loader2,
  Sparkles,
  Zap,
  Search,
  Plug,
  AlertTriangle,
  Database,
  Layers,
  FileText,
  Code,
  Hotel,
  BookOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { TenorLogo } from "@/components/brand/tenor-logo";
import { useRuns, useScenarios, useCreateRun } from "@/hooks/use-runs";
import { startRealRun } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { cn, shortId, formatTimestamp } from "@/lib/utils";
import type { Run, RunStatus } from "@/types";

const STATUS_DOT: Record<RunStatus, string> = {
  running: "text-zinc-300 animate-pulse",
  completed: "text-zinc-400",
  failed: "text-red-400",
};

const SCENARIO_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  hotel: Hotel,
  code: Code,
  research: BookOpen,
  search: Search,
  plug: Plug,
  alert: AlertTriangle,
  database: Database,
  layers: Layers,
  "file-text": FileText,
};

interface SidebarProps {
  selectedRunId?: string;
}

export function Sidebar({ selectedRunId }: SidebarProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: runs, isLoading: runsLoading } = useRuns();
  const { data: scenariosData } = useScenarios();
  const createRun = useCreateRun();
  const [launchingReal, setLaunchingReal] = useState<string | null>(null);

  const scenarios = scenariosData?.scenarios ?? [];
  const mockScenarios = scenarios.filter((s) => !s.real);
  const realScenarios = scenarios.filter((s) => s.real);

  const handleStartDemo = async (scenarioId: string) => {
    try {
      const run = await createRun.mutateAsync({
        system_type: "mock",
        scenario: scenarioId,
      });
      router.push(`/runs/${run.run_id}`);
    } catch (e) {
      console.error("Failed to create run:", e);
    }
  };

  const handleStartReal = async (scenarioId: string) => {
    setLaunchingReal(scenarioId);
    try {
      const newRun = await startRealRun(scenarioId);
      // Immediately add the new run to the cache so it appears in the sidebar
      // before the next poll. This prevents the brief gap where a run could vanish.
      queryClient.setQueryData<Run[]>(["runs"], (old) => {
        if (!old) return [newRun];
        return [newRun, ...old];
      });
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      router.push(`/runs/${newRun.run_id}`);
    } catch (e) {
      console.error("Failed to start real run:", e);
    } finally {
      setLaunchingReal(null);
    }
  };

  return (
    <div className="flex h-full w-72 flex-col border-r bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <TenorLogo size="sm" />
        <ThemeToggle />
      </div>

      <Separator />

      {/* Home Button */}
      <div className="px-3 py-2">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Home className="h-4 w-4 text-foreground" />
          Home
        </button>
      </div>

      <Separator />

      {/* Start Demo Button */}
      <div className="px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="w-full justify-between"
              variant="outline"
              disabled={createRun.isPending}
            >
              {createRun.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <span className="flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    Start Demo Run
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64" align="start">
            <DropdownMenuLabel>Choose a scenario</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {mockScenarios.map((s) => (
              <DropdownMenuItem
                key={s.id}
                onClick={() => handleStartDemo(s.id)}
                className="cursor-pointer"
              >
                <span className="truncate text-sm">{s.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator />

      {/* AI Optimization link */}
      <div className="px-3 py-2">
        <button
          onClick={() => router.push("/optimization")}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Sparkles className="h-4 w-4 text-foreground" />
          AI Optimization
        </button>
      </div>

      <Separator />

      {/* Live Agent Runs */}
      <div className="px-4 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Live Agent Runs
        </h2>
      </div>

      <div className="space-y-1 px-3 pb-2">
        {realScenarios.map((s) => {
          const IconComp = SCENARIO_ICONS[(s as any).icon] ?? Zap;
          return (
          <button
            key={s.id}
            onClick={() => handleStartReal(s.id)}
            disabled={launchingReal !== null}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              launchingReal === s.id && "opacity-60"
            )}
          >
            {launchingReal === s.id ? (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            ) : (
              <IconComp className="h-4 w-4 text-zinc-400" />
            )}
            <span className="flex-1 truncate text-left">{s.label}</span>
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 border-zinc-500/40 text-zinc-400"
            >
              LIVE
            </Badge>
          </button>
          );
        })}
      </div>

      <Separator />

      {/* Recent Runs */}
      <div className="px-4 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Runs
        </h2>
      </div>

      <ScrollArea className="flex-1 px-2">
        {runsLoading ? (
          <div className="space-y-2 px-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : !runs || runs.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Activity className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">No runs yet</p>
            <p className="text-xs text-muted-foreground/60">
              Start a demo run above
            </p>
          </div>
        ) : (
          <div className="space-y-1 pb-4">
            {runs.map((run: Run) => (
              <button
                key={run.run_id}
                onClick={() => router.push(`/runs/${run.run_id}`)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent",
                  selectedRunId === run.run_id && "bg-accent"
                )}
              >
                <Circle
                  className={cn("mt-0.5 h-3 w-3 fill-current", STATUS_DOT[run.status])}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {shortId(run.run_id)}
                    </span>
                    <Badge
                      variant={run.status as "running" | "completed" | "failed"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {run.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {run.system_type}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {formatTimestamp(run.created_at)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
