import dagre from "dagre";
import type { Node, Edge } from "reactflow";
import type { Step } from "@/types";

const NODE_WIDTH = 260;
const NODE_HEIGHT = 88;

/**
 * Compute dagre layout for a list of steps.
 * Returns positioned React Flow nodes and edges.
 */
export function computeGraphLayout(
  steps: Step[]
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "TB",
    nodesep: 60,
    ranksep: 90,
    marginx: 40,
    marginy: 40,
  });

  // Add nodes
  for (const step of steps) {
    g.setNode(step.step_id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // Add edges (parent -> child)
  for (const step of steps) {
    if (step.parent_step_id) {
      g.setEdge(step.parent_step_id, step.step_id);
    }
  }

  dagre.layout(g);

  const nodes: Node[] = steps.map((step) => {
    const pos = g.node(step.step_id);
    return {
      id: step.step_id,
      type: "stepNode",
      position: {
        x: (pos?.x ?? 0) - NODE_WIDTH / 2,
        y: (pos?.y ?? 0) - NODE_HEIGHT / 2,
      },
      data: step,
    };
  });

  const edges: Edge[] = steps
    .filter((s) => s.parent_step_id)
    .map((step) => ({
      id: `${step.parent_step_id}-${step.step_id}`,
      source: step.parent_step_id!,
      target: step.step_id,
      animated: step.status === "running",
      style: {
        stroke:
          step.status === "failed"
            ? "#ef4444"
            : step.status === "running"
            ? "#a1a1aa"
            : "#3f3f46",
        strokeWidth: 2,
      },
    }));

  return { nodes, edges };
}

export { NODE_WIDTH, NODE_HEIGHT };
