<template>
  <div class="dep-graph-root">
    <svg
      ref="svgRef"
      :width="svgWidth"
      :height="svgHeight"
      class="dep-graph-svg"
    >
      <!-- Edges (arrows from blockedBy to task) -->
      <defs>
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" :fill="'var(--theme-text-tertiary)'" />
        </marker>
      </defs>

      <!-- Edge lines -->
      <line
        v-for="(edge, i) in edges"
        :key="`edge-${i}`"
        :x1="edge.x1"
        :y1="edge.y1"
        :x2="edge.x2"
        :y2="edge.y2"
        stroke="var(--theme-text-tertiary)"
        stroke-width="1.5"
        stroke-opacity="0.5"
        marker-end="url(#arrowhead)"
      />

      <!-- Task nodes -->
      <g
        v-for="node in nodes"
        :key="node.taskId"
        :transform="`translate(${node.x}, ${node.y})`"
        class="dep-node"
        @mouseenter="hoveredNode = node.taskId"
        @mouseleave="hoveredNode = null"
      >
        <!-- Node background rect -->
        <rect
          :width="nodeWidth"
          :height="nodeHeight"
          :rx="6"
          :ry="6"
          :fill="nodeFill(node.status)"
          :stroke="nodeStroke(node.status)"
          stroke-width="2"
          :opacity="hoveredNode && hoveredNode !== node.taskId ? 0.5 : 1"
        />

        <!-- Status indicator circle -->
        <circle
          :cx="12"
          :cy="nodeHeight / 2"
          r="4"
          :fill="statusDotColor(node.status)"
        />

        <!-- Task ID -->
        <text
          :x="nodeWidth - 8"
          y="14"
          text-anchor="end"
          class="node-id"
        >#{{ node.taskId }}</text>

        <!-- Subject (truncated) -->
        <text
          x="22"
          :y="nodeHeight / 2 + 1"
          dominant-baseline="middle"
          class="node-subject"
        >{{ truncate(node.subject, 28) }}</text>

        <!-- Owner -->
        <text
          v-if="node.owner"
          x="22"
          :y="nodeHeight - 8"
          class="node-owner"
        >{{ node.owner }}</text>
      </g>
    </svg>

    <!-- Tooltip -->
    <div
      v-if="hoveredNode && tooltipNode"
      class="dep-tooltip"
      :style="{ left: tooltipX + 'px', top: tooltipY + 'px' }"
    >
      <div class="tooltip-title">#{{ tooltipNode.taskId }}: {{ tooltipNode.subject }}</div>
      <div class="tooltip-status" :class="`tooltip-${tooltipNode.status}`">{{ tooltipNode.status }}</div>
      <div v-if="tooltipNode.owner" class="tooltip-owner">Owner: {{ tooltipNode.owner }}</div>
      <div v-if="tooltipNode.blockedBy.length" class="tooltip-deps">Blocked by: {{ tooltipNode.blockedBy.join(', ') }}</div>
      <div v-if="tooltipNode.blocks.length" class="tooltip-deps">Blocks: {{ tooltipNode.blocks.join(', ') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { KanbanTask } from '../types';

const props = defineProps<{
  tasks: KanbanTask[];
}>();

const svgRef = ref<SVGSVGElement | null>(null);
const hoveredNode = ref<string | null>(null);

const nodeWidth = 220;
const nodeHeight = 52;
const horizontalGap = 60;
const verticalGap = 24;

interface LayoutNode {
  taskId: string;
  subject: string;
  status: string;
  owner: string | null;
  blockedBy: string[];
  blocks: string[];
  x: number;
  y: number;
  layer: number;
}

interface Edge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Compute layers using topological sort (Kahn's algorithm)
const layoutData = computed(() => {
  const tasks = props.tasks;
  if (tasks.length === 0) return { nodes: [] as LayoutNode[], edges: [] as Edge[] };

  const taskMap = new Map<string, KanbanTask>();
  for (const t of tasks) taskMap.set(t.taskId, t);

  // Compute in-degree (number of blockedBy tasks that exist in current set)
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>(); // from -> to (blocks relationship)

  for (const t of tasks) {
    inDegree.set(t.taskId, 0);
    adjList.set(t.taskId, []);
  }

  for (const t of tasks) {
    for (const blockedById of t.blockedBy) {
      if (taskMap.has(blockedById)) {
        // blockedById blocks t.taskId => edge from blockedById -> t.taskId
        adjList.get(blockedById)!.push(t.taskId);
        inDegree.set(t.taskId, (inDegree.get(t.taskId) ?? 0) + 1);
      }
    }
  }

  // BFS layer assignment
  const layers = new Map<string, number>();
  const queue: string[] = [];

  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      queue.push(id);
      layers.set(id, 0);
    }
  }

  let maxLayer = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLayer = layers.get(current) ?? 0;
    for (const next of adjList.get(current) ?? []) {
      const nextDeg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, nextDeg);
      const proposedLayer = currentLayer + 1;
      layers.set(next, Math.max(layers.get(next) ?? 0, proposedLayer));
      if (nextDeg === 0) {
        queue.push(next);
      }
      maxLayer = Math.max(maxLayer, proposedLayer);
    }
  }

  // Handle cyclic tasks (assign to last layer + 1)
  for (const t of tasks) {
    if (!layers.has(t.taskId)) {
      layers.set(t.taskId, maxLayer + 1);
    }
  }

  // Group by layer
  const layerGroups = new Map<number, KanbanTask[]>();
  for (const t of tasks) {
    const layer = layers.get(t.taskId) ?? 0;
    if (!layerGroups.has(layer)) layerGroups.set(layer, []);
    layerGroups.get(layer)!.push(t);
  }

  // Layout: each layer is a column, tasks in a layer are stacked vertically
  const nodes: LayoutNode[] = [];
  const nodePositions = new Map<string, { x: number; y: number }>();

  const sortedLayers = [...layerGroups.entries()].sort((a, b) => a[0] - b[0]);

  for (const [layer, layerTasks] of sortedLayers) {
    const x = 20 + layer * (nodeWidth + horizontalGap);
    for (let i = 0; i < layerTasks.length; i++) {
      const t = layerTasks[i];
      const y = 20 + i * (nodeHeight + verticalGap);
      nodes.push({
        taskId: t.taskId,
        subject: t.subject,
        status: t.status,
        owner: t.owner,
        blockedBy: t.blockedBy,
        blocks: t.blocks,
        x,
        y,
        layer,
      });
      nodePositions.set(t.taskId, { x, y });
    }
  }

  // Build edges
  const edges: Edge[] = [];
  for (const t of tasks) {
    const toPos = nodePositions.get(t.taskId);
    if (!toPos) continue;
    for (const blockedById of t.blockedBy) {
      const fromPos = nodePositions.get(blockedById);
      if (!fromPos) continue;
      edges.push({
        x1: fromPos.x + nodeWidth,
        y1: fromPos.y + nodeHeight / 2,
        x2: toPos.x,
        y2: toPos.y + nodeHeight / 2,
      });
    }
  }

  return { nodes, edges };
});

const nodes = computed(() => layoutData.value.nodes);
const edges = computed(() => layoutData.value.edges);

const svgWidth = computed(() => {
  if (nodes.value.length === 0) return 400;
  const maxX = Math.max(...nodes.value.map(n => n.x + nodeWidth));
  return maxX + 40;
});

const svgHeight = computed(() => {
  if (nodes.value.length === 0) return 200;
  const maxY = Math.max(...nodes.value.map(n => n.y + nodeHeight));
  return maxY + 40;
});

const tooltipNode = computed(() => {
  if (!hoveredNode.value) return null;
  return nodes.value.find(n => n.taskId === hoveredNode.value) ?? null;
});

const tooltipX = computed(() => (tooltipNode.value?.x ?? 0) + nodeWidth + 8);
const tooltipY = computed(() => (tooltipNode.value?.y ?? 0));

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '\u2026';
}

function nodeFill(status: string): string {
  switch (status) {
    case 'completed': return 'color-mix(in srgb, var(--theme-accent-success) 12%, var(--theme-bg-primary))';
    case 'in_progress': return 'color-mix(in srgb, var(--theme-primary) 12%, var(--theme-bg-primary))';
    default: return 'var(--theme-bg-primary)';
  }
}

function nodeStroke(status: string): string {
  switch (status) {
    case 'completed': return 'var(--theme-accent-success, #10b981)';
    case 'in_progress': return 'var(--theme-primary, #3b82f6)';
    default: return 'var(--theme-border-secondary)';
  }
}

function statusDotColor(status: string): string {
  switch (status) {
    case 'completed': return 'var(--theme-accent-success, #10b981)';
    case 'in_progress': return 'var(--theme-primary, #3b82f6)';
    default: return 'var(--theme-accent-warning, #f59e0b)';
  }
}
</script>

<style scoped>
.dep-graph-root {
  position: relative;
  overflow: auto;
  width: 100%;
  max-height: 520px;
  border: 1px solid var(--theme-border-secondary);
  border-radius: 8px;
  background: var(--theme-bg-tertiary);
}

.dep-graph-svg {
  display: block;
}

.dep-node {
  cursor: pointer;
  transition: opacity 0.15s;
}

.node-id {
  font-size: 10px;
  font-weight: 700;
  fill: var(--theme-text-tertiary);
  font-family: ui-monospace, monospace;
}

.node-subject {
  font-size: 11px;
  font-weight: 600;
  fill: var(--theme-text-primary);
}

.node-owner {
  font-size: 9px;
  fill: var(--theme-text-tertiary);
}

/* Tooltip */
.dep-tooltip {
  position: absolute;
  z-index: 20;
  padding: 8px 12px;
  background: var(--theme-bg-primary);
  border: 1px solid var(--theme-border-primary);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  font-size: 11px;
  max-width: 260px;
  pointer-events: none;
}

.tooltip-title {
  font-weight: 700;
  color: var(--theme-text-primary);
  margin-bottom: 4px;
}

.tooltip-status {
  font-weight: 600;
  font-size: 10px;
  margin-bottom: 2px;
}
.tooltip-pending { color: var(--theme-accent-warning, #f59e0b); }
.tooltip-in_progress { color: var(--theme-primary, #3b82f6); }
.tooltip-completed { color: var(--theme-accent-success, #10b981); }

.tooltip-owner {
  color: var(--theme-text-secondary);
}

.tooltip-deps {
  color: var(--theme-text-tertiary);
  font-size: 10px;
}
</style>
