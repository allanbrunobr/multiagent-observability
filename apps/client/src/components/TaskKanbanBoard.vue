<template>
  <div class="kanban-root" :class="{ 'kanban-embedded': embedded }">
    <template v-if="boards.length > 0">
      <!-- One board section per sourceApp/worktree -->
      <div
        v-for="b in boards"
        :key="b.sourceApp"
        class="board-section"
      >
        <!-- Board header: worktree name + task count + progress + view toggle -->
        <div class="board-header">
          <div class="board-header-left">
            <span class="board-dot" :style="{ background: appColor(b.sourceApp) }"></span>
            <span class="board-label">{{ formatAppName(b.sourceApp) }}</span>
            <span v-if="b.teamName" class="board-team-tag">{{ b.teamName }}</span>
          </div>
          <div class="board-header-right">
            <!-- View toggle: Kanban vs Graph -->
            <div class="view-toggle">
              <button
                class="view-toggle-btn"
                :class="{ active: viewMode !== 'graph' }"
                @click="viewMode = 'kanban'"
                title="Kanban view"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                </svg>
              </button>
              <button
                class="view-toggle-btn"
                :class="{ active: viewMode === 'graph' }"
                @click="viewMode = 'graph'"
                title="Dependency graph"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="5" cy="12" r="3" /><circle cx="19" cy="6" r="3" /><circle cx="19" cy="18" r="3" /><line x1="8" y1="11" x2="16" y2="7" /><line x1="8" y1="13" x2="16" y2="17" />
                </svg>
              </button>
            </div>
            <div class="board-progress">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: boardProgress(b) + '%' }"
                  :class="{ 'progress-complete': boardProgress(b) === 100 }"
                ></div>
              </div>
              <span class="progress-label">{{ boardProgress(b) }}%</span>
            </div>
            <span class="board-count">{{ b.totalTasks }} tasks</span>
          </div>
        </div>

        <!-- Dependency Graph View -->
        <TaskDependencyGraph
          v-if="viewMode === 'graph'"
          :tasks="allTasksForBoard(b)"
        />

        <!-- 3-column Kanban grid -->
        <div v-else class="kanban-columns">
          <div
            v-for="col in b.columns"
            :key="col.status"
            class="kanban-column"
            :class="`col-${col.status}`"
          >
            <!-- Column header -->
            <div class="col-header" :class="`col-header-${col.status}`">
              <div class="col-header-left">
                <span class="col-icon">{{ statusIcon(col.status) }}</span>
                <span class="col-label">{{ col.label }}</span>
              </div>
              <span class="col-count">{{ col.tasks.length }}</span>
            </div>

            <!-- Tasks list (scrollable) -->
            <div class="col-tasks">
              <div
                v-for="(task, idx) in col.tasks"
                :key="task.taskId"
                class="task-card"
                :class="[
                  `card-${task.status}`,
                  { 'card-active': task.status === 'in_progress' && task.activeForm },
                  { 'card-stale': isStale(task) },
                  { 'card-expanded': isExpanded(task.taskId) }
                ]"
                :style="{ animationDelay: `${idx * 40}ms` }"
                @click="toggleCard(task.taskId)"
              >
                <!-- Stale indicator -->
                <div v-if="isStale(task)" class="stale-banner">
                  <span class="stale-icon">&warning;</span>
                  <span>Possibly stale - no updates for 10+ min</span>
                </div>

                <!-- Card top: status indicator + subject -->
                <div class="task-top">
                  <span class="task-status-icon" :class="`icon-${task.status}`">
                    <span v-if="task.status === 'in_progress' && !isStale(task)" class="spinner"></span>
                    <span v-else-if="task.status === 'in_progress' && isStale(task)" class="stale-spinner">?</span>
                    <span v-else-if="task.status === 'completed'" class="check-icon">&check;</span>
                    <span v-else class="circle-icon"></span>
                  </span>
                  <span class="task-subject">{{ task.subject }}</span>
                  <span v-if="task.description" class="expand-indicator">{{ isExpanded(task.taskId) ? '\u25B2' : '\u25BC' }}</span>
                </div>

                <!-- Description: collapsed (2 lines) or expanded (full) -->
                <p v-if="task.description" class="task-description" :class="{ 'description-expanded': isExpanded(task.taskId) }">{{ task.description }}</p>

                <!-- Active form (what the agent is doing right now) -->
                <div v-if="task.status === 'in_progress' && task.activeForm" class="task-activity">
                  <span v-if="!isStale(task)" class="activity-pulse"></span>
                  <span class="activity-text">{{ task.activeForm }}</span>
                </div>

                <!-- Meta row: owner + duration -->
                <div class="task-meta">
                  <span v-if="task.owner" class="task-owner">
                    <span class="owner-avatar" :style="{ background: ownerColor(task.owner) }">{{ task.owner.charAt(0).toUpperCase() }}</span>
                    {{ task.owner }}
                  </span>
                  <span class="task-duration">{{ formatDuration(task) }}</span>
                </div>

                <!-- Dependency indicators -->
                <div v-if="task.blockedBy.length > 0 || task.blocks.length > 0" class="task-deps">
                  <span v-if="task.blockedBy.length > 0" class="dep-badge dep-blocked">
                    blocked by {{ task.blockedBy.length }}
                  </span>
                  <span v-if="task.blocks.length > 0" class="dep-badge dep-blocks">
                    blocks {{ task.blocks.length }}
                  </span>
                </div>
              </div>

              <!-- Empty column -->
              <div v-if="col.tasks.length === 0" class="col-empty">
                <span class="empty-icon">{{ emptyIcon(col.status) }}</span>
                <span class="empty-text">{{ emptyText(col.status) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="kanban-empty">
      <span class="empty-large-icon">&check;</span>
      <span>No tasks detected yet.</span>
      <span class="empty-hint">Tasks appear when agents use TaskCreate / TaskUpdate tools.</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import type { HookEvent, KanbanTask, KanbanBoard, TaskStatus } from '../types';
import { useTaskBoard } from '../composables/useTaskBoard';
import { useEventColors } from '../composables/useEventColors';
import TaskDependencyGraph from './TaskDependencyGraph.vue';

const props = defineProps<{
  events: HookEvent[];
  embedded?: boolean;
  sourceAppFilter?: string;
}>();

const eventsRef = computed(() => props.events);
const { boards: allBoards } = useTaskBoard(eventsRef);

const boards = computed(() => {
  if (!props.sourceAppFilter) return allBoards.value;
  return allBoards.value.filter(b => b.sourceApp === props.sourceAppFilter);
});
const { getHexColorForApp } = useEventColors();

// View mode: kanban or graph
const viewMode = ref<'kanban' | 'graph'>('kanban');

// Get all tasks for a board (across all columns)
function allTasksForBoard(board: KanbanBoard): KanbanTask[] {
  return board.columns.flatMap(col => col.tasks);
}

// Track expanded cards
const expandedCards = reactive(new Set<string>());

function toggleCard(taskId: string) {
  if (expandedCards.has(taskId)) {
    expandedCards.delete(taskId);
  } else {
    expandedCards.add(taskId);
  }
}

function isExpanded(taskId: string): boolean {
  return expandedCards.has(taskId);
}

// Progress bar
function boardProgress(b: KanbanBoard): number {
  if (b.totalTasks === 0) return 0;
  const completed = b.columns.find(c => c.status === 'completed')?.tasks.length ?? 0;
  return Math.round((completed / b.totalTasks) * 100);
}

// Stale detection: in_progress for more than 10 minutes without updates
function isStale(task: KanbanTask): boolean {
  if (task.status !== 'in_progress') return false;
  const now = Date.now();
  const elapsed = now - task.updatedAt;
  return elapsed > 10 * 60 * 1000; // 10 min
}

function appColor(sourceApp: string): string {
  return getHexColorForApp(sourceApp);
}

function formatAppName(sourceApp: string): string {
  return sourceApp
    .replace(/^iago-server-wt-/, '')
    .replace(/^iago-wt-/, '')
    .replace(/-v\d+$/, '') || sourceApp;
}

function ownerColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 65%, 55%)`;
}

function formatDuration(task: KanbanTask): string {
  const end = task.completedAt ?? task.updatedAt;
  const ms = end - task.createdAt;
  if (ms < 1000) return '<1s';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3600_000).toFixed(1)}h`;
}

function statusIcon(status: TaskStatus): string {
  switch (status) {
    case 'pending': return '\u25CF';
    case 'in_progress': return '\u25B6';
    case 'completed': return '\u2713';
    default: return '\u25CF';
  }
}

function emptyIcon(status: TaskStatus): string {
  switch (status) {
    case 'pending': return '\u2610';
    case 'in_progress': return '\u2699';
    case 'completed': return '\u2713';
    default: return '\u2610';
  }
}

function emptyText(status: TaskStatus): string {
  switch (status) {
    case 'pending': return 'No pending tasks';
    case 'in_progress': return 'Nothing in progress';
    case 'completed': return 'No completed tasks';
    default: return 'No tasks';
  }
}
</script>

<style scoped>
.kanban-root {
  width: 100%;
  padding: 12px;
}

.kanban-embedded {
  font-size: 12px;
  padding: 0;
}

/* ── Board section (one per worktree) ── */
.board-section {
  margin-bottom: 20px;
}
.board-section:last-child {
  margin-bottom: 0;
}

/* ── Board header ── */
.board-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 8px 14px;
  background: var(--theme-bg-tertiary);
  border-radius: 8px;
  border: 1px solid var(--theme-border-primary);
}

.board-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.board-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.board-label {
  font-weight: 700;
  font-size: 14px;
  color: var(--theme-text-primary);
}

.board-team-tag {
  font-size: 10px;
  font-weight: 600;
  color: var(--theme-text-tertiary);
  background: var(--theme-bg-quaternary);
  padding: 2px 8px;
  border-radius: 4px;
}

/* ── View toggle ── */
.view-toggle {
  display: flex;
  gap: 2px;
  background: var(--theme-bg-quaternary);
  border-radius: 6px;
  padding: 2px;
}

.view-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--theme-text-tertiary);
  cursor: pointer;
  transition: all 0.15s;
}

.view-toggle-btn:hover {
  color: var(--theme-text-primary);
  background: var(--theme-bg-tertiary);
}

.view-toggle-btn.active {
  color: var(--theme-primary);
  background: var(--theme-bg-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.board-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.board-progress {
  display: flex;
  align-items: center;
  gap: 6px;
}

.progress-bar {
  width: 80px;
  height: 6px;
  border-radius: 99px;
  background: var(--theme-bg-quaternary);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 99px;
  background: var(--theme-primary, #3b82f6);
  transition: width 0.4s ease;
  min-width: 0;
}

.progress-complete {
  background: var(--theme-accent-success, #10b981);
}

.progress-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--theme-text-secondary);
  font-family: ui-monospace, monospace;
  min-width: 32px;
  text-align: right;
}

.board-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--theme-text-tertiary);
  background: var(--theme-bg-quaternary);
  padding: 3px 10px;
  border-radius: 99px;
}

/* ── Columns layout ── */
.kanban-columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  overflow-x: auto;
}

/* ── Single column ── */
.kanban-column {
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  background: var(--theme-bg-tertiary);
  border: 1px solid var(--theme-border-primary);
  overflow: hidden;
}

/* Column top-border accent */
.col-pending { border-top: 3px solid var(--theme-accent-warning, #f59e0b); }
.col-in_progress { border-top: 3px solid var(--theme-primary, #3b82f6); }
.col-completed { border-top: 3px solid var(--theme-accent-success, #10b981); }

/* ── Column header ── */
.col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--theme-border-primary);
}

.col-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.col-icon {
  font-size: 12px;
  line-height: 1;
}

.col-header-pending .col-icon { color: var(--theme-accent-warning, #f59e0b); }
.col-header-in_progress .col-icon { color: var(--theme-primary, #3b82f6); }
.col-header-completed .col-icon { color: var(--theme-accent-success, #10b981); }

.col-label {
  font-weight: 700;
  font-size: 13px;
  color: var(--theme-text-primary);
}

.col-count {
  font-size: 11px;
  font-weight: 700;
  color: var(--theme-text-secondary);
  background: var(--theme-bg-quaternary);
  padding: 2px 8px;
  border-radius: 99px;
  min-width: 22px;
  text-align: center;
}

/* ── Tasks list (scrollable) ── */
.col-tasks {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  max-height: 520px;
  overflow-y: auto;
  min-height: 80px;
}

/* ── Task card ── */
.task-card {
  padding: 12px;
  border-radius: 8px;
  background: var(--theme-bg-primary);
  border: 1px solid var(--theme-border-secondary);
  transition: all 0.15s;
  animation: cardSlideIn 0.25s ease both;
  cursor: pointer;
  user-select: none;
}

@keyframes cardSlideIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.task-card:hover {
  border-color: var(--theme-primary);
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

/* Status-specific card styling */
.card-in_progress {
  border-left: 3px solid var(--theme-primary, #3b82f6);
}
.card-active {
  box-shadow: 0 0 0 1px var(--theme-primary), 0 2px 12px rgba(59,130,246,0.12);
}
.card-completed {
  opacity: 0.7;
}
.card-completed:hover {
  opacity: 0.9;
}

/* Stale task styling */
.card-stale {
  border-left: 3px solid var(--theme-accent-warning, #f59e0b);
  opacity: 0.8;
}
.card-stale .spinner {
  display: none;
}

.stale-banner {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 600;
  color: var(--theme-accent-warning, #f59e0b);
  background: rgba(245, 158, 11, 0.1);
  padding: 3px 8px;
  border-radius: 4px;
  margin-bottom: 6px;
}

.stale-icon {
  font-size: 12px;
}

.stale-spinner {
  font-size: 13px;
  font-weight: 800;
  color: var(--theme-accent-warning, #f59e0b);
  line-height: 1;
}

/* ── Card top (status icon + subject) ── */
.task-top {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 6px;
}

.task-status-icon {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
}

/* Spinner for in_progress */
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--theme-border-secondary);
  border-top-color: var(--theme-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Check icon for completed */
.check-icon {
  font-size: 14px;
  font-weight: 700;
  color: var(--theme-accent-success, #10b981);
  line-height: 1;
}

/* Circle for pending */
.circle-icon {
  width: 12px;
  height: 12px;
  border: 2px solid var(--theme-text-tertiary);
  border-radius: 50%;
}

.task-subject {
  font-weight: 600;
  font-size: 13px;
  color: var(--theme-text-primary);
  line-height: 1.4;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.expand-indicator {
  font-size: 9px;
  color: var(--theme-text-tertiary);
  flex-shrink: 0;
  margin-left: auto;
  transition: transform 0.2s;
}

/* ── Description ── */
.task-description {
  font-size: 11px;
  color: var(--theme-text-tertiary);
  line-height: 1.5;
  margin: 0 0 6px 26px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  transition: all 0.2s ease;
}

.description-expanded {
  -webkit-line-clamp: unset;
  display: block;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ── Active form (what agent is doing) ── */
.task-activity {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 6px 0;
  padding: 6px 10px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--theme-primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--theme-primary) 20%, transparent);
}

.activity-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--theme-primary, #3b82f6);
  flex-shrink: 0;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.75); }
}

.activity-text {
  font-size: 11px;
  font-weight: 600;
  color: var(--theme-primary);
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Meta row ── */
.task-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.task-owner {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: var(--theme-text-secondary);
  background: var(--theme-bg-tertiary);
  padding: 2px 8px 2px 2px;
  border-radius: 99px;
}

.owner-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 800;
  color: white;
  flex-shrink: 0;
  text-shadow: 0 1px 1px rgba(0,0,0,0.2);
}

.task-duration {
  font-size: 10px;
  color: var(--theme-text-tertiary);
  margin-left: auto;
  font-family: ui-monospace, monospace;
}

/* ── Dependencies ── */
.task-deps {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}

.dep-badge {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 600;
}

.dep-blocked {
  background: rgba(239, 68, 68, 0.12);
  color: var(--theme-accent-error, #ef4444);
}

.dep-blocks {
  background: rgba(245, 158, 11, 0.12);
  color: var(--theme-accent-warning, #f59e0b);
}

/* ── Empty state ── */
.col-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 28px 12px;
  color: var(--theme-text-tertiary);
}

.empty-icon {
  font-size: 20px;
  opacity: 0.5;
}

.empty-text {
  font-size: 12px;
  font-style: italic;
}

/* ── Global empty state ── */
.kanban-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 48px 16px;
  color: var(--theme-text-tertiary);
  font-size: 14px;
}

.empty-large-icon {
  font-size: 32px;
  opacity: 0.4;
}

.empty-hint {
  font-size: 12px;
  opacity: 0.7;
}

/* ── Responsive: stack columns on narrow viewport ── */
@media (max-width: 640px) {
  .kanban-columns {
    grid-template-columns: 1fr;
  }
  .col-tasks {
    max-height: 300px;
  }
}
</style>
