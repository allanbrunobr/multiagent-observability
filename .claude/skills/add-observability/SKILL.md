# Skill: /add-observability

Configures Claude Code observability hooks in the current project so all hook events are sent to the Multi-Agent Observability dashboard.

## Invocation

User-invocable: `/add-observability`

## Instructions

When invoked, execute the following steps in order. Stop and report clearly if any step fails.

### Step 0: Sanitize Permissions (Prevent Parse Failures)

Before doing anything else, read `$CLAUDE_PROJECT_DIR/.claude/settings.local.json` (if it exists) and check the `permissions.allow` array for invalid entries. **Invalid entries cause Claude Code to fail parsing the entire file, which silently disables ALL hooks.**

**Background:** Claude Code auto-saves approved commands to `permissions.allow`. Long commands like `git commit` with multi-line messages or `git merge` with full commit bodies get saved verbatim, creating entries of 1000+ characters that contain `:*` in the middle of escaped text.

**Valid permission pattern formats (from Claude Code error messages):**

| Format | Example | Type |
|--------|---------|------|
| `Bash(command:*)` | `Bash(git commit:*)` | Prefix matching (legacy) |
| `Bash(command *)` | `Bash(git commit *)` | Wildcard matching |
| `Bash(exact command)` | `Bash(echo hello)` | Exact match (no wildcards) |
| `WebFetch(domain:host)` | `WebFetch(domain:pypi.org)` | Domain filter |
| `mcp__server__tool` | `mcp__jira__get_issue` | MCP tool (no parens) |
| `Skill(name)` | `Skill(autoforge:init)` | Skill permission |
| `WebSearch` | `WebSearch` | Tool name only |

**What makes a `Bash(...)` entry INVALID:**

1. **`:*` NOT at the very end** — causes error: `"The :* pattern must be at the end. Move :* to the end for prefix matching, or use * for wildcard matching."`
   - This happens when a long literal command contains the text `:*` somewhere in its body (inside escaped commit messages, heredocs, etc.)

2. **Overly long literal commands** (>200 characters) — these are almost always full `git commit -m "$(cat <<'EOF'...EOF)"` or `git merge ... -m "$(cat <<'EOF'...EOF)"` that were auto-saved. They are fragile and likely to contain `:*` in escaped content.

**How to fix invalid entries:**

For each invalid `Bash(...)` entry:
1. Extract the base command (the first 1-2 words after `Bash(`)
2. Replace the entire entry with `Bash(base_command:*)`
3. Common replacements:
   - Any `Bash(git commit ...)` (>200 chars) → `Bash(git commit:*)`
   - Any `Bash(git merge ...)` (>200 chars) → `Bash(git merge:*)`
   - Any `Bash(git push ...)` (>200 chars) → `Bash(git push:*)`
4. After replacing, remove exact duplicates from the array

**Rules:**
- Only modify `Bash(...)` entries that are >200 characters OR contain `:*` not at the end
- Keep all valid entries exactly as they are
- Keep all non-Bash entries untouched (WebFetch, mcp__*, Skill, WebSearch, etc.)
- If no invalid entries found, skip silently (no output)
- If entries were fixed, report:
  > Sanitized permissions: fixed {N} invalid entries (replaced with wildcard patterns). This prevents Claude Code from silently disabling all hooks.

### Step 1: Verify Prerequisites

**Check OBSERVABILITY_HOME:**
Run: `echo $OBSERVABILITY_HOME`
- If empty or unset, tell the user:
  > `OBSERVABILITY_HOME` is not set. Add this to your `~/.zshrc`:
  > ```
  > export OBSERVABILITY_HOME="/path/to/claude-code-hooks-multi-agent-observability"
  > ```
  > Then run `source ~/.zshrc` and try again.
- Stop here if not set.

**Check observability server:**
Run: `curl -s --max-time 3 http://localhost:4000/events/filter-options`
- If it fails or times out, warn (but do NOT stop):
  > Warning: Observability server is not running at http://localhost:4000. Hooks will be configured but events won't be captured until you start the server.

### Step 2: Detect source-app

Derive the source-app name from the current project directory:
1. Get the basename of `$CLAUDE_PROJECT_DIR` (or current working directory if not set)
2. Convert to lowercase
3. Replace spaces with hyphens
4. Remove any characters that aren't `[a-z0-9-]`

Store this as `SOURCE_APP` for use in hook commands.

### Step 3: Read or Create settings.local.json

The target file is: `$CLAUDE_PROJECT_DIR/.claude/settings.local.json`

- If the `.claude` directory doesn't exist, create it
- If `settings.local.json` doesn't exist, create it with: `{}`
- If it exists, read and parse it. Preserve ALL existing content (permissions, env, MCP servers, etc.)
- If it has no `"hooks"` key, add `"hooks": {}`

### Step 4: Merge Observability Hooks

For each of the 12 event types below, add two hooks (the event-specific handler + send_event.py). The rules:

- If the event type key doesn't exist in hooks, create it with a new matcher entry
- If the event type key already exists, find the first matcher entry (or create one) and APPEND the observability hooks to its `hooks` array
- **Idempotency**: Before adding, check if `send_event.py` with the matching `--event-type` is already present in any hook command for that event. If so, skip that event entirely.
- All paths use `$OBSERVABILITY_HOME` (the env var, not expanded), wrapped in escaped quotes for spaces

**Hook template per event:**

Each event gets two hook commands in this order:

1. **Handler**: `uv run \"$OBSERVABILITY_HOME/.claude/hooks/{handler_script}\" {handler_flags}`
2. **send_event**: `uv run \"$OBSERVABILITY_HOME/.claude/hooks/send_event.py\" --source-app {SOURCE_APP} --event-type {EventType} {send_flags}`

**The 12 event types and their configuration:**

| Event Type | handler_script | handler_flags | send_flags |
|---|---|---|---|
| PreToolUse | pre_tool_use.py | _(none)_ | --summarize |
| PostToolUse | post_tool_use.py | _(none)_ | --summarize |
| Stop | stop.py | --chat | --add-chat |
| UserPromptSubmit | user_prompt_submit.py | --log-only --store-last-prompt --name-agent | --summarize |
| SessionStart | session_start.py | _(none)_ | _(none)_ |
| SessionEnd | session_end.py | _(none)_ | _(none)_ |
| SubagentStart | subagent_start.py | _(none)_ | _(none)_ |
| SubagentStop | subagent_stop.py | _(none)_ | _(none)_ |
| Notification | notification.py | _(none)_ | --summarize |
| PreCompact | pre_compact.py | _(none)_ | _(none)_ |
| PermissionRequest | permission_request.py | _(none)_ | --summarize |
| PostToolUseFailure | post_tool_use_failure.py | _(none)_ | --summarize |

**Matcher field**: Events PreToolUse, PostToolUse, PermissionRequest, PostToolUseFailure, and SubagentStart use `"matcher": ""`. All other events omit the matcher field.

**JSON structure example for one event:**

```json
"PreToolUse": [
  {
    "matcher": "",
    "hooks": [
      {
        "type": "command",
        "command": "uv run \"$OBSERVABILITY_HOME/.claude/hooks/pre_tool_use.py\""
      },
      {
        "type": "command",
        "command": "uv run \"$OBSERVABILITY_HOME/.claude/hooks/send_event.py\" --source-app my-project --event-type PreToolUse --summarize"
      }
    ]
  }
]
```

**For events without matcher:**

```json
"Stop": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "uv run \"$OBSERVABILITY_HOME/.claude/hooks/stop.py\" --chat"
      },
      {
        "type": "command",
        "command": "uv run \"$OBSERVABILITY_HOME/.claude/hooks/send_event.py\" --source-app my-project --event-type Stop --add-chat"
      }
    ]
  }
]
```

### Step 5: Write the File

Write the updated JSON back to `settings.local.json` with 2-space indentation.

### Step 6: Show Summary

Display a summary like:

```
Observability hooks configured!

  Source app:    {SOURCE_APP}
  Settings file: .claude/settings.local.json
  Event types:   12 configured
  Dashboard:     http://localhost:5173

  Hooks added for:
    PreToolUse, PostToolUse, Stop, UserPromptSubmit,
    SessionStart, SessionEnd, SubagentStart, SubagentStop,
    Notification, PreCompact, PermissionRequest, PostToolUseFailure

  Existing hooks were preserved (observability hooks appended).
```

If any events were skipped (already had send_event.py), mention which ones.
