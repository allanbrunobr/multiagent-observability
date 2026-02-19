# Multi-Agent Observability Dashboard

Real-time monitoring and visualization for Claude Code agents. Install once, monitor every project — including parallel worktrees created by tools like AutoForge.

## Overview

This system captures all 12 Claude Code [Hook events](https://docs.anthropic.com/en/docs/claude-code/hooks) and displays them in a real-time dashboard. It works **globally** — a single installation at user-level (`~/.claude/`) means any Claude Code session, in any project, in any git worktree, sends events automatically. Zero per-project configuration.

<img src="images/app.png" alt="Multi-Agent Observability Dashboard" style="max-width: 800px; width: 100%;">

## Architecture

```
Claude Code (any project)
    │
    ├── Hook fires (12 event types)
    │
    ▼
~/.claude/hooks/observability/send_event.py
    │
    ├── Detects git worktree → unique source_app
    ├── Extracts git_metadata (repo_id, branch, is_worktree)
    │
    ▼
POST http://localhost:4000/events
    │
    ▼
Bun Server → SQLite (WAL) → WebSocket broadcast
    │
    ▼
Vue 3 Dashboard (localhost:5173)
    ├── Agent Tree View
    ├── Worktree Monitor
    ├── Task Kanban Board
    ├── Session History
    ├── Activity Heatmap
    └── Live Event Feed
```

## Requirements

- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** — Anthropic's CLI
- **[Astral uv](https://docs.astral.sh/uv/)** — Python package manager (for hook scripts)
- **[Bun](https://bun.sh/)** — JavaScript runtime (for server + client)
- **[just](https://github.com/casey/just)** (optional) — Command runner
- **`ANTHROPIC_API_KEY`** — For AI-powered event summarization

## Quick Start

```bash
# 1. Install dependencies
cd apps/server && bun install && cd ../client && bun install && cd ../..

# 2. Start the dashboard
just start    # or: bun run --cwd apps/server src/index.ts & bun run --cwd apps/client dev &

# 3. Open http://localhost:5173
```

## Two Ways to Monitor Sessions

There are two approaches depending on what you need:

| | Global (all sessions) | Per-project (selective) |
|---|---|---|
| **Setup** | `bash scripts/install-global.sh` | `/add-observability` in each project |
| **Scope** | Every Claude Code session on your machine | Only the project where you ran the skill |
| **Config file** | `~/.claude/settings.json` (user-level) | `.claude/settings.local.json` (project-level) |
| **Hooks** | 12 (send_event.py only) | 24 (handler + send_event.py per event) |
| **Use case** | You want full visibility into all your work | You want observability only in specific projects |

---

## Option A: Global Installation (all sessions)

Run the installer once and **every Claude Code session on your machine** — in any project, any git worktree, any sub-agent — will appear in the dashboard automatically. No per-project configuration needed.

```bash
bash scripts/install-global.sh
```

### What it does

The script registers 12 hooks in `~/.claude/settings.json` (user-level). Claude Code loads user-level hooks automatically for every session:

```
~/.claude/settings.json (user-level)
    │
    ├── SessionStart       → send_event.py
    ├── SessionEnd         → send_event.py
    ├── UserPromptSubmit   → send_event.py --summarize
    ├── PreToolUse         → send_event.py --summarize
    ├── PostToolUse        → send_event.py --summarize
    ├── PostToolUseFailure → send_event.py --summarize
    ├── PermissionRequest  → send_event.py --summarize
    ├── Notification       → send_event.py --summarize
    ├── SubagentStart      → send_event.py
    ├── SubagentStop       → send_event.py
    ├── Stop               → send_event.py --add-chat
    └── PreCompact         → send_event.py
```

All 12 hooks point to the same script: `~/.claude/hooks/observability/send_event.py`. The flow for any session is:

1. You open Claude Code in any project
2. Claude Code starts a session → `SessionStart` hook fires
3. `send_event.py` sends the event to `http://localhost:4000/events` with a `source_app` derived from the project
4. If running inside a git worktree, it automatically detects this via `git rev-parse --git-common-dir` and appends the branch name to `source_app` (e.g., `cc-observability:feat/auth`)
5. The dashboard receives the event via WebSocket and shows the agent in real-time
6. Every subsequent event (tool calls, sub-agents, prompts, etc.) follows the same path

**No project-level config. No env vars. No skill invocation.** Install once and every Claude Code session on your machine is monitored.

### What `install-global.sh` does (4 steps)

### 1. Copies hook scripts to `~/.claude/hooks/observability/`

```bash
~/.claude/hooks/observability/
├── send_event.py           # Main event sender (patched for global use)
├── utils/
│   ├── summarizer.py       # AI summarization via Haiku
│   ├── model_extractor.py  # Model name extraction
│   └── llm/
│       └── anth.py         # Anthropic API client
```

Two critical patches are applied to `send_event.py`:

- **`sys.path` fix**: Adds `sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))` so that Python imports work regardless of the current working directory. Without this, running the hook from `/some/other/project/` would fail because Python can't find `utils/summarizer.py` relative to CWD.

- **`--source-app` default**: Changes from `required=True` to `default='cc-observability'`. At user-level, you can't hardcode a project name — the `_resolve_source_app()` function auto-detects it from git context.

### 2. Merges hooks into `~/.claude/settings.json`

```json
{
  "hooks": {
    "SessionStart":       [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type SessionStart"}]}],
    "SessionEnd":         [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type SessionEnd"}]}],
    "UserPromptSubmit":   [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type UserPromptSubmit --summarize"}]}],
    "PreToolUse":         [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type PreToolUse --summarize"}]}],
    "PostToolUse":        [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type PostToolUse --summarize"}]}],
    "PostToolUseFailure": [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type PostToolUseFailure --summarize"}]}],
    "PermissionRequest":  [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type PermissionRequest --summarize"}]}],
    "Notification":       [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type Notification --summarize"}]}],
    "SubagentStart":      [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type SubagentStart"}]}],
    "SubagentStop":       [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type SubagentStop"}]}],
    "Stop":               [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type Stop --add-chat"}]}],
    "PreCompact":         [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type PreCompact"}]}]
  }
}
```

Because this is in `~/.claude/settings.json` (user-level), it applies to **every** Claude Code session regardless of project. Existing settings (`env`, `enabledPlugins`, etc.) are preserved via JSON merge.

### 3. Installs a macOS LaunchAgent

Creates `~/Library/LaunchAgents/com.observability.server.plist` so the Bun server starts automatically at login, restarts on crash, and runs on port 4000. No need to manually start the server.

### 4. Loads the LaunchAgent

Runs `launchctl bootstrap` to start the server immediately.

---

## Option B: Per-Project with `/add-observability`

If you **don't** want every Claude Code session in the dashboard — only specific projects — use the `/add-observability` skill instead of the global installer.

Open Claude Code in the project you want to monitor and run:

```
/add-observability
```

### What it does

The skill configures hooks at **project-level** (in `.claude/settings.local.json`), not user-level. It executes 6 steps:

1. **Sanitize Permissions** — Cleans invalid entries in `settings.local.json` (e.g., long auto-saved `git commit` commands that break the JSON parser and silently disable ALL hooks)
2. **Verify Prerequisites** — Checks that `$OBSERVABILITY_HOME` is set and optionally verifies the server is running at `localhost:4000`
3. **Detect source-app** — Derives the app name from the project directory (e.g., `my-project`)
4. **Read/Create settings.local.json** — Reads or creates `.claude/settings.local.json`, preserving all existing settings
5. **Merge Observability Hooks** — Adds 24 hooks (2 per event x 12 events): a specific handler (e.g., `pre_tool_use.py`, `stop.py --chat`) + the generic `send_event.py` for each event. Idempotent — if hooks already exist, they are not duplicated
6. **Summary** — Saves the file and shows a report of what was configured

### Prerequisite

Set `OBSERVABILITY_HOME` pointing to this project:

```bash
# Add to ~/.zshrc
export OBSERVABILITY_HOME="/path/to/multiagent-observability"
```

### Global vs Per-Project

If you already have global hooks (`~/.claude/settings.json` via `install-global.sh`), you **don't need** `/add-observability` — all sessions already appear in the dashboard. The skill exists for users who prefer selective monitoring, adding observability only to specific projects.

---

## Git Worktree Detection

The hook automatically identifies git worktrees. This is essential for monitoring parallel agents created by tools like [AutoForge](https://github.com/nicobailon/autoforge) with `/autoforge worktree-split --count N`.

### How `_resolve_source_app()` works

```python
def _resolve_source_app(base_source_app):
    # 1. Get the shared .git directory (same for all worktrees of a repo)
    common_dir = git('rev-parse --git-common-dir')
    #    → "/Users/me/my-project/.git"

    # 2. Get the toplevel of the current checkout
    toplevel = git('rev-parse --show-toplevel')
    #    Main:     "/Users/me/my-project"
    #    Worktree: "/Users/me/my-project-wt-auth"

    # 3. If toplevel/.git != common_dir → it's a worktree
    is_worktree = (toplevel + '/.git' != common_dir)

    if not is_worktree:
        return base_source_app  # "cc-observability"

    # 4. Append branch name to differentiate
    branch = git('rev-parse --abbrev-ref HEAD')
    return f"{base_source_app}:{branch}"
    # → "cc-observability:feat/auth"
```

### How `_get_git_metadata()` works

On `SessionStart`, the hook extracts metadata for worktree grouping:

| Field | Example | Purpose |
|---|---|---|
| `repo_id` | `a1b2c3d4e5f6` | SHA-256 hash of `.git-common-dir` (groups worktrees by repo) |
| `repo_name` | `my-project` | Display name |
| `branch` | `feat/auth` | Current branch |
| `worktree_path` | `/Users/me/my-project-wt-auth` | Filesystem path |
| `is_worktree` | `true` | Secondary worktree flag |

The dashboard groups worktrees that share the same `repo_id` (i.e., same underlying repository). It only shows the worktree view when 2+ source_apps share the same `repo_id`.

## Agent Identification

As defined in `CLAUDE.md`:

> Use `source_app` + `session_id` to uniquely identify an agent. Display as `source_app:session_id` with session_id truncated to 8 characters.

Example: `cc-observability:feat/auth:a548169f`

## Dashboard Features

### Agent Tree View
Displays agent teams in a clean hierarchy: team leader + child sub-agents. Shows agent name, role, model, status (active/idle/stopped), duration, and latest thought summary. Collapsed by default.

### Worktree Monitor
Groups parallel worktrees by repository. Each worktree shows branch name, event count, and real-time status. Expandable to reveal a per-worktree task Kanban board.

### Task Kanban Board
Visualizes tasks created by Agent Teams (TaskCreate/TaskUpdate events). Boards are grouped per agent, with expand/collapse controls and list/grid view toggle.

### Live Event Feed
Real-time stream of all hook events with filtering by source app, session, and event type. Includes AI-generated summaries for key events.

### Activity Heatmap
Time-bucketed grid showing event density per agent over time.

### Session History
Drill down into past sessions with event counts, model info, and duration.

### Summary Stats Bar
4 live stat cards: Total Events, Active Agents, Pending HITL, Active Sessions.

### Keyboard Shortcuts
Press `?` to see all shortcuts. `1-5` switch tabs, `F` toggles filters, `Esc` closes modals.

### Sound Notifications
Optional audio cues for new events, sub-agent start, and session end (Web Audio API).

### Theme System
Multiple color themes including Claude Desktop colors. Configurable via the palette icon.

## Event Types

| Event | Description |
|---|---|
| `SessionStart` | Session begins — captures git_metadata for worktree detection |
| `SessionEnd` | Session ends with reason tracking |
| `UserPromptSubmit` | User prompt before Claude processes it |
| `PreToolUse` | Before tool execution — tool name and inputs |
| `PostToolUse` | After tool completion — results |
| `PostToolUseFailure` | Tool execution failed |
| `PermissionRequest` | User permission requested |
| `Notification` | User interaction event |
| `SubagentStart` | Sub-agent spawned |
| `SubagentStop` | Sub-agent finished |
| `Stop` | Response complete — includes chat transcript |
| `PreCompact` | Context window compaction |

## Project Structure

```
multiagent-observability/
├── apps/
│   ├── server/                 # Bun + TypeScript + SQLite
│   │   └── src/
│   │       ├── index.ts        # HTTP/WebSocket server
│   │       ├── db.ts           # SQLite with stats queries
│   │       ├── types.ts        # WsMessage interfaces
│   │       └── utils.ts        # Event priority classification
│   │
│   └── client/                 # Vue 3 + TypeScript + Vite
│       └── src/
│           ├── App.vue
│           ├── components/
│           │   ├── AgentTreeView.vue
│           │   ├── WorktreeMonitorView.vue
│           │   ├── TaskKanbanBoard.vue
│           │   ├── SessionHistoryView.vue
│           │   ├── AgentActivityHeatmap.vue
│           │   ├── TaskDependencyGraph.vue
│           │   ├── SummaryStatsBar.vue
│           │   ├── LivePulseChart.vue
│           │   ├── KeyboardShortcutsHelp.vue
│           │   └── ThemeManager.vue
│           ├── composables/
│           │   ├── useAgentTree.ts
│           │   ├── useWorktreeMonitor.ts
│           │   ├── useTaskBoard.ts
│           │   ├── useSessionHistory.ts
│           │   ├── useWebSocket.ts
│           │   ├── useHeatmapData.ts
│           │   ├── useEventSearch.ts
│           │   ├── useSoundNotifications.ts
│           │   ├── useKeyboardShortcuts.ts
│           │   └── useNotificationLevel.ts
│           └── types.ts
│
├── scripts/
│   ├── install-global.sh       # One-time global installer
│   ├── start-system.sh
│   └── reset-system.sh
│
├── docs/
│   └── worktree-observability-flow.html  # Detailed technical documentation
│
└── justfile                    # Task runner recipes
```

## Technical Stack

- **Server**: Bun, TypeScript, SQLite (WAL mode)
- **Client**: Vue 3, TypeScript, Vite, CSS custom properties
- **Hooks**: Python 3.11+, Astral uv
- **Communication**: HTTP REST + WebSocket
- **Auto-start**: macOS LaunchAgent

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Server port |
| `VITE_MAX_EVENTS_TO_DISPLAY` | `300` | Max events in UI buffer |
| `ANTHROPIC_API_KEY` | — | Required for AI summarization |

## Uninstall

```bash
# Stop server
launchctl bootout gui/$(id -u)/com.observability.server

# Remove global hooks
rm -rf ~/.claude/hooks/observability

# Remove hooks from settings (edit ~/.claude/settings.json, delete "hooks" key)

# Remove LaunchAgent
rm ~/Library/LaunchAgents/com.observability.server.plist
```
