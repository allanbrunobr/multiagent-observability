<template>
  <div class="heatmap-root">
    <div class="heatmap-header">
      <span class="heatmap-title">Agent Activity Heatmap</span>
      <span class="heatmap-subtitle">{{ heatmap.rows.length }} agents, {{ formatBucketSize(heatmap.bucketSizeMs) }} buckets</span>
    </div>

    <div v-if="heatmap.rows.length === 0" class="heatmap-empty">
      No agent activity data yet.
    </div>

    <div v-else class="heatmap-container">
      <!-- Time labels (top row) -->
      <div class="heatmap-grid" :style="gridStyle">
        <!-- Corner cell -->
        <div class="heatmap-corner"></div>
        <!-- Bucket time labels -->
        <div
          v-for="(label, i) in displayedLabels"
          :key="`label-${i}`"
          class="heatmap-time-label"
          :style="{ gridColumn: label.col }"
        >{{ label.text }}</div>

        <!-- Agent rows -->
        <template v-for="(row, rowIdx) in heatmap.rows" :key="row.agentId">
          <!-- Agent name label -->
          <div class="heatmap-agent-label" :style="{ gridRow: rowIdx + 2 }">
            <span class="agent-dot" :style="{ background: agentColor(row.sourceApp) }"></span>
            <span class="agent-name">{{ truncateAgent(row.agentId) }}</span>
            <span class="agent-event-count">{{ row.totalEvents }}</span>
          </div>

          <!-- Cells -->
          <div
            v-for="cell in row.cells"
            :key="`${row.agentId}-${cell.bucketIndex}`"
            class="heatmap-cell"
            :style="{
              gridColumn: cell.bucketIndex + 2,
              gridRow: rowIdx + 2,
              backgroundColor: cellColor(cell.intensity),
            }"
            :title="`${row.agentId}: ${cell.count} events`"
            @mouseenter="hoveredCell = cell"
            @mouseleave="hoveredCell = null"
          ></div>
        </template>
      </div>
    </div>

    <!-- Hover tooltip -->
    <div v-if="hoveredCell" class="heatmap-tooltip">
      {{ hoveredCell.count }} events
    </div>

    <!-- Legend -->
    <div v-if="heatmap.rows.length > 0" class="heatmap-legend">
      <span class="legend-label">Less</span>
      <div class="legend-cells">
        <div v-for="i in 5" :key="i" class="legend-cell" :style="{ backgroundColor: cellColor((i - 1) / 4) }"></div>
      </div>
      <span class="legend-label">More</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { HookEvent } from '../types';
import { useHeatmapData, type HeatmapCell } from '../composables/useHeatmapData';
import { useEventColors } from '../composables/useEventColors';

const props = defineProps<{
  events: HookEvent[];
}>();

const eventsRef = computed(() => props.events);
const { heatmap } = useHeatmapData(eventsRef);
const { getHexColorForApp } = useEventColors();

const hoveredCell = ref<HeatmapCell | null>(null);

const gridStyle = computed(() => {
  const cols = heatmap.value.bucketCount;
  return {
    gridTemplateColumns: `120px repeat(${cols}, 1fr)`,
    gridTemplateRows: `24px repeat(${heatmap.value.rows.length}, 28px)`,
  };
});

// Show every Nth label to avoid crowding
const displayedLabels = computed(() => {
  const labels = heatmap.value.bucketLabels;
  if (labels.length === 0) return [];
  const step = Math.max(1, Math.ceil(labels.length / 12));
  const result: { text: string; col: number }[] = [];
  for (let i = 0; i < labels.length; i += step) {
    result.push({ text: labels[i], col: i + 2 });
  }
  return result;
});

function truncateAgent(id: string): string {
  if (id.length <= 20) return id;
  return id.slice(0, 18) + '\u2026';
}

function agentColor(sourceApp: string): string {
  return getHexColorForApp(sourceApp);
}

function cellColor(intensity: number): string {
  if (intensity === 0) return 'var(--theme-bg-quaternary)';
  // Use CSS color-mix for theme-aware colors
  const alpha = Math.round(20 + intensity * 80);
  return `color-mix(in srgb, var(--theme-primary) ${alpha}%, transparent)`;
}

function formatBucketSize(ms: number): string {
  if (ms < 60_000) return `${ms / 1000}s`;
  return `${ms / 60_000}m`;
}
</script>

<style scoped>
.heatmap-root {
  width: 100%;
  padding: 12px;
}

.heatmap-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 10px;
}

.heatmap-title {
  font-weight: 700;
  font-size: 14px;
  color: var(--theme-text-primary);
}

.heatmap-subtitle {
  font-size: 11px;
  color: var(--theme-text-tertiary);
}

.heatmap-empty {
  text-align: center;
  padding: 32px 16px;
  font-size: 13px;
  font-style: italic;
  color: var(--theme-text-tertiary);
}

.heatmap-container {
  overflow-x: auto;
  border: 1px solid var(--theme-border-secondary);
  border-radius: 8px;
  background: var(--theme-bg-tertiary);
  padding: 8px;
}

.heatmap-grid {
  display: grid;
  gap: 2px;
  min-width: 400px;
}

.heatmap-corner {
  grid-column: 1;
  grid-row: 1;
}

.heatmap-time-label {
  grid-row: 1;
  font-size: 9px;
  color: var(--theme-text-tertiary);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  padding: 2px 0;
}

.heatmap-agent-label {
  grid-column: 1;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
  overflow: hidden;
}

.agent-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.agent-name {
  font-size: 10px;
  font-weight: 600;
  color: var(--theme-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.agent-event-count {
  font-size: 9px;
  font-weight: 700;
  color: var(--theme-text-tertiary);
  background: var(--theme-bg-quaternary);
  padding: 1px 5px;
  border-radius: 99px;
  flex-shrink: 0;
}

.heatmap-cell {
  border-radius: 3px;
  min-width: 8px;
  min-height: 20px;
  transition: all 0.1s;
  cursor: default;
}

.heatmap-cell:hover {
  outline: 2px solid var(--theme-primary);
  outline-offset: -1px;
  z-index: 1;
}

.heatmap-tooltip {
  position: fixed;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 10px;
  background: var(--theme-bg-primary);
  border: 1px solid var(--theme-border-primary);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  font-size: 11px;
  font-weight: 600;
  color: var(--theme-text-primary);
  pointer-events: none;
  z-index: 50;
}

/* Legend */
.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  justify-content: flex-end;
}

.legend-label {
  font-size: 10px;
  color: var(--theme-text-tertiary);
}

.legend-cells {
  display: flex;
  gap: 2px;
}

.legend-cell {
  width: 14px;
  height: 14px;
  border-radius: 3px;
}
</style>
