<template>
  <div v-if="hasTeam" class="agent-list" :class="{ 'agent-embedded': embedded }">
    <div
      v-for="team in agentTeams"
      :key="teamKey(team)"
      class="agent-team"
      role="tree"
      :aria-label="`Agent team: ${getTeamLabel(team)}`"
    >
      <!-- Header -->
      <button
        class="team-header"
        @click="toggleCollapsed(teamKey(team))"
        :aria-expanded="!isCollapsed(teamKey(team))"
      >
        <div class="team-header-left">
          <svg
            class="chevron-icon"
            :class="{ 'chevron-open': !isCollapsed(teamKey(team)) }"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="team-name">{{ getTeamLabel(team) }}</span>
          <span v-if="team.teamName" class="team-badge">{{ team.teamName }}</span>
        </div>
        <div class="team-header-right">
          <button
            class="filter-pill"
            :class="{ 'filter-pill-active': !showStopped }"
            @click.stop="showStopped = !showStopped"
            :title="showStopped ? 'Show active only' : 'Show all'"
          >
            {{ showStopped ? 'All' : 'Active' }}
          </button>
          <span class="agent-count">{{ activeCount(team) }}<span class="count-sep">/</span>{{ getAgentCount(team) }}</span>
        </div>
      </button>

      <!-- Content -->
      <div v-show="!isCollapsed(teamKey(team))" class="team-content">
        <!-- Leader -->
        <div
          v-if="team.rootNode"
          class="agent-row agent-leader"
          :class="{ 'agent-selected': isTeamSelected(team) }"
          role="treeitem"
          aria-level="1"
          @click="handleTeamClick(team)"
        >
          <div class="agent-accent" :style="{ backgroundColor: getRootColor(team) }"></div>
          <div class="agent-body">
            <div class="agent-main-line">
              <span class="status-dot status-active" title="active"></span>
              <span class="agent-name">{{ getRootDisplayName(team) }}</span>
              <span class="agent-role">leader</span>
            </div>
            <div v-if="getRootThought(team) || (team.rootNode.messagesSent.length + team.rootNode.messagesReceived.length > 0)" class="agent-detail-line">
              <span v-if="team.rootNode.messagesSent.length + team.rootNode.messagesReceived.length > 0" class="detail-item">
                {{ team.rootNode.messagesSent.length + team.rootNode.messagesReceived.length }} messages
              </span>
              <span v-if="getRootThought(team)" class="detail-thought">{{ getRootThought(team) }}</span>
            </div>
          </div>
        </div>

        <!-- Children -->
        <template v-if="team.rootNode && filteredChildren(team).length > 0">
          <div
            v-for="(child, idx) in filteredChildren(team)"
            :key="child.agentId"
            class="agent-row agent-child"
            :class="{ 'agent-selected': isTeamSelected(team) }"
            role="treeitem"
            :aria-level="2"
            :aria-posinset="idx + 1"
            :aria-setsize="filteredChildren(team).length"
            @click="handleTeamClick(team)"
          >
            <div class="agent-accent" :style="{ backgroundColor: getChildColor(getDisplayName(child)) }"></div>
            <div class="agent-body">
              <div class="agent-main-line">
                <span class="status-dot" :class="statusClass(child.status)" :title="child.status"></span>
                <span class="agent-name">{{ getDisplayName(child) }}</span>
                <span v-if="child.subagentType" class="agent-role">{{ child.subagentType }}</span>
                <span v-if="child.model" class="agent-model">{{ formatModel(child.model) }}</span>
              </div>
              <div v-if="getThought(child) || childDuration(child) || childMessageCount(child) > 0" class="agent-detail-line">
                <span v-if="child.status === 'active' && !childDuration(child)" class="detail-item detail-running">running</span>
                <span v-if="childDuration(child)" class="detail-item">{{ childDuration(child) }}</span>
                <span v-if="childMessageCount(child) > 0" class="detail-item">{{ childMessageCount(child) }} msg</span>
                <span v-if="getThought(child)" class="detail-thought">{{ getThought(child) }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import type { HookEvent, AgentTeam, AgentTreeNode } from '../types';
import { useAgentTree } from '../composables/useAgentTree';
import { useEventColors } from '../composables/useEventColors';
import { generateFunnyName } from '../utils/funnyNames';

const getDisplayName = (node: AgentTreeNode): string => {
  if (node.name) return node.name;
  return generateFunnyName(node.agentId);
};

const props = withDefaults(defineProps<{
  events: HookEvent[];
  selectedAgentId: string | null;
  embedded?: boolean;
}>(), {
  embedded: false,
});

const emit = defineEmits<{
  selectAgent: [agentId: string];
}>();

const expandedMap = reactive<Record<string, boolean>>({});
const showStopped = ref(true);

const eventsRef = computed(() => props.events);
const { hasTeam, agentTeams } = useAgentTree(eventsRef);
const { getHexColorForApp } = useEventColors();

// --- Per-team helpers ---

const teamKey = (team: AgentTeam): string => `${team.sourceApp}:${team.parentSessionId}`;

const isCollapsed = (key: string): boolean => !expandedMap[key];
const toggleCollapsed = (key: string) => { expandedMap[key] = !expandedMap[key]; };

const getTeamLabel = (team: AgentTeam): string => {
  const short = team.sourceApp
    .replace(/^iago-server-wt-/, '')
    .replace(/^iago-wt-/, '')
    .replace(/-v\d+$/, '');
  return short || team.sourceApp;
};

const getRootDisplayName = (team: AgentTeam): string => {
  const app = team.sourceApp;
  const shortName = app
    .replace(/^iago-server-wt-/, '')
    .replace(/^iago-wt-/, '')
    .replace(/-v\d+$/, '');
  return `claude-code-${shortName}`;
};

const getAgentCount = (team: AgentTeam): number => {
  if (!team.rootNode) return 0;
  return 1 + team.rootNode.children.length;
};

const getSwimLaneId = (team: AgentTeam): string => {
  return `${team.sourceApp}:${team.parentSessionId.slice(0, 8)}`;
};

const getRootColor = (team: AgentTeam): string => getHexColorForApp(team.sourceApp);

const isTeamSelected = (team: AgentTeam): boolean => props.selectedAgentId === getSwimLaneId(team);

const handleTeamClick = (team: AgentTeam) => emit('selectAgent', getSwimLaneId(team));

const filteredChildren = (team: AgentTeam): AgentTreeNode[] => {
  if (!team.rootNode) return [];
  if (showStopped.value) return team.rootNode.children;
  return team.rootNode.children.filter(c => c.status !== 'stopped');
};

const activeCount = (team: AgentTeam): number => {
  if (!team.rootNode) return 0;
  return team.rootNode.children.filter(c => c.status === 'active' || c.status === 'idle').length + 1;
};

const getChildColor = (name: string) => getHexColorForApp(name);

const formatModel = (model: string): string => {
  const parts = model.split('-');
  if (parts.length >= 4 && parts[0] === 'claude') {
    return `${parts[1]}-${parts[2]}-${parts[3]}`;
  }
  return model;
};

const statusClass = (status: string) => {
  switch (status) {
    case 'active': return 'status-active';
    case 'idle': return 'status-idle';
    case 'stopped': return 'status-stopped';
    default: return 'status-unknown';
  }
};

const childDuration = (node: AgentTreeNode): string | null => {
  if (!node.startTimestamp || !node.stopTimestamp) return null;
  const ms = node.stopTimestamp - node.startTimestamp;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

const childMessageCount = (node: AgentTreeNode) => node.messagesSent.length + node.messagesReceived.length;

const thoughtsBySession = computed(() => {
  const thoughts = new Map<string, string>();
  for (let i = props.events.length - 1; i >= 0; i--) {
    const evt = props.events[i];
    if (!evt.summary) continue;
    const key = `${evt.source_app}:${evt.session_id}`;
    if (!thoughts.has(key)) {
      thoughts.set(key, evt.summary);
    }
  }
  return thoughts;
});

const getThought = (node: AgentTreeNode): string | undefined => {
  for (const [key, summary] of thoughtsBySession.value) {
    const [srcApp, sessId] = key.split(':');
    if (srcApp === node.sourceApp && sessId.startsWith(node.agentId)) {
      return summary;
    }
  }
  return undefined;
};

const getRootThought = (team: AgentTeam): string | undefined => {
  return thoughtsBySession.value.get(`${team.sourceApp}:${team.parentSessionId}`);
};
</script>

<style scoped>
/* ─── Container ─── */
.agent-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.agent-list.agent-embedded {
  gap: 0;
}

.agent-team {
  margin: 0 12px;
  border-radius: 8px;
  background: var(--theme-bg-secondary);
  border: 1px solid var(--theme-border-primary);
  overflow: hidden;
  animation: fadeIn 0.2s ease;
}
.agent-embedded .agent-team {
  margin: 0 0 6px 0;
  border-radius: 6px;
}
.agent-embedded .agent-team:last-child {
  margin-bottom: 0;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ─── Header ─── */
.team-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 12px;
  border: none;
  cursor: pointer;
  background: var(--theme-bg-tertiary);
  color: var(--theme-text-primary);
  user-select: none;
  transition: background 0.15s;
  border-bottom: 1px solid var(--theme-border-primary);
}
.team-header:hover {
  background: var(--theme-hover-bg, var(--theme-bg-quaternary));
}

.team-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.team-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.chevron-icon {
  width: 14px;
  height: 14px;
  color: var(--theme-text-tertiary);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}
.chevron-open {
  transform: rotate(90deg);
}

.team-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--theme-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.team-badge {
  font-size: 10px;
  font-weight: 500;
  color: var(--theme-text-tertiary);
  background: var(--theme-bg-quaternary);
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

.filter-pill {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid var(--theme-border-secondary);
  background: transparent;
  color: var(--theme-text-tertiary);
  cursor: pointer;
  transition: all 0.15s;
}
.filter-pill:hover {
  border-color: var(--theme-primary);
  color: var(--theme-primary);
}
.filter-pill-active {
  background: var(--theme-primary);
  border-color: var(--theme-primary);
  color: white;
}

.agent-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--theme-text-secondary);
  font-variant-numeric: tabular-nums;
}
.count-sep {
  opacity: 0.4;
  margin: 0 1px;
}

/* ─── Content area ─── */
.team-content {
  padding: 4px 0;
}

/* ─── Agent row (shared between leader + child) ─── */
.agent-row {
  display: flex;
  align-items: stretch;
  cursor: pointer;
  transition: background 0.12s;
  position: relative;
}
.agent-row:hover {
  background: var(--theme-hover-bg, var(--theme-bg-tertiary));
}
.agent-row.agent-selected {
  background: var(--theme-hover-bg, var(--theme-bg-tertiary));
}

/* Left color accent strip */
.agent-accent {
  width: 3px;
  flex-shrink: 0;
  border-radius: 0 2px 2px 0;
  margin: 4px 0;
  opacity: 0.7;
  transition: opacity 0.15s;
}
.agent-row:hover .agent-accent {
  opacity: 1;
}

/* Body content */
.agent-body {
  flex: 1;
  padding: 6px 12px 6px 10px;
  min-width: 0;
}

/* Leader row has slightly more emphasis */
.agent-leader .agent-body {
  padding: 8px 12px 8px 10px;
}

/* Child indentation */
.agent-child .agent-accent {
  margin-left: 16px;
}

/* ─── Main line: status dot + name + role + model ─── */
.agent-main-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.agent-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--theme-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.agent-leader .agent-name {
  font-size: 13px;
  font-weight: 700;
}

.agent-role {
  font-size: 10px;
  font-weight: 500;
  color: var(--theme-text-tertiary);
  background: var(--theme-bg-quaternary);
  padding: 0 5px;
  border-radius: 3px;
  white-space: nowrap;
  line-height: 16px;
  flex-shrink: 0;
}

.agent-model {
  font-size: 10px;
  font-weight: 500;
  color: var(--theme-text-quaternary, var(--theme-text-tertiary));
  font-family: ui-monospace, SFMono-Regular, monospace;
  white-space: nowrap;
  flex-shrink: 0;
  opacity: 0.7;
}

/* ─── Detail line: duration, messages, thought ─── */
.agent-detail-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
  min-width: 0;
}

.detail-item {
  font-size: 10px;
  color: var(--theme-text-tertiary);
  white-space: nowrap;
  flex-shrink: 0;
}

.detail-running {
  color: var(--theme-accent-success, #22c55e);
}

.detail-thought {
  font-size: 10px;
  color: var(--theme-text-tertiary);
  opacity: 0.7;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

/* ─── Status indicators ─── */
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-active {
  background: var(--theme-accent-success, #22c55e);
  box-shadow: 0 0 4px var(--theme-accent-success, #22c55e);
  animation: pulse 2.5s ease-in-out infinite;
}

.status-idle {
  background: var(--theme-accent-warning, #eab308);
  animation: breathe 3s ease-in-out infinite;
}

.status-stopped {
  background: var(--theme-text-tertiary, #6b7280);
  opacity: 0.5;
}

.status-unknown {
  background: var(--theme-text-tertiary, #6b7280);
  opacity: 0.3;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes breathe {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
</style>
