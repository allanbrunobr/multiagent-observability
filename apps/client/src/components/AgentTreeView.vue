<template>
  <div v-if="hasTeam" class="tree-list" :class="{ 'tree-embedded': embedded }">
    <div
      v-for="team in agentTeams"
      :key="teamKey(team)"
      class="tree-container"
      role="tree"
      :aria-label="`Agent team: ${getTeamLabel(team)}`"
    >
      <!-- Header bar -->
      <div class="tree-header-row">
        <button class="tree-header" @click="toggleCollapsed(teamKey(team))" :aria-expanded="!isCollapsed(teamKey(team))">
          <div class="tree-header-left">
            <span class="header-icon">{{ isCollapsed(teamKey(team)) ? '&#9654;' : '&#9660;' }}</span>
            <span class="header-label">{{ getTeamLabel(team) }}</span>
            <span v-if="team.teamName" class="header-team-name">{{ team.teamName }}</span>
          </div>
          <span class="header-badge">{{ activeCount(team) }}/{{ getAgentCount(team) }}</span>
        </button>
        <button
          class="filter-toggle"
          :class="{ 'filter-active': !showStopped }"
          @click.stop="showStopped = !showStopped"
          :title="showStopped ? 'Hide stopped agents' : 'Show all agents'"
        >
          {{ showStopped ? 'All' : 'Active' }}
        </button>
      </div>

      <!-- Body -->
      <div v-show="!isCollapsed(teamKey(team))" class="tree-body">
        <!-- Root / Leader node -->
        <div v-if="team.rootNode" class="root-row" role="treeitem" aria-level="1">
          <div class="root-card" :class="{ 'root-selected': isTeamSelected(team) }" @click="handleTeamClick(team)">
            <div class="root-avatar" :style="{ background: getRootColor(team) }">C</div>
            <div class="root-info">
              <span class="root-name">{{ getRootDisplayName(team) }}</span>
              <span class="root-meta">{{ team.rootNode.messagesSent.length + team.rootNode.messagesReceived.length }} msg</span>
            </div>
            <span class="root-status status-active" title="active"></span>
          </div>
          <div v-if="getRootThought(team)" class="thought-bubble" :key="getRootThought(team)">
            {{ getRootThought(team) }}
          </div>
        </div>

        <!-- Children -->
        <div v-if="team.rootNode && filteredChildren(team).length > 0" class="children-list">
          <div
            v-for="(child, idx) in filteredChildren(team)"
            :key="child.agentId"
            class="child-row"
            role="treeitem"
            :aria-level="2"
            :aria-posinset="idx + 1"
            :aria-setsize="filteredChildren(team).length"
          >
            <!-- Connector -->
            <div class="child-connector">
              <div class="conn-vert" :class="{ 'conn-last': idx === filteredChildren(team).length - 1 }"></div>
              <div class="conn-horiz"></div>
            </div>

            <!-- Card -->
            <div class="child-card" :class="{ 'child-selected': isTeamSelected(team) }" @click="handleTeamClick(team)">
              <div class="child-avatar" :style="{ background: getChildColor(getDisplayName(child)) }">
                {{ avatarLetter(child) }}
              </div>
              <div class="child-info">
                <div class="child-top">
                  <span class="child-name">{{ getDisplayName(child) }}</span>
                  <span v-if="child.subagentType" class="tag tag-role">{{ child.subagentType }}</span>
                  <span v-if="child.model" class="tag tag-model">{{ formatModel(child.model) }}</span>
                </div>
                <div class="child-bottom">
                  <span v-if="childDuration(child)" class="child-meta">{{ childDuration(child) }}</span>
                  <span v-else-if="child.status === 'active'" class="child-meta child-running">running...</span>
                  <span v-if="childMessageCount(child) > 0" class="child-meta">{{ childMessageCount(child) }} msg</span>
                </div>
              </div>
              <span class="child-status" :class="statusClass(child.status)" :title="child.status"></span>
            </div>
            <div v-if="getThought(child)" class="thought-bubble child-thought" :key="getThought(child)">
              {{ getThought(child) }}
            </div>
          </div>
        </div>
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

const collapsedMap = reactive<Record<string, boolean>>({});
const showStopped = ref(true);

const eventsRef = computed(() => props.events);
const { hasTeam, agentTeams } = useAgentTree(eventsRef);
const { getHexColorForApp } = useEventColors();

// --- Per-team helpers ---

const teamKey = (team: AgentTeam): string => `${team.sourceApp}:${team.parentSessionId}`;

const isCollapsed = (key: string): boolean => !!collapsedMap[key];
const toggleCollapsed = (key: string) => { collapsedMap[key] = !collapsedMap[key]; };

const getTeamLabel = (team: AgentTeam): string => {
  // Always derive the primary label from the worktree/project (sourceApp)
  const short = team.sourceApp
    .replace(/^iago-server-wt-/, '')
    .replace(/^iago-wt-/, '')
    .replace(/-v\d+$/, '');
  return short || team.sourceApp;
};

const getRootDisplayName = (team: AgentTeam): string => {
  const app = team.sourceApp;
  // source_app examples: "iago-wt-receitapro-evaluator-v2", "iago-server-wt-hitl-full"
  // Extract meaningful part: remove common prefixes and version suffixes
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
  return team.rootNode.children.filter(c => c.status === 'active' || c.status === 'idle').length + 1; // +1 for root
};

const getChildColor = (name: string) => getHexColorForApp(name);

const avatarLetter = (node: AgentTreeNode) => {
  const label = getDisplayName(node);
  return label.charAt(0).toUpperCase();
};

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

// Thought bubbles: find the most recent summary per source_app:session_id
// Then map child agentId (short hash) to matching session summaries
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

// For child agents, agentId is a short prefix of the session_id.
// Match by finding any session whose session_id starts with agentId.
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
.tree-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tree-list.tree-embedded {
  gap: 0;
}

.tree-container {
  margin: 6px 12px;
  border-radius: 10px;
  background: var(--theme-bg-tertiary);
  border: 1px solid var(--theme-border-primary);
  overflow: hidden;
  animation: fadeSlide 0.25s ease;
}
.tree-embedded .tree-container {
  margin: 0 0 6px 0;
}
.tree-embedded .tree-container:last-child {
  margin-bottom: 0;
}

@keyframes fadeSlide {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ─── Header ─── */
.tree-header-row {
  display: flex;
  align-items: stretch;
  background: linear-gradient(135deg, var(--theme-primary), var(--theme-primary-dark));
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  padding: 7px 14px;
  border: none;
  cursor: pointer;
  background: transparent;
  color: white;
  user-select: none;
  transition: filter 0.15s;
}
.tree-header:hover { filter: brightness(1.1); }
.tree-header-left { display: flex; align-items: center; gap: 8px; }
.header-icon { font-size: 10px; opacity: 0.8; }
.header-label { font-size: 13px; font-weight: 700; letter-spacing: 0.3px; }
.header-team-name {
  font-size: 10px;
  font-weight: 600;
  background: rgba(255,255,255,0.15);
  padding: 1px 8px;
  border-radius: 4px;
  opacity: 0.8;
}

.header-badge {
  font-size: 11px; font-weight: 700;
  background: rgba(255,255,255,0.2);
  padding: 1px 10px;
  border-radius: 999px;
}

.filter-toggle {
  padding: 0 12px;
  border: none;
  border-left: 1px solid rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.8);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.filter-toggle:hover {
  background: rgba(255,255,255,0.2);
  color: white;
}
.filter-toggle.filter-active {
  background: rgba(255,255,255,0.25);
  color: white;
}

/* ─── Body ─── */
.tree-body { padding: 10px 14px 12px; }

/* ─── Root card ─── */
.root-row { margin-bottom: 4px; }

.root-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--theme-bg-quaternary);
  border: 1px solid var(--theme-border-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.root-card:hover {
  border-color: var(--theme-primary);
  box-shadow: 0 0 0 1px var(--theme-primary);
}
.root-selected {
  border-color: var(--theme-primary) !important;
  box-shadow: 0 0 0 2px var(--theme-primary) !important;
}

.root-avatar {
  width: 32px; height: 32px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 800; color: white;
  flex-shrink: 0;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

.root-info { flex: 1; display: flex; align-items: baseline; gap: 8px; }
.root-name { font-size: 13px; font-weight: 700; color: var(--theme-text-primary); }
.root-meta { font-size: 11px; color: var(--theme-text-tertiary); }

/* ─── Children ─── */
.children-list { padding-left: 16px; position: relative; }

.child-row {
  display: flex;
  align-items: stretch;
  position: relative;
  min-height: 48px;
}

/* ─── Connector lines ─── */
.child-connector {
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

/* ─── Child card ─── */
.child-card {
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
.child-card:hover {
  background: var(--theme-bg-quaternary);
  border-color: var(--theme-primary);
}
.child-selected {
  border-color: var(--theme-primary) !important;
}

.child-avatar {
  width: 28px; height: 28px;
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 800; color: white;
  flex-shrink: 0;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

.child-info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.child-top { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.child-bottom { display: flex; align-items: center; gap: 8px; }

.child-name {
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
.tag-role {
  background: var(--theme-primary);
  color: white;
  opacity: 0.85;
}
.tag-model {
  background: var(--theme-bg-quaternary);
  color: var(--theme-text-tertiary);
  border: 1px solid var(--theme-border-secondary);
  font-family: ui-monospace, monospace;
}

.child-meta {
  font-size: 10px;
  color: var(--theme-text-tertiary);
}
.child-running {
  color: var(--theme-accent-success, #22c55e);
  font-style: italic;
}

/* ─── Status indicators ─── */
.root-status, .child-status {
  width: 10px; height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-active {
  background: var(--theme-accent-success, #22c55e);
  box-shadow: 0 0 8px var(--theme-accent-success, #22c55e);
  animation: statusPulse 2s ease-in-out infinite;
}
.status-idle {
  background: var(--theme-accent-warning, #eab308);
  box-shadow: 0 0 4px var(--theme-accent-warning, #eab308);
  animation: statusBreathe 3s ease-in-out infinite;
}
.status-stopped {
  background: #6b7280;
}
.status-unknown {
  background: var(--theme-text-tertiary, #6b7280);
}

@keyframes statusPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.3); }
}

@keyframes statusBreathe {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* ─── Thought bubbles ─── */
.thought-bubble {
  font-size: 11px;
  font-style: italic;
  color: var(--theme-text-tertiary);
  padding: 3px 12px 2px;
  margin-top: -2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  animation: thoughtFadeIn 0.3s ease;
}
.child-thought {
  padding-left: 0;
  margin-left: 0;
}

@keyframes thoughtFadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
