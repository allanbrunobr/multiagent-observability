import { computed, type Ref } from 'vue';
import type { HookEvent } from '../types';

export interface HeatmapCell {
  agentId: string;
  bucketIndex: number;
  bucketStart: number;
  bucketEnd: number;
  count: number;
  intensity: number; // 0-1 normalized
}

export interface HeatmapRow {
  agentId: string;
  sourceApp: string;
  sessionId: string;
  cells: HeatmapCell[];
  totalEvents: number;
}

export interface HeatmapData {
  rows: HeatmapRow[];
  bucketLabels: string[];
  bucketCount: number;
  bucketSizeMs: number;
  maxCount: number;
}

function formatBucketLabel(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function useHeatmapData(events: Ref<HookEvent[]>) {
  const heatmap = computed((): HeatmapData => {
    const evts = events.value;
    if (evts.length === 0) {
      return { rows: [], bucketLabels: [], bucketCount: 0, bucketSizeMs: 30_000, maxCount: 0 };
    }

    // Determine time range
    const timestamps = evts
      .map(e => e.timestamp)
      .filter((t): t is number => t !== undefined && t > 0);
    if (timestamps.length === 0) {
      return { rows: [], bucketLabels: [], bucketCount: 0, bucketSizeMs: 30_000, maxCount: 0 };
    }

    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(...timestamps);
    const durationMs = maxTs - minTs;

    // Adaptive bucket size
    let bucketSizeMs: number;
    if (durationMs < 3 * 60_000) {
      bucketSizeMs = 30_000; // 30s buckets for < 3 min
    } else if (durationMs < 15 * 60_000) {
      bucketSizeMs = 60_000; // 1m buckets for < 15 min
    } else {
      bucketSizeMs = 5 * 60_000; // 5m buckets for > 15 min
    }

    const bucketCount = Math.max(1, Math.ceil(durationMs / bucketSizeMs) + 1);

    // Group events by agent (source_app:session_id)
    const agentEvents = new Map<string, { sourceApp: string; sessionId: string; events: HookEvent[] }>();
    for (const evt of evts) {
      const sessionId = evt.session_id;
      const sourceApp = evt.source_app;
      const agentId = `${sourceApp}:${sessionId.slice(0, 8)}`;
      if (!agentEvents.has(agentId)) {
        agentEvents.set(agentId, { sourceApp, sessionId, events: [] });
      }
      agentEvents.get(agentId)!.events.push(evt);
    }

    // Build bucket labels
    const bucketLabels: string[] = [];
    for (let i = 0; i < bucketCount; i++) {
      const bucketStart = minTs + i * bucketSizeMs;
      bucketLabels.push(formatBucketLabel(bucketStart));
    }

    // Build rows
    let maxCount = 0;
    const rows: HeatmapRow[] = [];

    for (const [agentId, data] of agentEvents) {
      const cells: HeatmapCell[] = [];

      // Count events per bucket
      const bucketCounts = new Array(bucketCount).fill(0);
      for (const evt of data.events) {
        const ts = evt.timestamp;
        if (ts === undefined) continue;
        const bucketIdx = Math.min(
          Math.floor((ts - minTs) / bucketSizeMs),
          bucketCount - 1
        );
        bucketCounts[bucketIdx]++;
      }

      for (let i = 0; i < bucketCount; i++) {
        const count = bucketCounts[i];
        if (count > maxCount) maxCount = count;
        cells.push({
          agentId,
          bucketIndex: i,
          bucketStart: minTs + i * bucketSizeMs,
          bucketEnd: minTs + (i + 1) * bucketSizeMs,
          count,
          intensity: 0, // computed after we know maxCount
        });
      }

      rows.push({
        agentId,
        sourceApp: data.sourceApp,
        sessionId: data.sessionId,
        cells,
        totalEvents: data.events.length,
      });
    }

    // Normalize intensities
    if (maxCount > 0) {
      for (const row of rows) {
        for (const cell of row.cells) {
          cell.intensity = cell.count / maxCount;
        }
      }
    }

    // Sort rows by total events descending
    rows.sort((a, b) => b.totalEvents - a.totalEvents);

    return { rows, bucketLabels, bucketCount, bucketSizeMs, maxCount };
  });

  return { heatmap };
}
