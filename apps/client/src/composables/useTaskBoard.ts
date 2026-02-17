import { ref, watch, type Ref, type ComputedRef, computed } from 'vue';
import type { HookEvent, KanbanTask, KanbanBoard, KanbanColumn, TaskStatus } from '../types';
import { API_BASE_URL } from '../config';

// Persistent store — survives the 300-event buffer rotation
const persistentTasks = new Map<string, KanbanTask>();
// Map real taskId → stored key once resolved (scoped: "sourceApp:taskId" → storedKey)
const resolvedTaskIds = new Map<string, string>();
const processedEventKeys = new Set<string>();

// Whether we've loaded historical task events from the server
let historicalLoaded = false;

/** Clear all persistent state. Call when the user clicks "Clear events". */
export function clearTaskBoardState() {
  persistentTasks.clear();
  resolvedTaskIds.clear();
  processedEventKeys.clear();
  historicalLoaded = false;
}

function applyTaskUpdate(task: KanbanTask, toolInput: Record<string, any>, ts: number, taskId: string) {
  if (toolInput.status) task.status = toolInput.status as TaskStatus;
  if (toolInput.subject) task.subject = toolInput.subject;
  if (toolInput.description) task.description = toolInput.description;
  if (toolInput.activeForm) task.activeForm = toolInput.activeForm;
  if (toolInput.owner) task.owner = toolInput.owner;
  task.updatedAt = ts;
  if (toolInput.status === 'completed') task.completedAt = ts;
  if (toolInput.addBlockedBy) task.blockedBy = [...task.blockedBy, ...toolInput.addBlockedBy];
  if (toolInput.addBlocks) task.blocks = [...task.blocks, ...toolInput.addBlocks];

  // If still stored under a provisional key, re-index with real taskId
  if (task.taskId !== taskId && task.taskId.includes(':')) {
    const oldKey = task.taskId;
    task.taskId = taskId;
    persistentTasks.delete(oldKey);
    persistentTasks.set(`${task.sourceApp}::${taskId}`, task);
    resolvedTaskIds.set(`${task.sourceApp}:${taskId}`, `${task.sourceApp}::${taskId}`);
  }
}

function findTaskForUpdate(taskId: string, sourceApp: string, toolInput: Record<string, any>): KanbanTask | null {
  // 1. Direct lookup by "sourceApp::taskId" (same agent created & updates)
  const directKey = `${sourceApp}::${taskId}`;
  let task = persistentTasks.get(directKey) ?? null;
  if (task) return task;

  // 2. Check resolved mappings (same sourceApp)
  const resolvedKey = resolvedTaskIds.get(`${sourceApp}:${taskId}`);
  if (resolvedKey) {
    task = persistentTasks.get(resolvedKey) ?? null;
    if (task) return task;
  }

  // 3. Cross-sourceApp lookup by taskId — in multi-agent teams, teammates
  //    update tasks created by the team lead (different sourceApp).
  //    Search ALL tasks for a matching taskId regardless of sourceApp.
  for (const [key, t] of persistentTasks) {
    if (key.endsWith(`::${taskId}`) && t.taskId === taskId) {
      return t;
    }
  }

  // 4. Check resolved mappings across all sourceApps
  for (const [mappingKey, storedKey] of resolvedTaskIds) {
    if (mappingKey.endsWith(`:${taskId}`)) {
      task = persistentTasks.get(storedKey) ?? null;
      if (task) return task;
    }
  }

  // 5. Match by subject within same sourceApp
  const updateSubject = toolInput.subject;
  if (updateSubject) {
    for (const [, t] of persistentTasks) {
      if (t.sourceApp === sourceApp && t.subject === updateSubject) {
        return t;
      }
    }
  }

  // 6. Last resort: single unresolved provisional task within same sourceApp
  const unresolved: KanbanTask[] = [];
  for (const [key, t] of persistentTasks) {
    if (t.sourceApp === sourceApp && key.includes(':') && !key.includes('::')) {
      unresolved.push(t);
    }
  }
  if (unresolved.length === 1) {
    return unresolved[0];
  }

  return null;
}

/**
 * Resolve a TaskCreate PostToolUse event — maps the real task ID to the task data.
 *
 * IMPORTANT: This always overwrites any existing task at the same finalKey.
 * Since the same sourceApp can have multiple task lists over time (IDs restart),
 * events are processed in ASC order and the LATEST create for a given ID wins.
 */
function resolveTaskFromPostCreate(
  event: HookEvent,
  toolInput: Record<string, any>,
  ts: number
) {
  const toolResponse = event.payload?.tool_response;
  if (!toolResponse?.task?.id) return;

  const realId: string = String(toolResponse.task.id);
  const subject: string = toolInput.subject ?? toolResponse.task.subject ?? 'Untitled';
  const sourceApp = event.source_app;
  const finalKey = `${sourceApp}::${realId}`;

  // Try to find the provisional task created by the matching PreToolUse
  const provisionalKey = `${event.session_id}:${subject}`;
  const provisional = persistentTasks.get(provisionalKey);

  if (provisional) {
    // Re-key from provisional to final key (overwrite any stale entry)
    provisional.taskId = realId;
    provisional.createdAt = ts;
    provisional.updatedAt = ts;
    provisional.completedAt = null;
    provisional.status = 'pending';
    persistentTasks.delete(provisionalKey);
    persistentTasks.set(finalKey, provisional);
  } else {
    // No provisional found — create the task directly with full data.
    // This also overwrites any stale task from a previous batch at the same key.
    persistentTasks.set(finalKey, {
      taskId: realId,
      subject,
      description: toolInput.description ?? null,
      activeForm: toolInput.activeForm ?? null,
      status: 'pending',
      owner: null,
      createdAt: ts,
      updatedAt: ts,
      completedAt: null,
      blockedBy: [],
      blocks: [],
      sessionId: event.session_id,
      sourceApp,
      teamName: null,
    });
  }
  resolvedTaskIds.set(`${sourceApp}:${realId}`, finalKey);
}

function extractTaskEvents(events: HookEvent[]) {
  for (const event of events) {
    const ts = event.timestamp ?? 0;
    const eventKey = `${event.session_id}:${ts}:${event.hook_event_type}:${event.payload?.tool_name ?? ''}`;

    if (processedEventKeys.has(eventKey)) continue;
    processedEventKeys.add(eventKey);

    if (event.hook_event_type !== 'PreToolUse' && event.hook_event_type !== 'PostToolUse') continue;

    const toolName = event.payload?.tool_name;
    const toolInput = event.payload?.tool_input;
    if (!toolInput) continue;

    // ── TaskCreate: PreToolUse → provisional task, PostToolUse → resolve real ID ──
    if (toolName === 'TaskCreate') {
      if (event.hook_event_type === 'PreToolUse') {
        const subject = toolInput.subject ?? 'Untitled';
        const provisionalKey = `${event.session_id}:${subject}`;

        if (!persistentTasks.has(provisionalKey)) {
          persistentTasks.set(provisionalKey, {
            taskId: provisionalKey,
            subject,
            description: toolInput.description ?? null,
            activeForm: toolInput.activeForm ?? null,
            status: 'pending',
            owner: null,
            createdAt: ts,
            updatedAt: ts,
            completedAt: null,
            blockedBy: [],
            blocks: [],
            sessionId: event.session_id,
            sourceApp: event.source_app,
            teamName: null,
          });
        }
      }

      if (event.hook_event_type === 'PostToolUse') {
        resolveTaskFromPostCreate(event, toolInput, ts);
      }
    }

    // ── TaskUpdate ──
    if (toolName === 'TaskUpdate') {
      const taskId = toolInput.taskId;
      if (!taskId) continue;

      const task = findTaskForUpdate(taskId, event.source_app, toolInput);

      if (task) {
        applyTaskUpdate(task, toolInput, ts, taskId);
      } else {
        // TaskUpdate for unknown task — create a placeholder
        persistentTasks.set(`${event.source_app}::${taskId}`, {
          taskId,
          subject: toolInput.subject ?? `Task ${taskId}`,
          description: toolInput.description ?? null,
          activeForm: toolInput.activeForm ?? null,
          status: (toolInput.status as TaskStatus) ?? 'pending',
          owner: toolInput.owner ?? null,
          createdAt: ts,
          updatedAt: ts,
          completedAt: toolInput.status === 'completed' ? ts : null,
          blockedBy: toolInput.addBlockedBy ?? [],
          blocks: toolInput.addBlocks ?? [],
          sessionId: event.session_id,
          sourceApp: event.source_app,
          teamName: null,
        });
      }
    }
  }
}

/**
 * Fetch ALL task events from the server (not limited by the 300-event buffer).
 * This ensures TaskCreate events are available even when they've been evicted.
 */
async function loadHistoricalTaskEvents(): Promise<HookEvent[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/events/tasks`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function buildKanbanBoards(): KanbanBoard[] {
  const tasks = [...persistentTasks.values()];
  if (tasks.length === 0) return [];

  // Group tasks by sourceApp, skipping deleted and stale provisional tasks
  const groups = new Map<string, KanbanTask[]>();
  for (const task of tasks) {
    if (task.status === 'deleted') continue;
    // Skip unresolved provisional tasks (key contains : but not ::)
    // These are from PreToolUse events whose PostToolUse was never received
    if (task.taskId.includes(':') && !task.taskId.includes('::')) continue;
    if (!groups.has(task.sourceApp)) {
      groups.set(task.sourceApp, []);
    }
    groups.get(task.sourceApp)!.push(task);
  }

  const boards: KanbanBoard[] = [];

  for (const [sourceApp, appTasks] of groups) {
    // Only show the MOST RECENT task batch for each sourceApp.
    // Detect the latest batch by finding the most recent TaskCreate timestamp,
    // then including only tasks created within 2 hours of that.
    const latestCreate = Math.max(...appTasks.map(t => t.createdAt));
    const batchWindowMs = 2 * 60 * 60 * 1000; // 2 hours
    const batchTasks = appTasks.filter(t => latestCreate - t.createdAt < batchWindowMs);

    if (batchTasks.length === 0) continue;

    const columns: KanbanColumn[] = [
      { status: 'pending', label: 'Pending', tasks: [] },
      { status: 'in_progress', label: 'In Progress', tasks: [] },
      { status: 'completed', label: 'Completed', tasks: [] },
    ];

    for (const task of batchTasks) {
      const col = columns.find(c => c.status === task.status);
      if (col) {
        col.tasks.push(task);
      } else {
        columns[0].tasks.push(task);
      }
    }

    // Sort within columns
    columns[0].tasks.sort((a, b) => a.createdAt - b.createdAt);
    columns[1].tasks.sort((a, b) => a.updatedAt - b.updatedAt);
    columns[2].tasks.sort((a, b) => (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt));

    const first = batchTasks[0];

    boards.push({
      sessionId: first.sessionId,
      sourceApp,
      teamName: first.teamName,
      columns,
      totalTasks: batchTasks.length,
    });
  }

  return boards;
}

export function useTaskBoard(events: Ref<HookEvent[]>) {
  const boards = ref<KanbanBoard[]>([]);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastLength = 0;

  const rebuild = () => {
    extractTaskEvents(events.value);
    boards.value = buildKanbanBoards();
  };

  // Load historical task events from server on first use
  if (!historicalLoaded) {
    historicalLoaded = true;
    loadHistoricalTaskEvents().then(taskEvents => {
      if (taskEvents.length > 0) {
        extractTaskEvents(taskEvents);
        boards.value = buildKanbanBoards();
      }
    });
  }

  watch(() => events.value.length, (newLen) => {
    if (newLen === lastLength && newLen > 0) return;
    lastLength = newLen;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(rebuild, 200);
  }, { immediate: true });

  const board = computed<KanbanBoard | null>(() => boards.value[0] ?? null);

  const hasTasks: ComputedRef<boolean> = computed(() => boards.value.length > 0);

  const taskCount: ComputedRef<number> = computed(() => {
    let total = 0;
    for (const b of boards.value) total += b.totalTasks;
    return total;
  });

  return {
    boards,
    board,
    hasTasks,
    taskCount,
  };
}
