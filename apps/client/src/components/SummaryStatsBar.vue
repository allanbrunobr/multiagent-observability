<template>
  <div class="stats-bar">
    <div class="stat-card">
      <span class="stat-icon">&#9881;</span>
      <div class="stat-data">
        <span class="stat-number">{{ totalEvents }}</span>
        <span class="stat-label">Events</span>
      </div>
    </div>
    <div class="stat-card">
      <span class="stat-icon">&#9673;</span>
      <div class="stat-data">
        <span class="stat-number">{{ activeAgents }}</span>
        <span class="stat-label">Active Agents</span>
      </div>
    </div>
    <div class="stat-card" :class="{ 'stat-alert': pendingHITL > 0 }">
      <span class="stat-icon">&#9888;</span>
      <div class="stat-data">
        <span class="stat-number">{{ pendingHITL }}</span>
        <span class="stat-label">Pending HITL</span>
      </div>
    </div>
    <div class="stat-card">
      <span class="stat-icon">&#9654;</span>
      <div class="stat-data">
        <span class="stat-number">{{ activeSessions }}</span>
        <span class="stat-label">Sessions</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { HookEvent } from '../types';
import type { SummaryStats } from '../composables/useWebSocket';

const props = defineProps<{
  events: HookEvent[];
  serverStats?: SummaryStats | null;
}>();

// Use server stats when available, fall back to client-side computation
const totalEvents = computed(() => props.serverStats?.totalEvents ?? props.events.length);

const activeAgents = computed(() => {
  if (props.serverStats) return props.serverStats.activeAgents;
  const agentLastEvent = new Map<string, string>();
  for (const evt of props.events) {
    const key = `${evt.source_app}:${evt.session_id}`;
    agentLastEvent.set(key, evt.hook_event_type);
  }
  let count = 0;
  for (const lastType of agentLastEvent.values()) {
    if (lastType !== 'Stop' && lastType !== 'SessionEnd') {
      count++;
    }
  }
  return count;
});

const pendingHITL = computed(() => {
  if (props.serverStats) return props.serverStats.pendingHITL;
  return props.events.filter(e =>
    e.humanInTheLoop &&
    (!e.humanInTheLoopStatus || e.humanInTheLoopStatus.status === 'pending')
  ).length;
});

const activeSessions = computed(() => {
  if (props.serverStats) return props.serverStats.activeSessions;
  const sessions = new Set<string>();
  for (const evt of props.events) {
    sessions.add(evt.session_id);
  }
  return sessions.size;
});
</script>

<style scoped>
.stats-bar {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  background: var(--theme-bg-primary);
  border-bottom: 1px solid var(--theme-border-primary);
  overflow-x: auto;
  flex-shrink: 0;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 8px;
  background: var(--theme-bg-tertiary);
  border: 1px solid var(--theme-border-primary);
  min-width: 0;
  flex: 1;
}

.stat-alert {
  border-color: var(--theme-accent-warning, #eab308);
  background: color-mix(in srgb, var(--theme-accent-warning, #eab308) 8%, var(--theme-bg-tertiary));
}

.stat-icon {
  font-size: 16px;
  opacity: 0.6;
  flex-shrink: 0;
}

.stat-data {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stat-number {
  font-size: 16px;
  font-weight: 800;
  color: var(--theme-text-primary);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--theme-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  white-space: nowrap;
}
</style>
