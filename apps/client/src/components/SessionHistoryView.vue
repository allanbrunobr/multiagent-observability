<template>
  <div class="history-root" :class="{ 'history-embedded': embedded }">
    <!-- Detail mode: viewing a specific session's events -->
    <template v-if="loadedSessionId">
      <div class="detail-header">
        <button class="back-btn" @click="handleBack">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div class="detail-meta">
          <span class="detail-session-id">{{ truncateId(loadedSessionId) }}</span>
          <span class="detail-event-count">{{ loadedEvents.length }} events</span>
        </div>
        <button class="view-live-btn" @click="handleViewLive" title="View in Live tab">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polygon points="10,8 16,12 10,16" />
          </svg>
          View Live
        </button>
      </div>

      <!-- Session Stats -->
      <div v-if="!isLoading && loadedEvents.length > 0" class="session-stats">
        <div class="stat-item">
          <span class="stat-label">Duration</span>
          <span class="stat-value">{{ sessionDuration }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Events</span>
          <span class="stat-value">{{ loadedEvents.length }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Tools</span>
          <span class="stat-value">{{ uniqueTools.length }}</span>
        </div>
        <div class="stat-item" v-if="sessionModel">
          <span class="stat-label">Model</span>
          <span class="stat-value stat-model">{{ sessionModel }}</span>
        </div>
      </div>

      <!-- Mini Agent Tree -->
      <div v-if="!isLoading && miniAgentNodes.length > 0" class="mini-tree">
        <div class="mini-tree-header">Agent Tree</div>
        <div class="mini-tree-nodes">
          <div
            v-for="node in miniAgentNodes"
            :key="node.agentId"
            class="mini-tree-node"
            :class="{ 'mini-tree-child': node.isChild }"
          >
            <span class="mini-node-status" :class="`mini-status-${node.status}`"></span>
            <span class="mini-node-name">{{ node.name || node.agentId }}</span>
            <span v-if="node.type" class="mini-node-type">{{ node.type }}</span>
          </div>
        </div>
      </div>

      <!-- Unique Tools List -->
      <div v-if="!isLoading && uniqueTools.length > 0" class="tools-list">
        <span
          v-for="tool in uniqueTools"
          :key="tool"
          class="tool-badge"
        >{{ tool }}</span>
      </div>

      <div class="detail-events">
        <div v-if="isLoading" class="loading-state">Loading events...</div>
        <div v-else-if="loadedEvents.length === 0" class="empty-state">No events found.</div>
        <div
          v-else
          v-for="event in loadedEvents"
          :key="`${event.session_id}-${event.timestamp}-${event.hook_event_type}`"
          class="event-row"
        >
          <div class="event-time">{{ formatTime(event.timestamp) }}</div>
          <div class="event-type" :class="eventTypeClass(event.hook_event_type)">
            {{ event.hook_event_type }}
            <span v-if="event.payload?.tool_name" class="event-tool">:{{ event.payload.tool_name }}</span>
          </div>
          <div v-if="event.summary" class="event-summary">{{ event.summary }}</div>
        </div>
      </div>
    </template>

    <!-- List mode: browsing sessions -->
    <template v-else>
      <div class="list-header">
        <span class="list-title">Session History</span>
        <button class="refresh-btn" @click="refresh" :disabled="isLoading">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ spinning: isLoading }">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
        </button>
      </div>

      <div v-if="error" class="error-state">{{ error }}</div>

      <div v-if="isLoading && sessions.length === 0" class="loading-state">Loading sessions...</div>

      <div v-else-if="sessions.length === 0" class="empty-state">
        No sessions found. Events will appear here after agents run.
      </div>

      <div v-else class="session-list">
        <div
          v-for="session in sessions"
          :key="session.session_id"
          class="session-card"
          @click="handleSelectSession(session.session_id)"
        >
          <div class="session-top">
            <span class="session-app">{{ session.source_app }}</span>
            <span class="session-status" :class="session.status">{{ session.status }}</span>
          </div>

          <div class="session-id">{{ truncateId(session.session_id) }}</div>

          <div class="session-time">
            {{ formatTimestamp(session.first_event_time) }} — {{ formatTimestamp(session.last_event_time) }}
          </div>

          <div class="session-bottom">
            <span class="session-event-count">{{ session.event_count }} events</span>
            <div class="session-badges">
              <span v-if="session.has_team" class="badge badge-team">team</span>
              <span v-if="session.has_tasks" class="badge badge-tasks">tasks</span>
              <span v-if="session.model_name" class="badge badge-model">{{ session.model_name }}</span>
            </div>
          </div>
        </div>

        <!-- Load more -->
        <button
          v-if="hasMore"
          class="load-more-btn"
          :disabled="isLoading"
          @click="nextPage"
        >
          {{ isLoading ? 'Loading...' : 'Load more' }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useSessionHistory } from '../composables/useSessionHistory';

defineProps<{
  embedded?: boolean;
}>();

const emit = defineEmits<{
  loadSession: [sessionId: string];
}>();

const {
  sessions,
  loadedSessionId,
  loadedEvents,
  isLoading,
  error,
  hasMore,
  fetchSessions,
  loadSessionEvents,
  nextPage,
  clearLoadedSession,
} = useSessionHistory();

onMounted(() => {
  fetchSessions(true);
});

function handleSelectSession(sessionId: string) {
  loadSessionEvents(sessionId);
}

function handleViewLive() {
  if (loadedSessionId.value) {
    emit('loadSession', loadedSessionId.value);
  }
}

function handleBack() {
  clearLoadedSession();
}

function refresh() {
  fetchSessions(true);
}

// Session stats computed properties
const sessionDuration = computed(() => {
  if (loadedEvents.value.length < 2) return '< 1s';
  const timestamps = loadedEvents.value
    .map(e => e.timestamp)
    .filter((t): t is number => t !== undefined);
  if (timestamps.length < 2) return '< 1s';
  const ms = Math.max(...timestamps) - Math.min(...timestamps);
  if (ms < 1000) return '< 1s';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3600_000).toFixed(1)}h`;
});

const uniqueTools = computed(() => {
  const tools = new Set<string>();
  for (const event of loadedEvents.value) {
    const toolName = event.payload?.tool_name;
    if (toolName) tools.add(toolName);
  }
  return [...tools].sort();
});

const sessionModel = computed(() => {
  for (const event of loadedEvents.value) {
    if (event.model_name) return event.model_name;
  }
  return null;
});

// Mini agent tree from session events
interface MiniAgentNode {
  agentId: string;
  name: string | null;
  type: string | null;
  status: 'active' | 'stopped';
  isChild: boolean;
}

const miniAgentNodes = computed((): MiniAgentNode[] => {
  const nodes: MiniAgentNode[] = [];
  const seenIds = new Set<string>();
  const stoppedIds = new Set<string>();

  // Collect SubagentStop events first
  for (const event of loadedEvents.value) {
    if (event.hook_event_type === 'SubagentStop' && event.payload?.agent_id) {
      stoppedIds.add(event.payload.agent_id);
    }
  }

  // Build nodes from SubagentStart events
  for (const event of loadedEvents.value) {
    if (event.hook_event_type === 'SubagentStart' && event.payload?.agent_id) {
      const id = event.payload.agent_id;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      nodes.push({
        agentId: id,
        name: null,
        type: event.payload.agent_type || null,
        status: stoppedIds.has(id) ? 'stopped' : 'active',
        isChild: true,
      });
    }
  }

  // Match Task launches to give names
  for (const event of loadedEvents.value) {
    if (event.hook_event_type === 'PreToolUse' && event.payload?.tool_name === 'Task') {
      const taskName = event.payload.tool_input?.name;
      if (taskName) {
        // Find first unnamed node of matching type
        const node = nodes.find(n => !n.name && (
          n.type === event.payload.tool_input?.subagent_type ||
          !n.type
        ));
        if (node) node.name = taskName;
      }
    }
  }

  if (nodes.length === 0) return [];

  // Add root node (the parent session)
  const rootSourceApp = loadedEvents.value[0]?.source_app || 'unknown';
  return [
    {
      agentId: 'root',
      name: rootSourceApp,
      type: null,
      status: 'active' as const,
      isChild: false,
    },
    ...nodes,
  ];
});

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return id.slice(0, 6) + '...' + id.slice(-4);
}

function formatTimestamp(ts: number | undefined): string {
  if (!ts) return '\u2014';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatTime(ts: number | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function eventTypeClass(type: string): string {
  if (type === 'PreToolUse') return 'type-tool';
  if (type === 'PostToolUse') return 'type-tool-post';
  if (type === 'SubagentStart') return 'type-agent';
  if (type === 'SubagentStop') return 'type-agent-stop';
  if (type === 'SessionStart') return 'type-session';
  if (type === 'Stop' || type === 'SessionEnd') return 'type-stop';
  return '';
}
</script>

<style scoped>
.history-root {
  width: 100%;
}

.history-embedded {
  font-size: 12px;
}

/* ---- List Header ---- */
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.list-title {
  font-weight: 700;
  font-size: 13px;
  color: var(--theme-text-primary);
}

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--theme-border-secondary);
  border-radius: 6px;
  background: var(--theme-bg-tertiary);
  color: var(--theme-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.refresh-btn:hover { background: var(--theme-bg-quaternary); }
.refresh-btn:disabled { opacity: 0.5; cursor: default; }

.spinning { animation: spin 0.8s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* ---- Session Card ---- */
.session-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.session-card {
  padding: 10px;
  border-radius: 8px;
  background: var(--theme-bg-primary);
  border: 1px solid var(--theme-border-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.session-card:hover {
  border-color: var(--theme-primary);
  background: var(--theme-hover-bg);
}

.session-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.session-app {
  font-weight: 700;
  font-size: 12px;
  color: var(--theme-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.session-status {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 99px;
}
.session-status.active {
  background: rgba(16, 185, 129, 0.15);
  color: var(--theme-accent-success, #10b981);
}
.session-status.ended {
  background: var(--theme-bg-tertiary);
  color: var(--theme-text-tertiary);
}

.session-id {
  font-size: 11px;
  font-family: monospace;
  color: var(--theme-text-tertiary);
  margin-bottom: 4px;
}

.session-time {
  font-size: 10px;
  color: var(--theme-text-tertiary);
  margin-bottom: 6px;
}

.session-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.session-event-count {
  font-size: 10px;
  color: var(--theme-text-secondary);
  font-weight: 600;
}

.session-badges {
  display: flex;
  gap: 4px;
}

.badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.badge-team {
  background: rgba(59, 130, 246, 0.15);
  color: var(--theme-primary, #3b82f6);
}

.badge-tasks {
  background: rgba(245, 158, 11, 0.15);
  color: var(--theme-accent-warning, #f59e0b);
}

.badge-model {
  background: var(--theme-bg-tertiary);
  color: var(--theme-text-tertiary);
}

.load-more-btn {
  margin-top: 4px;
  padding: 8px;
  border: 1px dashed var(--theme-border-secondary);
  border-radius: 8px;
  background: transparent;
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.load-more-btn:hover:not(:disabled) {
  background: var(--theme-bg-tertiary);
  border-color: var(--theme-primary);
  color: var(--theme-primary);
}
.load-more-btn:disabled { opacity: 0.5; cursor: default; }

/* ---- Detail Mode ---- */
.detail-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--theme-border-secondary);
  border-radius: 6px;
  background: var(--theme-bg-tertiary);
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.back-btn:hover { background: var(--theme-bg-quaternary); color: var(--theme-text-primary); }

.detail-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-session-id {
  font-family: monospace;
  font-size: 11px;
  color: var(--theme-text-secondary);
}

.detail-event-count {
  font-size: 10px;
  color: var(--theme-text-tertiary);
  background: var(--theme-bg-tertiary);
  padding: 2px 6px;
  border-radius: 99px;
}

/* ---- Event rows ---- */
.detail-events {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.event-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--theme-bg-primary);
  border: 1px solid var(--theme-border-secondary);
  font-size: 11px;
}
.event-row:hover { background: var(--theme-hover-bg); }

.event-time {
  font-family: monospace;
  font-size: 10px;
  color: var(--theme-text-tertiary);
  flex-shrink: 0;
  min-width: 64px;
}

.event-type {
  font-weight: 700;
  font-size: 10px;
  white-space: nowrap;
  color: var(--theme-text-secondary);
}
.event-tool { color: var(--theme-text-tertiary); font-weight: 400; }

.type-tool { color: var(--theme-primary, #3b82f6); }
.type-tool-post { color: var(--theme-accent-info, #6366f1); }
.type-agent { color: var(--theme-accent-success, #10b981); }
.type-agent-stop { color: var(--theme-accent-error, #ef4444); }
.type-session { color: var(--theme-accent-warning, #f59e0b); }
.type-stop { color: var(--theme-text-tertiary); }

.event-summary {
  flex: 1;
  font-size: 10px;
  color: var(--theme-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- View Live Button ---- */
.view-live-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--theme-primary);
  border-radius: 6px;
  background: color-mix(in srgb, var(--theme-primary) 10%, transparent);
  color: var(--theme-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  margin-left: auto;
}
.view-live-btn:hover {
  background: color-mix(in srgb, var(--theme-primary) 20%, transparent);
}

/* ---- Session Stats ---- */
.session-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--theme-bg-tertiary);
  border: 1px solid var(--theme-border-secondary);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--theme-text-tertiary);
}

.stat-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--theme-text-primary);
  font-family: ui-monospace, monospace;
}

.stat-model {
  font-size: 11px;
  font-weight: 600;
}

/* ---- Mini Agent Tree ---- */
.mini-tree {
  margin-bottom: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--theme-bg-tertiary);
  border: 1px solid var(--theme-border-secondary);
}

.mini-tree-header {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--theme-text-tertiary);
  margin-bottom: 6px;
}

.mini-tree-nodes {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.mini-tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.mini-tree-child {
  margin-left: 16px;
  border-left: 2px solid var(--theme-border-secondary);
  padding-left: 10px;
}

.mini-node-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.mini-status-active {
  background: var(--theme-accent-success, #10b981);
  box-shadow: 0 0 4px rgba(16, 185, 129, 0.4);
}

.mini-status-stopped {
  background: var(--theme-text-tertiary);
}

.mini-node-name {
  font-weight: 600;
  color: var(--theme-text-primary);
}

.mini-node-type {
  font-size: 10px;
  color: var(--theme-text-tertiary);
  background: var(--theme-bg-quaternary);
  padding: 1px 5px;
  border-radius: 3px;
}

/* ---- Tools List ---- */
.tools-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
}

.tool-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--theme-primary) 12%, transparent);
  color: var(--theme-primary);
}

/* ---- States ---- */
.loading-state,
.empty-state,
.error-state {
  text-align: center;
  padding: 32px 16px;
  font-size: 13px;
  font-style: italic;
}
.loading-state { color: var(--theme-text-secondary); }
.empty-state { color: var(--theme-text-tertiary); }
.error-state { color: var(--theme-accent-error, #ef4444); }
</style>
