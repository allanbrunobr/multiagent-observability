import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';
import type { HookEvent, AgentTeam, AgentTreeNode, AgentMessage, AgentStatus } from '../types';
import { API_BASE_URL } from '../config';

// Persistent store for relationship events that survives the 300-event buffer rotation.
const persistentSubagentStarts = new Map<string, { agentId: string; agentType: string; parentSessionId: string; sourceApp: string; timestamp: number }>();
const persistentSubagentStops = new Map<string, { agentId: string; agentType: string; timestamp: number }>();
const persistentTaskLaunches = new Map<string, { name: string; subagentType: string; description: string; teamName: string | null; model: string | null; parentSessionId: string; timestamp: number }>();
const persistentTeamCreates = new Map<string, { teamName: string; parentSessionId: string; timestamp: number }>();
const persistentMessages: AgentMessage[] = [];
const seenMessageIds = new Set<string>();

// Tracks every unique session (sourceApp:sessionId) from ANY event, not just SubagentStart.
// This allows the tree to render a root node even for solo (non-multi-agent) sessions.
const persistentSessions = new Map<string, {
  parentSessionId: string;
  sourceApp: string;
  firstTimestamp: number;
}>();

// Whether we've loaded historical agent-relationship events from the server
let historicalAgentEventsLoaded = false;

// Max timestamp gap to match PreToolUse:Task -> SubagentStart (data shows ~400ms)
const TASK_TO_START_MAX_GAP_MS = 2000;

/** Clear all persistent state. Call when the user clicks "Clear events". */
export function clearAgentTreeState() {
  persistentSubagentStarts.clear();
  persistentSubagentStops.clear();
  persistentTaskLaunches.clear();
  persistentTeamCreates.clear();
  persistentMessages.length = 0;
  seenMessageIds.clear();
  persistentSessions.clear();
  historicalAgentEventsLoaded = false;
}

/**
 * Fetch ALL agent-relationship events from the server (not limited by the 300-event buffer).
 * This ensures SubagentStart, SubagentStop, Task launches, and TeamCreate events
 * are always available for building the full agent tree.
 */
async function loadHistoricalAgentEvents(): Promise<HookEvent[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/events/agents`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function extractRelationshipEvents(events: HookEvent[]) {
  for (const event of events) {
    const ts = event.timestamp ?? 0;
    const sessionId = event.session_id;
    const sourceApp = event.source_app;

    // Register every unique session so the tree shows a root node even without sub-agents
    const sessionKey = `${sourceApp}:${sessionId}`;
    if (!persistentSessions.has(sessionKey)) {
      persistentSessions.set(sessionKey, {
        parentSessionId: sessionId,
        sourceApp,
        firstTimestamp: ts,
      });
    }

    if (event.hook_event_type === 'SubagentStart') {
      const agentId = event.payload?.agent_id;
      if (agentId && !persistentSubagentStarts.has(agentId)) {
        persistentSubagentStarts.set(agentId, {
          agentId,
          agentType: event.payload?.agent_type ?? '',
          parentSessionId: sessionId,
          sourceApp,
          timestamp: ts,
        });
      }
    }

    if (event.hook_event_type === 'SubagentStop') {
      const agentId = event.payload?.agent_id;
      if (agentId && !persistentSubagentStops.has(agentId)) {
        persistentSubagentStops.set(agentId, {
          agentId,
          agentType: event.payload?.agent_type ?? '',
          timestamp: ts,
        });
      }
    }

    if (event.hook_event_type === 'PreToolUse' && event.payload?.tool_name === 'Task') {
      const toolInput = event.payload?.tool_input;
      if (toolInput?.name) {
        const key = `${sessionId}:${ts}:${toolInput.name}`;
        if (!persistentTaskLaunches.has(key)) {
          persistentTaskLaunches.set(key, {
            name: toolInput.name,
            subagentType: toolInput.subagent_type ?? null,
            description: toolInput.description ?? null,
            teamName: toolInput.team_name ?? null,
            model: toolInput.model ?? null,
            parentSessionId: sessionId,
            timestamp: ts,
          });
        }
      }
    }

    if (event.hook_event_type === 'PreToolUse' && event.payload?.tool_name === 'TeamCreate') {
      const teamName = event.payload?.tool_input?.team_name;
      if (teamName) {
        const key = `${sessionId}:${teamName}`;
        if (!persistentTeamCreates.has(key)) {
          persistentTeamCreates.set(key, { teamName, parentSessionId: sessionId, timestamp: ts });
        }
      }
    }

    if (event.hook_event_type === 'PreToolUse' && event.payload?.tool_name === 'SendMessage') {
      const toolInput = event.payload?.tool_input;
      if (toolInput) {
        const msgKey = `${sessionId}:${ts}:${toolInput.recipient ?? ''}:${toolInput.type ?? ''}`;
        if (!seenMessageIds.has(msgKey)) {
          seenMessageIds.add(msgKey);
          persistentMessages.push({
            fromName: toolInput.recipient === 'claude-code' ? (toolInput._senderName ?? 'subagent') : 'claude-code',
            toName: toolInput.recipient ?? 'unknown',
            summary: toolInput.summary ?? null,
            content: null,
            timestamp: ts,
            type: toolInput.type ?? 'message',
          });
        }
      }
    }
  }
}

function matchTaskToStart(
  taskLaunch: { name: string; subagentType: string; timestamp: number; parentSessionId: string },
  starts: Map<string, { agentId: string; agentType: string; parentSessionId: string; timestamp: number }>,
  alreadyMatched: Set<string>
): string | null {
  let bestMatch: string | null = null;
  let bestGap = Infinity;

  for (const [agentId, start] of starts) {
    if (alreadyMatched.has(agentId)) continue;
    if (start.parentSessionId !== taskLaunch.parentSessionId) continue;
    const gap = start.timestamp - taskLaunch.timestamp;
    if (gap >= -200 && gap <= TASK_TO_START_MAX_GAP_MS && gap < bestGap) {
      // Prefer matching by agent_type or name
      const typeMatch = start.agentType && taskLaunch.subagentType &&
        start.agentType === taskLaunch.subagentType;
      const nameMatch = start.agentType && start.agentType === taskLaunch.name;
      if (typeMatch || nameMatch || !start.agentType) {
        bestMatch = agentId;
        bestGap = gap;
      }
    }
  }

  // Fallback: pure timestamp proximity
  if (!bestMatch) {
    for (const [agentId, start] of starts) {
      if (alreadyMatched.has(agentId)) continue;
      if (start.parentSessionId !== taskLaunch.parentSessionId) continue;
      const gap = start.timestamp - taskLaunch.timestamp;
      if (gap >= -200 && gap <= TASK_TO_START_MAX_GAP_MS && gap < bestGap) {
        bestMatch = agentId;
        bestGap = gap;
      }
    }
  }

  return bestMatch;
}

function countNodesRecursive(node: AgentTreeNode): number {
  let count = 1;
  for (const child of node.children) {
    count += countNodesRecursive(child);
  }
  return count;
}

function buildTree(): AgentTeam[] {
  const teams: AgentTeam[] = [];

  // Collect all known sub-agent session IDs.
  // SubagentStart's agentId === the sub-agent's own session_id in its events.
  const knownSubagentIds = new Set<string>();
  for (const start of persistentSubagentStarts.values()) {
    knownSubagentIds.add(start.agentId);
  }

  // Group root sessions by sourceApp — multiple sessions from the same project
  // are merged into a single tree to avoid duplicates.
  // Sub-agent sessions (whose sessionId is a known agentId) are excluded.
  const appGroups = new Map<string, string[]>(); // sourceApp -> root sessionIds[]
  for (const { parentSessionId, sourceApp } of persistentSessions.values()) {
    if (knownSubagentIds.has(parentSessionId)) continue;
    if (!appGroups.has(sourceApp)) {
      appGroups.set(sourceApp, []);
    }
    const ids = appGroups.get(sourceApp)!;
    if (!ids.includes(parentSessionId)) {
      ids.push(parentSessionId);
    }
  }

  for (const [sourceApp, sessionIds] of appGroups) {
    const sessionIdSet = new Set(sessionIds);

    // Find team name from any session in this group
    let teamName: string | null = null;
    for (const tc of persistentTeamCreates.values()) {
      if (sessionIdSet.has(tc.parentSessionId)) {
        teamName = tc.teamName;
        break;
      }
    }

    // Sort task launches from ALL sessions by timestamp for stable matching
    const taskLaunches = [...persistentTaskLaunches.values()]
      .filter(t => sessionIdSet.has(t.parentSessionId))
      .sort((a, b) => a.timestamp - b.timestamp);

    // Match Task launches -> SubagentStart (gives us names + agent_ids)
    const matchedStartIds = new Set<string>();
    const agentIdToTask = new Map<string, typeof taskLaunches[0]>();
    for (const task of taskLaunches) {
      const agentId = matchTaskToStart(task, persistentSubagentStarts, matchedStartIds);
      if (agentId) {
        matchedStartIds.add(agentId);
        agentIdToTask.set(agentId, task);
      }
    }

    // Deduplicate: only keep agents that have a Task match (named agents).
    const childNodes: AgentTreeNode[] = [];
    const seenNames = new Set<string>();
    const primarySessionId = sessionIds[0];

    for (const [agentId, task] of agentIdToTask) {
      // Dedup by name: if we already have an agent with this name, keep the latest
      if (task.name && seenNames.has(task.name)) continue;
      if (task.name) seenNames.add(task.name);

      const start = persistentSubagentStarts.get(agentId);
      const stop = persistentSubagentStops.get(agentId);

      const status: AgentStatus = stop ? 'stopped' : 'active';

      // Collect messages for this agent by name
      const agentName = task.name;
      const sent = persistentMessages.filter(m => m.fromName === agentName);
      const received = persistentMessages.filter(m => m.toName === agentName);

      childNodes.push({
        agentId,
        name: task.name,
        subagentType: task.subagentType ?? start?.agentType ?? null,
        description: task.description ?? null,
        teamName: task.teamName ?? teamName,
        model: task.model ?? null,
        parentSessionId: primarySessionId,
        sourceApp,
        children: [],
        status,
        startTimestamp: start?.timestamp ?? task.timestamp,
        stopTimestamp: stop?.timestamp ?? null,
        messagesSent: sent,
        messagesReceived: received,
      });
    }

    // Also add unmatched SubagentStarts from ANY session in this group
    for (const start of persistentSubagentStarts.values()) {
      if (!sessionIdSet.has(start.parentSessionId)) continue;
      if (agentIdToTask.has(start.agentId)) continue;
      if (start.agentType && seenNames.has(start.agentType)) continue;

      const stop = persistentSubagentStops.get(start.agentId);
      const status: AgentStatus = stop ? 'stopped' : 'active';

      childNodes.push({
        agentId: start.agentId,
        name: null,
        subagentType: start.agentType || null,
        description: null,
        teamName,
        model: null,
        parentSessionId: primarySessionId,
        sourceApp,
        children: [],
        status,
        startTimestamp: start.timestamp,
        stopTimestamp: stop?.timestamp ?? null,
        messagesSent: [],
        messagesReceived: [],
      });
    }

    // Sort children by start timestamp
    childNodes.sort((a, b) => (a.startTimestamp ?? 0) - (b.startTimestamp ?? 0));

    // Leader messages
    const leaderSent = persistentMessages.filter(m => m.fromName === 'claude-code');
    const leaderReceived = persistentMessages.filter(m => m.toName === 'claude-code');

    const rootNode: AgentTreeNode = {
      agentId: primarySessionId.slice(0, 7),
      name: 'claude-code',
      subagentType: null,
      description: null,
      teamName,
      model: null,
      parentSessionId: primarySessionId,
      sourceApp,
      children: childNodes,
      status: 'active',
      startTimestamp: null,
      stopTimestamp: null,
      messagesSent: leaderSent,
      messagesReceived: leaderReceived,
    };

    teams.push({
      teamName,
      parentSessionId: primarySessionId,
      sourceApp,
      rootNode,
      allNodes: [rootNode, ...childNodes],
      messages: [...persistentMessages],
    });
  }

  return teams;
}

export { countNodesRecursive };

export function useAgentTree(events: Ref<HookEvent[]>) {
  const agentTeams = ref<AgentTeam[]>([]);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastLength = 0;

  const rebuild = () => {
    extractRelationshipEvents(events.value);
    agentTeams.value = buildTree();
  };

  // Load historical agent-relationship events from server on first use
  if (!historicalAgentEventsLoaded) {
    historicalAgentEventsLoaded = true;
    loadHistoricalAgentEvents().then(agentEvents => {
      if (agentEvents.length > 0) {
        extractRelationshipEvents(agentEvents);
        agentTeams.value = buildTree();
      }
    });
  }

  // Watch array length only (no deep), plus trigger on reference change
  watch(() => events.value.length, (newLen) => {
    if (newLen === lastLength && newLen > 0) return;
    lastLength = newLen;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(rebuild, 200);
  }, { immediate: true });

  const hasTeam: ComputedRef<boolean> = computed(() => {
    return agentTeams.value.length > 0;
  });

  const primaryTeam: ComputedRef<AgentTeam | null> = computed(() => {
    // Return the most recent team/session (last in list)
    return agentTeams.value[agentTeams.value.length - 1] ?? null;
  });

  const getNode = (agentId: string): AgentTreeNode | undefined => {
    for (const team of agentTeams.value) {
      const found = team.allNodes.find(n => n.agentId === agentId);
      if (found) return found;
    }
    return undefined;
  };

  return {
    agentTeams,
    hasTeam,
    primaryTeam,
    getNode,
  };
}
