"use client";

import React, { useMemo, useCallback, useEffect, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";
import { StepNode } from "./step-node";
import { computeGraphLayout } from "./graph-utils";
import type { Step } from "@/types";
import { Activity } from "lucide-react";

const nodeTypes: NodeTypes = {
  stepNode: StepNode,
};

interface ExecutionGraphProps {
  steps: Step[];
  onNodeClick?: (step: Step) => void;
  selectedStepId?: string;
}

export function ExecutionGraph({
  steps,
  onNodeClick,
  selectedStepId,
}: ExecutionGraphProps) {
  const prevStepCountRef = useRef(0);

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => computeGraphLayout(steps),
    [steps]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  // Update nodes/edges when layout changes
  useEffect(() => {
    setNodes(layoutNodes.map((n) => ({
      ...n,
      selected: n.id === selectedStepId,
    })));
    setEdges(layoutEdges);

    // Auto-fit when new steps arrive
    prevStepCountRef.current = steps.length;
  }, [layoutNodes, layoutEdges, setNodes, setEdges, steps.length, selectedStepId]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const step = steps.find((s) => s.step_id === node.id);
      if (step && onNodeClick) {
        onNodeClick(step);
      }
    },
    [steps, onNodeClick]
  );

  if (steps.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Activity className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-medium text-muted-foreground">
            No steps yet
          </p>
          <p className="text-sm text-muted-foreground/60">
            Steps will appear here as the agent executes
          </p>
        </div>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      className="bg-background"
    >
      <Background color="hsl(var(--muted-foreground))" gap={20} size={1} className="opacity-20" />
      <Controls className="!bg-card !border-border !shadow-md" />
      <MiniMap
        nodeStrokeWidth={3}
        nodeColor={(node) => {
          const step = node.data as Step;
          if (!step) return "#3f3f46";
          const colors: Record<string, string> = {
            llm: "#e4e4e7",
            tool: "#a1a1aa",
            plan: "#71717a",
            final: "#fafafa",
            error: "#ef4444",
          };
          return colors[step.type] || "#3f3f46";
        }}
        className="!bg-card/80"
      />
    </ReactFlow>
  );
}
