<!-- Alternative layout: slide-out side panel for agent/worktree/task monitoring.
     Not currently used in App.vue (tabs are shown inline instead), but kept as an
     alternative UI option that could be toggled via a settings preference. -->
<template>
  <Teleport to="body">
    <template v-if="isOpen">
      <!-- Overlay -->
      <div class="monitor-overlay" @click="$emit('close')"></div>

      <!-- Panel -->
      <div class="monitor-panel">
        <!-- Header -->
        <div class="panel-header">
          <span class="panel-title">Monitor</span>
          <button class="panel-close" @click="$emit('close')" aria-label="Close monitor panel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Tab Bar -->
        <div class="tab-bar" role="tablist">
          <button
            class="tab-btn"
            :class="{ 'tab-active': activeTab === 'agents' }"
            role="tab"
            :aria-selected="activeTab === 'agents'"
            @click="activeTab = 'agents'"
          >
            <span class="tab-icon">&#9673;</span>
            <span class="tab-label">Agents</span>
            <span v-if="agentCount > 0" class="tab-badge">{{ agentCount }}</span>
          </button>
          <button
            class="tab-btn"
            :class="{ 'tab-active': activeTab === 'worktrees' }"
            role="tab"
            :aria-selected="activeTab === 'worktrees'"
            @click="activeTab = 'worktrees'"
          >
            <span class="tab-icon">&#9707;</span>
            <span class="tab-label">Worktrees</span>
            <span v-if="worktreeCount > 0" class="tab-badge">{{ worktreeCount }}</span>
          </button>
          <button
            class="tab-btn"
            :class="{ 'tab-active': activeTab === 'kanban' }"
            role="tab"
            :aria-selected="activeTab === 'kanban'"
            @click="activeTab = 'kanban'"
          >
            <span class="tab-icon">&#9744;</span>
            <span class="tab-label">Tasks</span>
            <span v-if="taskCount > 0" class="tab-badge">{{ taskCount }}</span>
          </button>
          <button
            class="tab-btn"
            :class="{ 'tab-active': activeTab === 'history' }"
            role="tab"
            :aria-selected="activeTab === 'history'"
            @click="activeTab = 'history'"
          >
            <span class="tab-icon">&#9201;</span>
            <span class="tab-label">History</span>
          </button>
        </div>

        <!-- Body -->
        <div class="panel-body">
          <Transition name="tab-fade" mode="out-in">
            <div v-if="activeTab === 'agents'" key="agents">
              <AgentTreeView
                :events="events"
                :selected-agent-id="selectedAgentId"
                :embedded="true"
                @select-agent="$emit('selectAgent', $event)"
              />
              <div v-if="agentCount === 0" class="empty-state">
                No team agents detected yet.
              </div>
            </div>
            <div v-else-if="activeTab === 'worktrees'" key="worktrees">
              <WorktreeMonitorView
                :events="events"
                :current-source-app-filter="currentSourceAppFilter"
                :embedded="true"
                @filter-by-source-app="$emit('filterBySourceApp', $event)"
              />
              <div v-if="worktreeCount === 0" class="empty-state">
                No git worktrees detected yet.
              </div>
            </div>
            <div v-else-if="activeTab === 'kanban'" key="kanban">
              <TaskKanbanBoard
                :events="events"
                :embedded="true"
              />
            </div>
            <div v-else-if="activeTab === 'history'" key="history">
              <SessionHistoryView
                :embedded="true"
              />
            </div>
          </Transition>
        </div>
      </div>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { HookEvent } from '../types';
import { useAgentTree } from '../composables/useAgentTree';
import { useWorktreeMonitor } from '../composables/useWorktreeMonitor';
import { useTaskBoard } from '../composables/useTaskBoard';
import AgentTreeView from './AgentTreeView.vue';
import WorktreeMonitorView from './WorktreeMonitorView.vue';
import TaskKanbanBoard from './TaskKanbanBoard.vue';
import SessionHistoryView from './SessionHistoryView.vue';

const props = defineProps<{
  isOpen: boolean;
  events: HookEvent[];
  currentSourceAppFilter: string;
  selectedAgentId: string | null;
}>();

defineEmits<{
  close: [];
  selectAgent: [agentId: string];
  filterBySourceApp: [sourceApp: string];
}>();

const activeTab = ref<'agents' | 'worktrees' | 'kanban' | 'history'>('agents');

const eventsRef = computed(() => props.events);
const { agentTeams } = useAgentTree(eventsRef);
const { totalWorktreeCount } = useWorktreeMonitor(eventsRef);
const { taskCount: taskCountRef } = useTaskBoard(eventsRef);

const agentCount = computed(() => {
  let count = 0;
  for (const team of agentTeams.value) {
    if (team.rootNode) count += 1 + team.rootNode.children.length;
  }
  return count;
});

const worktreeCount = computed(() => totalWorktreeCount.value);
const taskCount = computed(() => taskCountRef.value);
</script>

<style scoped>
.monitor-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 40;
  animation: overlayIn 0.2s ease;
}

@keyframes overlayIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.monitor-panel {
  position: fixed;
  right: 0;
  top: 0;
  height: 100vh;
  width: 380px;
  max-width: 90vw;
  z-index: 40;
  display: flex;
  flex-direction: column;
  background: var(--theme-bg-primary);
  border-left: 1px solid var(--theme-border-primary);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.2);
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

/* ---- Header ---- */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: linear-gradient(135deg, var(--theme-primary), var(--theme-primary-dark));
  flex-shrink: 0;
}

.panel-title {
  font-size: 16px;
  font-weight: 800;
  color: white;
  letter-spacing: 0.3px;
}

.panel-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  cursor: pointer;
  transition: background 0.15s;
}
.panel-close:hover {
  background: rgba(255, 255, 255, 0.35);
}

/* ---- Tab Bar ---- */
.tab-bar {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  background: var(--theme-bg-secondary);
  border-bottom: 1px solid var(--theme-border-primary);
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 7px 4px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  background: var(--theme-bg-tertiary);
  color: var(--theme-text-secondary);
  transition: all 0.15s;
}
.tab-btn:hover:not(.tab-active) {
  background: var(--theme-bg-quaternary);
}

.tab-active {
  background: linear-gradient(135deg, var(--theme-primary), var(--theme-primary-light));
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.tab-icon {
  font-size: 14px;
  line-height: 1;
}

.tab-label {
  white-space: nowrap;
}

.tab-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 0 6px;
  border-radius: 999px;
  line-height: 18px;
  background: rgba(255, 255, 255, 0.25);
}
.tab-btn:not(.tab-active) .tab-badge {
  background: var(--theme-bg-quaternary);
  color: var(--theme-text-tertiary);
}

/* ---- Body ---- */
.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: var(--theme-text-tertiary);
  font-size: 13px;
  font-style: italic;
}

/* ---- Tab transition ---- */
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: opacity 0.15s ease;
}
.tab-fade-enter-from,
.tab-fade-leave-to {
  opacity: 0;
}
</style>
