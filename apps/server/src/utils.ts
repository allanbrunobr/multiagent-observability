export type EventPriority = 'critical' | 'milestone' | 'progress' | 'info';

const PRIORITY_MAP: Record<string, EventPriority> = {
  // CRITICAL: requires immediate attention
  'PostToolUseFailure': 'critical',

  // MILESTONE: significant lifecycle events
  'SessionStart': 'milestone',
  'SessionEnd': 'milestone',
  'SubagentStart': 'milestone',
  'SubagentStop': 'milestone',
  'Stop': 'milestone',

  // PROGRESS: ongoing work indicators
  'PreToolUse': 'progress',
  'PostToolUse': 'progress',

  // INFO: everything else handled by default
  'Notification': 'info',
  'PreCompact': 'info',
  'UserPromptSubmit': 'info',
  'PermissionRequest': 'info',
};

/**
 * Classify a hook event type into a priority level.
 * Events with pending HITL are always CRITICAL regardless of type.
 */
export function getEventPriority(
  hookEventType: string,
  humanInTheLoopStatus?: { status: string } | null
): EventPriority {
  // Any event with pending HITL is critical
  if (humanInTheLoopStatus?.status === 'pending') {
    return 'critical';
  }

  return PRIORITY_MAP[hookEventType] ?? 'info';
}
