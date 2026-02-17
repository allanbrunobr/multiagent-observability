<template>
  <div class="h-screen flex flex-col bg-[var(--theme-bg-secondary)]">
    <!-- Header with Primary Theme Colors -->
    <header class="short:hidden bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary-light)] shadow-lg border-b-2 border-[var(--theme-primary-dark)]">
      <div class="px-3 py-4 mobile:py-1.5 mobile:px-2 flex items-center justify-between mobile:gap-2">
        <!-- Title Section - Hidden on mobile -->
        <div class="mobile:hidden">
          <h1 class="text-2xl font-bold text-white drop-shadow-lg">
            Multi-Agent Observability
          </h1>
        </div>

        <!-- Connection Status -->
        <div class="flex items-center mobile:space-x-1 space-x-1.5">
          <div v-if="isConnected" class="flex items-center mobile:space-x-0.5 space-x-1.5">
            <span class="relative flex mobile:h-2 mobile:w-2 h-3 w-3">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full mobile:h-2 mobile:w-2 h-3 w-3 bg-green-500"></span>
            </span>
            <span class="text-base mobile:text-xs text-white font-semibold drop-shadow-md mobile:hidden">Connected</span>
          </div>
          <div v-else class="flex items-center mobile:space-x-0.5 space-x-1.5">
            <span class="relative flex mobile:h-2 mobile:w-2 h-3 w-3">
              <span class="relative inline-flex rounded-full mobile:h-2 mobile:w-2 h-3 w-3 bg-red-500"></span>
            </span>
            <span class="text-base mobile:text-xs text-white font-semibold drop-shadow-md mobile:hidden">Disconnected</span>
          </div>
        </div>

        <!-- Event Count and Action Buttons -->
        <div class="flex items-center mobile:space-x-1 space-x-2">
          <span class="text-base mobile:text-xs text-white font-semibold drop-shadow-md bg-[var(--theme-primary-dark)] mobile:px-2 mobile:py-0.5 px-3 py-1.5 rounded-full border border-white/30">
            {{ events.length }}
          </span>

          <!-- Clear Button -->
          <button
            @click="handleClearClick"
            class="p-3 mobile:p-1 rounded-lg bg-white/20 hover:bg-white/30 transition-all duration-200 border border-white/30 hover:border-white/50 backdrop-blur-sm shadow-lg hover:shadow-xl"
            title="Clear events"
          >
            <span class="text-2xl mobile:text-base">🗑️</span>
          </button>

          <!-- Filters Toggle Button (only visible on Live tab) -->
          <button
            v-if="activeTab === 'live'"
            @click="showFilters = !showFilters"
            class="p-3 mobile:p-1 rounded-lg bg-white/20 hover:bg-white/30 transition-all duration-200 border border-white/30 hover:border-white/50 backdrop-blur-sm shadow-lg hover:shadow-xl"
            :title="showFilters ? 'Hide filters' : 'Show filters'"
          >
            <span class="text-2xl mobile:text-base">📊</span>
          </button>

          <!-- Sound Toggle Button -->
          <button
            @click="toggleMute"
            class="p-3 mobile:p-1 rounded-lg bg-white/20 hover:bg-white/30 transition-all duration-200 border border-white/30 hover:border-white/50 backdrop-blur-sm shadow-lg hover:shadow-xl"
            :title="isMuted ? 'Unmute sound notifications' : 'Mute sound notifications'"
          >
            <span class="text-2xl mobile:text-base">{{ isMuted ? '🔇' : '🔊' }}</span>
          </button>

          <!-- Theme Manager Button -->
          <button
            @click="handleThemeManagerClick"
            class="p-3 mobile:p-1 rounded-lg bg-white/20 hover:bg-white/30 transition-all duration-200 border border-white/30 hover:border-white/50 backdrop-blur-sm shadow-lg hover:shadow-xl"
            title="Open theme manager"
          >
            <span class="text-2xl mobile:text-base">🎨</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Summary Stats Bar -->
    <SummaryStatsBar :events="events" :server-stats="stats" />

    <!-- Main Tab Bar -->
    <div class="main-tab-bar" role="tablist">
      <button
        :class="{ active: activeTab === 'agents' }"
        role="tab"
        :aria-selected="activeTab === 'agents'"
        @click="activeTab = 'agents'"
      >
        Agents <span v-if="agentCount > 0" class="tab-badge">{{ agentCount }}</span>
      </button>
      <button
        :class="{ active: activeTab === 'worktrees' }"
        role="tab"
        :aria-selected="activeTab === 'worktrees'"
        @click="activeTab = 'worktrees'"
      >
        Worktrees <span v-if="worktreeCount > 0" class="tab-badge">{{ worktreeCount }}</span>
      </button>
      <button
        :class="{ active: activeTab === 'tasks' }"
        role="tab"
        :aria-selected="activeTab === 'tasks'"
        @click="activeTab = 'tasks'"
      >
        Tasks <span v-if="taskCount > 0" class="tab-badge">{{ taskCount }}</span>
      </button>
      <button
        :class="{ active: activeTab === 'live' }"
        role="tab"
        :aria-selected="activeTab === 'live'"
        @click="activeTab = 'live'"
      >
        Live <span class="tab-badge">{{ events.length }}</span>
      </button>
      <button
        :class="{ active: activeTab === 'history' }"
        role="tab"
        :aria-selected="activeTab === 'history'"
        @click="activeTab = 'history'"
      >
        History
      </button>
      <div class="tab-bar-spacer"></div>
      <button
        v-if="activeTab === 'live'"
        class="level-toggle"
        :class="{ 'level-smart': notificationLevel === 'SMART' }"
        @click="toggleNotificationLevel"
        :title="notificationLevel === 'ALL' ? 'Switch to SMART mode (show only important events)' : 'Switch to ALL mode (show all events)'"
      >
        {{ notificationLevel }}
      </button>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      <!-- Agents Tab -->
      <AgentTreeView
        v-if="activeTab === 'agents'"
        :events="events"
        :selected-agent-id="selectedAgentLanes[0] ?? null"
        @select-agent="toggleAgentLane($event)"
      />

      <!-- Worktrees Tab -->
      <WorktreeMonitorView
        v-if="activeTab === 'worktrees'"
        :events="events"
        :current-source-app-filter="filters.sourceApp"
        @filter-by-source-app="handleWorktreeFilter($event)"
      />

      <!-- Tasks Tab -->
      <TaskKanbanBoard
        v-if="activeTab === 'tasks'"
        :events="events"
      />

      <!-- Live Tab (original main content) -->
      <template v-if="activeTab === 'live'">
        <!-- Filters -->
        <FilterPanel
          v-if="showFilters"
          class="short:hidden"
          :filters="filters"
          @update:filters="filters = $event"
        />

        <!-- Live Pulse Chart -->
        <LivePulseChart
          :events="events"
          :filters="filters"
          @update-unique-apps="uniqueAppNames = $event"
          @update-all-apps="allAppNames = $event"
          @update-time-range="currentTimeRange = $event"
        />

        <!-- Agent Activity Heatmap -->
        <AgentActivityHeatmap
          v-if="events.length > 0"
          :events="events"
        />

        <!-- Agent Swim Lane Container -->
        <div v-if="selectedAgentLanes.length > 0" class="w-full bg-[var(--theme-bg-secondary)] px-3 py-4 mobile:px-2 mobile:py-2 overflow-hidden">
          <AgentSwimLaneContainer
            :selected-agents="selectedAgentLanes"
            :events="events"
            :time-range="currentTimeRange"
            @update:selected-agents="selectedAgentLanes = $event"
          />
        </div>

        <!-- Timeline -->
        <div class="flex flex-col flex-1 overflow-hidden">
          <EventTimeline
            :events="smartFilteredEvents"
            :filters="filters"
            :unique-app-names="uniqueAppNames"
            :all-app-names="allAppNames"
            v-model:stick-to-bottom="stickToBottom"
            @select-agent="toggleAgentLane"
          />
        </div>

        <!-- Stick to bottom button -->
        <StickScrollButton
          class="short:hidden"
          :stick-to-bottom="stickToBottom"
          @toggle="stickToBottom = !stickToBottom"
        />
      </template>

      <!-- History Tab -->
      <SessionHistoryView v-if="activeTab === 'history'" @load-session="handleLoadSession" />
    </div>

    <!-- Error message -->
    <div
      v-if="error"
      class="fixed bottom-4 left-4 mobile:bottom-3 mobile:left-3 mobile:right-3 bg-red-100 border border-red-400 text-red-700 px-3 py-2 mobile:px-2 mobile:py-1.5 rounded mobile:text-xs"
    >
      {{ error }}
    </div>

    <!-- Theme Manager -->
    <ThemeManager
      :is-open="showThemeManager"
      @close="showThemeManager = false"
    />

    <!-- Toast Notifications -->
    <ToastNotification
      v-for="(toast, index) in toasts"
      :key="toast.id"
      :index="index"
      :agent-name="toast.agentName"
      :agent-color="toast.agentColor"
      @dismiss="dismissToast(toast.id)"
    />

    <!-- Keyboard Shortcuts Help Overlay -->
    <KeyboardShortcutsHelp
      :is-open="showShortcutsHelp"
      @close="showShortcutsHelp = false"
    />

    <!-- Floating keyboard shortcuts hint -->
    <button
      class="shortcuts-hint"
      @click="showShortcutsHelp = true"
      title="Keyboard shortcuts (?)"
    >?</button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { TimeRange } from './types';
import { useWebSocket } from './composables/useWebSocket';
import { useThemes } from './composables/useThemes';
import { useEventColors } from './composables/useEventColors';
import EventTimeline from './components/EventTimeline.vue';
import FilterPanel from './components/FilterPanel.vue';
import StickScrollButton from './components/StickScrollButton.vue';
import LivePulseChart from './components/LivePulseChart.vue';
import ThemeManager from './components/ThemeManager.vue';
import ToastNotification from './components/ToastNotification.vue';
import AgentSwimLaneContainer from './components/AgentSwimLaneContainer.vue';
import AgentTreeView from './components/AgentTreeView.vue';
import WorktreeMonitorView from './components/WorktreeMonitorView.vue';
import TaskKanbanBoard from './components/TaskKanbanBoard.vue';
import SessionHistoryView from './components/SessionHistoryView.vue';
import SummaryStatsBar from './components/SummaryStatsBar.vue';
import AgentActivityHeatmap from './components/AgentActivityHeatmap.vue';
import { clearAgentTreeState, useAgentTree } from './composables/useAgentTree';
import { clearWorktreeState, useWorktreeMonitor } from './composables/useWorktreeMonitor';
import { clearTaskBoardState, useTaskBoard } from './composables/useTaskBoard';
import { useHITLNotifications } from './composables/useHITLNotifications';
import { useKeyboardShortcuts } from './composables/useKeyboardShortcuts';
import { useSoundNotifications } from './composables/useSoundNotifications';
import { useNotificationLevel } from './composables/useNotificationLevel';
import KeyboardShortcutsHelp from './components/KeyboardShortcutsHelp.vue';
import { WS_URL } from './config';

// WebSocket connection
const { events, isConnected, error, stats, clearEvents } = useWebSocket(WS_URL);

// Theme management (sets up theme system)
useThemes();

// Event colors
const { getHexColorForApp } = useEventColors();

// HITL browser notifications
const { requestPermission, notifyHITLRequest } = useHITLNotifications();
requestPermission();

// Watch for HITL events and trigger browser notifications
watch(events, (evts) => {
  if (evts.length === 0) return;
  const latest = evts[evts.length - 1];
  if (latest.humanInTheLoop) {
    notifyHITLRequest(latest);
  }
}, { deep: false });

// Sound notifications (muted by default)
const { isMuted, toggleMute } = useSoundNotifications(events);

// Smart notification level (ALL vs SMART filtering)
const { level: notificationLevel, toggleLevel: toggleNotificationLevel, filteredEvents: smartFilteredEvents } = useNotificationLevel(events);

// Tab state
const activeTab = ref<'agents' | 'worktrees' | 'tasks' | 'live' | 'history'>('live');

// Tab badge data from composables
const { agentTeams } = useAgentTree(events);
const { totalWorktreeCount } = useWorktreeMonitor(events);
const { taskCount: taskCountRef } = useTaskBoard(events);

const agentCount = computed(() => {
  let count = 0;
  for (const team of agentTeams.value) {
    if (team.rootNode) count += 1 + team.rootNode.children.length;
  }
  return count;
});
const worktreeCount = computed(() => totalWorktreeCount.value);
const taskCount = computed(() => taskCountRef.value);

// Filters
const filters = ref({
  sourceApp: '',
  sessionId: '',
  eventType: ''
});

// UI state
const stickToBottom = ref(true);
const showThemeManager = ref(false);
const showFilters = ref(false);
const showShortcutsHelp = ref(false);
const uniqueAppNames = ref<string[]>([]); // Apps active in current time window
const allAppNames = ref<string[]>([]); // All apps ever seen in session
const selectedAgentLanes = ref<string[]>([]);
const currentTimeRange = ref<TimeRange>('1m'); // Current time range from LivePulseChart

// Keyboard shortcuts
useKeyboardShortcuts({
  activeTab,
  showFilters,
  showHelp: showShortcutsHelp,
  showThemeManager,
});

// Toast notifications
interface Toast {
  id: number;
  agentName: string;
  agentColor: string;
}
const toasts = ref<Toast[]>([]);
let toastIdCounter = 0;
const seenAgents = new Set<string>();

// Watch for new agents and show toast
watch(uniqueAppNames, (newAppNames) => {
  // Find agents that are new (not in seenAgents set)
  newAppNames.forEach(appName => {
    if (!seenAgents.has(appName)) {
      seenAgents.add(appName);
      // Show toast for new agent
      const toast: Toast = {
        id: toastIdCounter++,
        agentName: appName,
        agentColor: getHexColorForApp(appName)
      };
      toasts.value.push(toast);
    }
  });
}, { deep: true });

const dismissToast = (id: number) => {
  const index = toasts.value.findIndex(t => t.id === id);
  if (index !== -1) {
    toasts.value.splice(index, 1);
  }
};

// Handle agent tag clicks for swim lanes
const toggleAgentLane = (agentName: string) => {
  const index = selectedAgentLanes.value.indexOf(agentName);
  if (index >= 0) {
    // Remove from comparison
    selectedAgentLanes.value.splice(index, 1);
  } else {
    // Add to comparison
    selectedAgentLanes.value.push(agentName);
  }
};

// Handle worktree filter clicks (toggle sourceApp filter)
const handleWorktreeFilter = (sourceApp: string) => {
  if (filters.value.sourceApp === sourceApp) {
    filters.value.sourceApp = '';
  } else {
    filters.value.sourceApp = sourceApp;
  }
};

// Handle clear button click
const handleClearClick = () => {
  clearEvents();
  clearAgentTreeState();
  clearWorktreeState();
  clearTaskBoardState();
  selectedAgentLanes.value = [];
};

// Handle session history drill-down: switch to Live tab with session filter
const handleLoadSession = (sessionId: string) => {
  filters.value.sessionId = sessionId;
  activeTab.value = 'live';
  showFilters.value = true;
};

// Debug handler for theme manager
const handleThemeManagerClick = () => {
  console.log('Theme manager button clicked!');
  showThemeManager.value = true;
};
</script>

<style scoped>
/* ---- Main Tab Bar ---- */
.main-tab-bar {
  display: flex;
  gap: 0;
  background: var(--theme-bg-secondary);
  border-bottom: 1px solid var(--theme-border-primary);
  padding: 0 16px;
  overflow-x: auto;
  flex-shrink: 0;
}

.main-tab-bar button {
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: var(--theme-text-secondary);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}

.main-tab-bar button:hover {
  color: var(--theme-text-primary);
  background: var(--theme-bg-tertiary);
}

.main-tab-bar button.active {
  color: var(--theme-primary);
  border-bottom-color: var(--theme-primary);
}

.tab-badge {
  font-size: 10px;
  font-weight: 700;
  background: var(--theme-primary);
  color: white;
  padding: 1px 7px;
  border-radius: 99px;
}

.tab-bar-spacer {
  flex: 1;
}

.level-toggle {
  padding: 4px 10px;
  margin: 6px 0;
  border: 1px solid var(--theme-border-secondary);
  border-radius: 6px;
  background: var(--theme-bg-tertiary);
  color: var(--theme-text-tertiary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  align-self: center;
}
.level-toggle:hover {
  background: var(--theme-bg-quaternary);
  color: var(--theme-text-primary);
}
.level-smart {
  background: var(--theme-primary);
  color: white;
  border-color: var(--theme-primary);
}
.level-smart:hover {
  filter: brightness(1.1);
  background: var(--theme-primary);
  color: white;
}

/* ---- Tab Content ---- */
.tab-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* ---- Floating shortcuts hint ---- */
.shortcuts-hint {
  position: fixed;
  bottom: 16px;
  right: 16px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid var(--theme-border-secondary);
  background: var(--theme-bg-tertiary);
  color: var(--theme-text-tertiary);
  font-size: 14px;
  font-weight: 700;
  font-family: ui-monospace, monospace;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
  transition: opacity 0.15s, background 0.15s;
  z-index: 30;
}
.shortcuts-hint:hover {
  opacity: 1;
  background: var(--theme-bg-quaternary);
  color: var(--theme-text-primary);
}
</style>
