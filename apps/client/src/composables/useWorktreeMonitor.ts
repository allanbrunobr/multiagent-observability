import { ref, watch, onUnmounted, type Ref, type ComputedRef, computed } from 'vue';
import type { HookEvent, GitMetadata, WorktreeNode, WorktreeGroup, WorktreeStatus } from '../types';

// Persistent store — survives the 300-event buffer rotation
const persistentGitMetadata = new Map<string, GitMetadata>();
const persistentWorktreeActivity = new Map<string, {
  sessionId: string;
  firstSeenTimestamp: number;
  lastEventTimestamp: number;
  eventCount: number;
  lastEventType: string;
}>();
const processedEventKeys = new Set<string>();

const IDLE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

/** Clear all persistent state. Call when the user clicks "Clear events". */
export function clearWorktreeState() {
  persistentGitMetadata.clear();
  persistentWorktreeActivity.clear();
  processedEventKeys.clear();
}

function extractWorktreeData(events: HookEvent[]) {
  for (const event of events) {
    const ts = event.timestamp ?? 0;
    const sourceApp = event.source_app;
    const eventKey = `${sourceApp}:${event.session_id}:${ts}:${event.hook_event_type}`;

    if (processedEventKeys.has(eventKey)) continue;
    processedEventKeys.add(eventKey);

    // Extract git_metadata from SessionStart
    if (event.hook_event_type === 'SessionStart') {
      const gitMeta = event.payload?.git_metadata;
      if (gitMeta && gitMeta.repo_id) {
        persistentGitMetadata.set(sourceApp, gitMeta as GitMetadata);
      }
    }

    // Update activity for all events from known worktree source_apps
    const activity = persistentWorktreeActivity.get(sourceApp);
    if (activity) {
      activity.lastEventTimestamp = Math.max(activity.lastEventTimestamp, ts);
      activity.eventCount++;
      activity.lastEventType = event.hook_event_type;
    } else {
      persistentWorktreeActivity.set(sourceApp, {
        sessionId: event.session_id,
        firstSeenTimestamp: ts,
        lastEventTimestamp: ts,
        eventCount: 1,
        lastEventType: event.hook_event_type,
      });
    }
  }
}

function getWorktreeStatus(lastTimestamp: number, lastEventType: string): WorktreeStatus {
  if (lastEventType === 'SessionEnd' || lastEventType === 'Stop') {
    return 'stopped';
  }
  const elapsed = Date.now() - lastTimestamp;
  if (elapsed > IDLE_THRESHOLD_MS) {
    return 'idle';
  }
  return 'active';
}

function buildWorktreeGroups(): WorktreeGroup[] {
  // Group source_apps by repo_id
  const groupMap = new Map<string, { repoName: string; nodes: WorktreeNode[] }>();

  for (const [sourceApp, gitMeta] of persistentGitMetadata) {
    const activity = persistentWorktreeActivity.get(sourceApp);
    if (!activity) continue;

    const status = getWorktreeStatus(activity.lastEventTimestamp, activity.lastEventType);

    const node: WorktreeNode = {
      sourceApp,
      sessionId: activity.sessionId,
      gitMetadata: gitMeta,
      status,
      lastEventTimestamp: activity.lastEventTimestamp,
      firstSeenTimestamp: activity.firstSeenTimestamp,
      eventCount: activity.eventCount,
      branch: gitMeta.branch,
    };

    let group = groupMap.get(gitMeta.repo_id);
    if (!group) {
      group = { repoName: gitMeta.repo_name, nodes: [] };
      groupMap.set(gitMeta.repo_id, group);
    }
    group.nodes.push(node);
  }

  // Filter for groups with 2+ worktrees (single worktree repos are not interesting)
  const result: WorktreeGroup[] = [];
  for (const [repoId, group] of groupMap) {
    if (group.nodes.length < 2) continue;
    // Sort worktrees by firstSeenTimestamp
    group.nodes.sort((a, b) => a.firstSeenTimestamp - b.firstSeenTimestamp);
    result.push({
      repoId,
      repoName: group.repoName,
      worktrees: group.nodes,
    });
  }

  return result;
}

export function useWorktreeMonitor(events: Ref<HookEvent[]>) {
  const worktreeGroups = ref<WorktreeGroup[]>([]);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let statusInterval: ReturnType<typeof setInterval> | null = null;
  let lastLength = 0;

  const rebuild = () => {
    extractWorktreeData(events.value);
    worktreeGroups.value = buildWorktreeGroups();
  };

  // Watch array length (shallow), debounce 300ms
  watch(() => events.value.length, (newLen) => {
    if (newLen === lastLength && newLen > 0) return;
    lastLength = newLen;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(rebuild, 300);
  }, { immediate: true });

  // 30s interval to update active -> idle status
  statusInterval = setInterval(() => {
    if (persistentGitMetadata.size > 0) {
      worktreeGroups.value = buildWorktreeGroups();
    }
  }, 30_000);

  onUnmounted(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (statusInterval) clearInterval(statusInterval);
  });

  const hasWorktrees: ComputedRef<boolean> = computed(() => worktreeGroups.value.length > 0);

  const totalWorktreeCount: ComputedRef<number> = computed(() =>
    worktreeGroups.value.reduce((sum, g) => sum + g.worktrees.length, 0)
  );

  return {
    worktreeGroups,
    hasWorktrees,
    totalWorktreeCount,
  };
}
