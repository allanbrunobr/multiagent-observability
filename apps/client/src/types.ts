// New interface for human-in-the-loop requests
export interface HumanInTheLoop {
  question: string;
  responseWebSocketUrl: string;
  type: 'question' | 'permission' | 'choice';
  choices?: string[]; // For multiple choice questions
  timeout?: number; // Optional timeout in seconds
  requiresResponse?: boolean; // Whether response is required or optional
}

// Response interface
export interface HumanInTheLoopResponse {
  response?: string;
  permission?: boolean;
  choice?: string; // Selected choice from options
  hookEvent: HookEvent;
  respondedAt: number;
  respondedBy?: string; // Optional user identifier
}

// Status tracking interface
export interface HumanInTheLoopStatus {
  status: 'pending' | 'responded' | 'timeout' | 'error';
  respondedAt?: number;
  response?: HumanInTheLoopResponse;
}

export interface HookEvent {
  id?: number;
  source_app: string;
  session_id: string;
  hook_event_type: string;
  payload: Record<string, any>;
  chat?: any[];
  summary?: string;
  timestamp?: number;
  model_name?: string;

  // NEW: Optional HITL data
  humanInTheLoop?: HumanInTheLoop;
  humanInTheLoopStatus?: HumanInTheLoopStatus;
}

export interface FilterOptions {
  source_apps: string[];
  session_ids: string[];
  hook_event_types: string[];
}

export interface WebSocketMessage {
  type: 'initial' | 'event' | 'hitl_response' | 'stats' | 'agent_update';
  data: HookEvent | HookEvent[] | HumanInTheLoopResponse | Record<string, any>;
}

// Agent Tree types
export type AgentStatus = 'active' | 'idle' | 'stopped' | 'unknown';

export interface AgentTreeNode {
  agentId: string;              // Short UUID from SubagentStart (e.g., "a548169")
  name: string | null;          // From PreToolUse:Task tool_input.name
  subagentType: string | null;  // From PreToolUse:Task tool_input.subagent_type
  description: string | null;   // From PreToolUse:Task tool_input.description
  teamName: string | null;
  model: string | null;         // From PreToolUse:Task tool_input.model
  parentSessionId: string;      // The parent's session_id (all events share this)
  sourceApp: string;
  children: AgentTreeNode[];
  status: AgentStatus;
  startTimestamp: number | null;
  stopTimestamp: number | null;
  messagesSent: AgentMessage[];
  messagesReceived: AgentMessage[];
}

export interface AgentMessage {
  fromName: string;
  toName: string;
  summary: string | null;
  content: string | null;
  timestamp: number;
  type: string;               // "message" | "broadcast" | "shutdown_request" etc.
}

export interface AgentTeam {
  teamName: string | null;
  parentSessionId: string;
  sourceApp: string;
  rootNode: AgentTreeNode | null; // The leader/parent
  allNodes: AgentTreeNode[];
  messages: AgentMessage[];
}

// Worktree Monitor types
export type WorktreeStatus = 'active' | 'idle' | 'stopped';

export interface GitMetadata {
  repo_id: string;
  repo_name: string;
  branch: string;
  worktree_path: string;
  is_worktree: boolean;
}

export interface WorktreeNode {
  sourceApp: string;
  sessionId: string;
  gitMetadata: GitMetadata;
  status: WorktreeStatus;
  lastEventTimestamp: number;
  firstSeenTimestamp: number;
  eventCount: number;
  branch: string;
}

export interface WorktreeGroup {
  repoId: string;
  repoName: string;
  worktrees: WorktreeNode[];
}

// Kanban Board types
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'deleted';

export interface KanbanTask {
  taskId: string;
  subject: string;
  description: string | null;
  activeForm: string | null;
  status: TaskStatus;
  owner: string | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  blockedBy: string[];
  blocks: string[];
  sessionId: string;
  sourceApp: string;
  teamName: string | null;
}

export interface KanbanColumn {
  status: TaskStatus;
  label: string;
  tasks: KanbanTask[];
}

export interface KanbanBoard {
  sessionId: string;
  sourceApp: string;
  teamName: string | null;
  columns: KanbanColumn[];
  totalTasks: number;
}

// History Mode types
export interface SessionSummary {
  session_id: string;
  source_app: string;
  event_count: number;
  first_event_time: number;
  last_event_time: number;
  hook_event_types: string[];
  model_name: string | null;
  has_team: boolean;
  has_tasks: boolean;
  status: 'active' | 'ended';
}

export type TimeRange = '1m' | '3m' | '5m' | '10m';

export interface ChartDataPoint {
  timestamp: number;
  count: number;
  eventTypes: Record<string, number>; // event type -> count
  toolEvents?: Record<string, number>; // "EventType:ToolName" -> count (e.g., "PreToolUse:Bash" -> 3)
  sessions: Record<string, number>; // session id -> count
}

export interface ChartConfig {
  maxDataPoints: number;
  animationDuration: number;
  barWidth: number;
  barGap: number;
  colors: {
    primary: string;
    glow: string;
    axis: string;
    text: string;
  };
}