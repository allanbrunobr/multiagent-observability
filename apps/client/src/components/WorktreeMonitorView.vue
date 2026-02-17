<template>
  <div v-if="hasWorktrees" class="wt-container" :class="{ 'wt-embedded': embedded }">
    <div v-for="group in worktreeGroups" :key="group.repoId" class="wt-group">
      <!-- Header -->
      <button class="wt-header" @click="toggleGroup(group.repoId)" :aria-expanded="!collapsedGroups.has(group.repoId)">
        <div class="wt-header-left">
          <span class="header-icon">{{ collapsedGroups.has(group.repoId) ? '\u25B6' : '\u25BC' }}</span>
          <span class="header-label">{{ group.repoName }}</span>
        </div>
        <span class="header-badge">{{ group.worktrees.length }} worktrees</span>
      </button>

      <!-- Body -->
      <div v-show="!collapsedGroups.has(group.repoId)" class="wt-body">
        <div
          v-for="(wt, idx) in group.worktrees"
          :key="wt.sourceApp"
          class="wt-row-wrapper"
        >
          <div class="wt-row">
            <!-- Connector -->
            <div class="wt-connector">
              <div class="conn-vert" :class="{ 'conn-last': idx === group.worktrees.length - 1 && !isExpanded(wt.sourceApp) }"></div>
              <div class="conn-horiz"></div>
            </div>

            <!-- Card -->
            <div
              class="wt-card"
              :class="{
                'wt-selected': currentSourceAppFilter === wt.sourceApp,
                'wt-expanded': isExpanded(wt.sourceApp)
              }"
              @click="handleCardClick(wt.sourceApp)"
            >
              <div class="wt-avatar" :style="{ background: getChildColor(wt.branch) }">
                {{ wt.branch.charAt(0).toUpperCase() }}
              </div>
              <div class="wt-info">
                <div class="wt-top">
                  <span class="wt-branch">{{ wt.branch }}</span>
                  <span class="tag tag-source">{{ wt.sourceApp }}</span>
                </div>
                <div class="wt-bottom">
                  <span class="wt-meta">{{ wt.eventCount }} events</span>
                  <span class="wt-meta">{{ formatRelativeTime(wt.lastEventTimestamp) }}</span>
                  <span v-if="!wt.gitMetadata.is_worktree" class="tag tag-main">main</span>
                  <span v-else class="tag tag-wt">worktree</span>
                </div>
              </div>
              <span class="wt-status" :class="statusClass(wt.status)" :title="wt.status"></span>
              <span class="wt-expand-icon">{{ isExpanded(wt.sourceApp) ? '\u25B2' : '\u25BC' }}</span>
            </div>
          </div>

          <!-- Expanded Kanban for this worktree -->
          <div v-if="isExpanded(wt.sourceApp)" class="wt-kanban-panel">
            <TaskKanbanBoard
              :events="events"
              :source-app-filter="wt.sourceApp"
              embedded
            />
            <div v-if="!hasTasksForApp(wt.sourceApp)" class="wt-kanban-empty">
              No tasks for this worktree
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { HookEvent } from '../types';
import { useWorktreeMonitor } from '../composables/useWorktreeMonitor';
import { useTaskBoard } from '../composables/useTaskBoard';
import { useEventColors } from '../composables/useEventColors';
import TaskKanbanBoard from './TaskKanbanBoard.vue';

const props = withDefaults(defineProps<{
  events: HookEvent[];
  currentSourceAppFilter: string;
  embedded?: boolean;
}>(), {
  embedded: false,
});

const emit = defineEmits<{
  filterBySourceApp: [sourceApp: string];
}>();

const collapsedGroups = ref(new Set<string>());
const expandedWorktrees = ref(new Set<string>());

const eventsRef = computed(() => props.events);
const { worktreeGroups, hasWorktrees } = useWorktreeMonitor(eventsRef);
const { boards } = useTaskBoard(eventsRef);
const { getHexColorForApp } = useEventColors();

const toggleGroup = (repoId: string) => {
  const next = new Set(collapsedGroups.value);
  if (next.has(repoId)) {
    next.delete(repoId);
  } else {
    next.add(repoId);
  }
  collapsedGroups.value = next;
};

const isExpanded = (sourceApp: string) => expandedWorktrees.value.has(sourceApp);

const handleCardClick = (sourceApp: string) => {
  const next = new Set(expandedWorktrees.value);
  if (next.has(sourceApp)) {
    next.delete(sourceApp);
  } else {
    next.add(sourceApp);
  }
  expandedWorktrees.value = next;
  emit('filterBySourceApp', sourceApp);
};

const hasTasksForApp = (sourceApp: string): boolean => {
  return boards.value.some(b => b.sourceApp === sourceApp);
};

const getChildColor = (name: string) => getHexColorForApp(name);

const statusClass = (status: string) => {
  switch (status) {
    case 'active': return 'status-active';
    case 'idle': return 'status-idle';
    case 'stopped': return 'status-stopped';
    default: return 'status-stopped';
  }
};

const formatRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  if (diff < 1000) return 'just now';
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};
</script>

<style scoped>
.wt-container {
  margin: 6px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.wt-container.wt-embedded {
  margin: 0;
}

.wt-group {
  border-radius: 10px;
  background: var(--theme-bg-tertiary);
  border: 1px solid var(--theme-border-primary);
  overflow: hidden;
  animation: fadeSlide 0.25s ease;
}

@keyframes fadeSlide {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* --- Header --- */
.wt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 7px 14px;
  border: none;
  cursor: pointer;
  background: linear-gradient(135deg, var(--theme-accent-info, #3b82f6), var(--theme-primary));
  color: white;
  user-select: none;
  transition: filter 0.15s;
}
.wt-header:hover { filter: brightness(1.1); }
.wt-header-left { display: flex; align-items: center; gap: 8px; }
.header-icon { font-size: 10px; opacity: 0.8; }
.header-label { font-size: 13px; font-weight: 700; letter-spacing: 0.3px; }
.header-badge {
  font-size: 11px; font-weight: 700;
  background: rgba(255,255,255,0.2);
  padding: 1px 10px;
  border-radius: 999px;
}

/* --- Body --- */
.wt-body { padding: 10px 14px 12px; }

/* --- Row --- */
.wt-row {
  display: flex;
  align-items: stretch;
  position: relative;
  min-height: 48px;
}

/* --- Connector lines --- */
.wt-connector {
  width: 24px;
  flex-shrink: 0;
  position: relative;
}

.conn-vert {
  position: absolute;
  left: 7px;
  top: 0;
  bottom: 0;
  width: 0;
  border-left: 2px solid var(--theme-border-secondary);
}
.conn-vert.conn-last { bottom: 50%; }

.conn-horiz {
  position: absolute;
  left: 7px;
  top: 50%;
  width: 17px;
  height: 0;
  border-top: 2px solid var(--theme-border-secondary);
}

/* --- Card --- */
.wt-card {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  margin: 3px 0;
  border-radius: 8px;
  background: var(--theme-bg-secondary);
  border: 1px solid var(--theme-border-primary);
  cursor: pointer;
  transition: all 0.15s;
}
.wt-card:hover {
  background: var(--theme-bg-quaternary);
  border-color: var(--theme-accent-info, #3b82f6);
}
.wt-selected {
  border-color: var(--theme-accent-info, #3b82f6) !important;
  box-shadow: 0 0 0 2px var(--theme-accent-info, #3b82f6) !important;
}

.wt-avatar {
  width: 28px; height: 28px;
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 800; color: white;
  flex-shrink: 0;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

.wt-info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.wt-top { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.wt-bottom { display: flex; align-items: center; gap: 8px; }

.wt-branch {
  font-size: 12px; font-weight: 700;
  color: var(--theme-text-primary);
  font-family: ui-monospace, monospace;
}

.tag {
  font-size: 10px; font-weight: 600;
  padding: 0 6px;
  border-radius: 4px;
  white-space: nowrap;
  line-height: 18px;
}
.tag-source {
  background: var(--theme-bg-quaternary);
  color: var(--theme-text-tertiary);
  border: 1px solid var(--theme-border-secondary);
  font-family: ui-monospace, monospace;
}
.tag-main {
  background: var(--theme-primary);
  color: white;
  opacity: 0.85;
}
.tag-wt {
  background: var(--theme-accent-info, #3b82f6);
  color: white;
  opacity: 0.85;
}

.wt-meta {
  font-size: 10px;
  color: var(--theme-text-tertiary);
}

/* --- Status indicators --- */
.wt-status {
  width: 10px; height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-active {
  background: var(--theme-accent-success, #22c55e);
  box-shadow: 0 0 8px var(--theme-accent-success, #22c55e);
  animation: pulse 2s ease-in-out infinite;
}
.status-idle {
  background: var(--theme-accent-warning, #eab308);
  box-shadow: 0 0 4px var(--theme-accent-warning, #eab308);
}
.status-stopped {
  background: var(--theme-accent-error, #ef4444);
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}

/* --- Row wrapper (card + expanded panel) --- */
.wt-row-wrapper {
  display: flex;
  flex-direction: column;
}

/* --- Expand icon on card --- */
.wt-expand-icon {
  font-size: 9px;
  color: var(--theme-text-tertiary);
  flex-shrink: 0;
  margin-left: 4px;
  transition: transform 0.2s;
}

.wt-expanded {
  border-color: var(--theme-primary) !important;
  background: var(--theme-bg-quaternary);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

/* --- Expanded Kanban panel --- */
.wt-kanban-panel {
  margin-left: 24px;
  margin-bottom: 6px;
  padding: 10px 12px;
  background: var(--theme-bg-secondary);
  border: 1px solid var(--theme-primary);
  border-top: none;
  border-radius: 0 0 8px 8px;
  animation: panelSlideDown 0.2s ease;
}

@keyframes panelSlideDown {
  from { opacity: 0; max-height: 0; transform: translateY(-4px); }
  to { opacity: 1; max-height: 600px; transform: translateY(0); }
}

.wt-kanban-empty {
  text-align: center;
  padding: 16px 8px;
  font-size: 12px;
  color: var(--theme-text-tertiary);
  font-style: italic;
}
</style>
