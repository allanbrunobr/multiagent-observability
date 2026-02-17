import { ref, computed, type Ref } from 'vue';
import type { HookEvent } from '../types';

export type NotificationLevel = 'ALL' | 'SMART';
export type EventPriority = 'critical' | 'milestone' | 'progress' | 'info';

const PRIORITY_MAP: Record<string, EventPriority> = {
  'PostToolUseFailure': 'critical',
  'SessionStart': 'milestone',
  'SessionEnd': 'milestone',
  'SubagentStart': 'milestone',
  'SubagentStop': 'milestone',
  'Stop': 'milestone',
  'PreToolUse': 'progress',
  'PostToolUse': 'progress',
  'Notification': 'info',
  'PreCompact': 'info',
  'UserPromptSubmit': 'info',
  'PermissionRequest': 'info',
};

/** SMART mode shows only critical + milestone events */
const SMART_PRIORITIES: Set<EventPriority> = new Set(['critical', 'milestone']);

function getEventPriority(event: HookEvent): EventPriority {
  if (event.humanInTheLoop && (!event.humanInTheLoopStatus || event.humanInTheLoopStatus.status === 'pending')) {
    return 'critical';
  }
  return PRIORITY_MAP[event.hook_event_type] ?? 'info';
}

const STORAGE_KEY = 'notification-level';

export function useNotificationLevel(events: Ref<HookEvent[]>) {
  const saved = localStorage.getItem(STORAGE_KEY) as NotificationLevel | null;
  const level = ref<NotificationLevel>(saved === 'SMART' ? 'SMART' : 'ALL');

  const toggleLevel = () => {
    level.value = level.value === 'ALL' ? 'SMART' : 'ALL';
    localStorage.setItem(STORAGE_KEY, level.value);
  };

  const filteredEvents = computed(() => {
    if (level.value === 'ALL') return events.value;
    return events.value.filter(e => SMART_PRIORITIES.has(getEventPriority(e)));
  });

  return {
    level,
    toggleLevel,
    filteredEvents,
    getEventPriority,
  };
}
