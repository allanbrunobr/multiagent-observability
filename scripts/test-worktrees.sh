#!/bin/bash
# Simulates 3 worktrees from the same repo to test the Worktrees UI
# Usage: bash scripts/test-worktrees.sh

API="http://localhost:4000/events"
NOW_MS=$(python3 -c "import time; print(int(time.time()*1000))")
REPO_ID="abc123def456"
REPO_NAME="my-awesome-app"

SESSION_MAIN="aaaa1111-0000-0000-0000-000000000001"
SESSION_AUTH="bbbb2222-0000-0000-0000-000000000002"
SESSION_UI="cccc3333-0000-0000-0000-000000000003"

APP_MAIN="wt-main"
APP_AUTH="wt-feat-auth"
APP_UI="wt-feat-ui"

send() {
  local payload="$1"
  local label="$2"
  curl -s -X POST "$API" -H "Content-Type: application/json" -d "$payload" > /dev/null
  echo "  -> $label"
}

echo "=== Worktree Test Script ==="
echo ""

# ── 1. SessionStart for all 3 worktrees ──
echo "[1/5] SessionStart for 3 worktrees..."

T=$((NOW_MS - 300000))
send "{\"source_app\":\"$APP_MAIN\",\"session_id\":\"$SESSION_MAIN\",\"hook_event_type\":\"SessionStart\",\"payload\":{\"git_metadata\":{\"repo_id\":\"$REPO_ID\",\"repo_name\":\"$REPO_NAME\",\"branch\":\"main\",\"worktree_path\":\"/Users/bruno/projects/my-awesome-app\",\"is_worktree\":false},\"source\":\"cli\"},\"summary\":\"Session started on main\",\"timestamp\":$T,\"model_name\":\"claude-opus-4-6\"}" \
  "$APP_MAIN | SessionStart main"

T=$((NOW_MS - 280000))
send "{\"source_app\":\"$APP_AUTH\",\"session_id\":\"$SESSION_AUTH\",\"hook_event_type\":\"SessionStart\",\"payload\":{\"git_metadata\":{\"repo_id\":\"$REPO_ID\",\"repo_name\":\"$REPO_NAME\",\"branch\":\"feat/auth-oauth2\",\"worktree_path\":\"/Users/bruno/projects/my-awesome-app-wt/feat-auth-oauth2\",\"is_worktree\":true},\"source\":\"cli\"},\"summary\":\"Session started on feat/auth-oauth2\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "$APP_AUTH | SessionStart feat/auth-oauth2"

T=$((NOW_MS - 260000))
send "{\"source_app\":\"$APP_UI\",\"session_id\":\"$SESSION_UI\",\"hook_event_type\":\"SessionStart\",\"payload\":{\"git_metadata\":{\"repo_id\":\"$REPO_ID\",\"repo_name\":\"$REPO_NAME\",\"branch\":\"feat/dashboard-redesign\",\"worktree_path\":\"/Users/bruno/projects/my-awesome-app-wt/feat-dashboard-redesign\",\"is_worktree\":true},\"source\":\"cli\"},\"summary\":\"Session started on feat/dashboard-redesign\",\"timestamp\":$T,\"model_name\":\"claude-haiku-4-5-20251001\"}" \
  "$APP_UI | SessionStart feat/dashboard-redesign"

sleep 0.2

# ── 2. Activity on main worktree ──
echo "[2/5] Tool activity on main..."

T=$((NOW_MS - 200000))
send "{\"source_app\":\"$APP_MAIN\",\"session_id\":\"$SESSION_MAIN\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\"/src/index.ts\"}},\"summary\":\"Reading src/index.ts\",\"timestamp\":$T,\"model_name\":\"claude-opus-4-6\"}" \
  "$APP_MAIN | PreToolUse Read"

T=$((NOW_MS - 198000))
send "{\"source_app\":\"$APP_MAIN\",\"session_id\":\"$SESSION_MAIN\",\"hook_event_type\":\"PostToolUse\",\"payload\":{\"tool_name\":\"Read\",\"tool_response\":\"file contents\"},\"summary\":\"Read 245 lines\",\"timestamp\":$T,\"model_name\":\"claude-opus-4-6\"}" \
  "$APP_MAIN | PostToolUse Read"

T=$((NOW_MS - 150000))
send "{\"source_app\":\"$APP_MAIN\",\"session_id\":\"$SESSION_MAIN\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"/src/index.ts\"}},\"summary\":\"Editing index.ts\",\"timestamp\":$T,\"model_name\":\"claude-opus-4-6\"}" \
  "$APP_MAIN | PreToolUse Edit"

T=$((NOW_MS - 148000))
send "{\"source_app\":\"$APP_MAIN\",\"session_id\":\"$SESSION_MAIN\",\"hook_event_type\":\"PostToolUse\",\"payload\":{\"tool_name\":\"Edit\",\"tool_response\":\"success\"},\"summary\":\"Edited index.ts\",\"timestamp\":$T,\"model_name\":\"claude-opus-4-6\"}" \
  "$APP_MAIN | PostToolUse Edit"

sleep 0.2

# ── 3. Heavy activity on auth worktree (will stay active) ──
echo "[3/5] Heavy activity on auth worktree..."

TOOLS=("Grep" "Read" "Edit" "Bash" "Glob" "Write")
SUMMARIES=("Searching auth patterns" "Reading auth middleware" "Updating OAuth config" "Running tests" "Finding route files" "Writing auth handler")

for i in 0 1 2 3 4 5; do
  T=$((NOW_MS - 120000 + i * 15000))
  send "{\"source_app\":\"$APP_AUTH\",\"session_id\":\"$SESSION_AUTH\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"${TOOLS[$i]}\",\"tool_input\":{}},\"summary\":\"${SUMMARIES[$i]}\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
    "$APP_AUTH | PreToolUse ${TOOLS[$i]}"

  T=$((T + 2000))
  send "{\"source_app\":\"$APP_AUTH\",\"session_id\":\"$SESSION_AUTH\",\"hook_event_type\":\"PostToolUse\",\"payload\":{\"tool_name\":\"${TOOLS[$i]}\",\"tool_response\":\"ok\"},\"summary\":\"Completed ${TOOLS[$i]}\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
    "$APP_AUTH | PostToolUse ${TOOLS[$i]}"
done

sleep 0.2

# ── 4. UI worktree: old activity only (will show as idle) ──
echo "[4/5] UI worktree (old activity -> idle)..."

T=$((NOW_MS - 250000))
send "{\"source_app\":\"$APP_UI\",\"session_id\":\"$SESSION_UI\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\"/src/App.vue\"}},\"summary\":\"Reading App.vue\",\"timestamp\":$T,\"model_name\":\"claude-haiku-4-5-20251001\"}" \
  "$APP_UI | PreToolUse Read (old)"

T=$((NOW_MS - 248000))
send "{\"source_app\":\"$APP_UI\",\"session_id\":\"$SESSION_UI\",\"hook_event_type\":\"PostToolUse\",\"payload\":{\"tool_name\":\"Read\",\"tool_response\":\"contents\"},\"summary\":\"Read App.vue\",\"timestamp\":$T,\"model_name\":\"claude-haiku-4-5-20251001\"}" \
  "$APP_UI | PostToolUse Read (old)"

sleep 0.2

# ── 5. Recent events to keep main + auth active ──
echo "[5/5] Recent events (keep main & auth active)..."

T=$((NOW_MS - 5000))
send "{\"source_app\":\"$APP_AUTH\",\"session_id\":\"$SESSION_AUTH\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"bun test\"}},\"summary\":\"Running bun test\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "$APP_AUTH | PreToolUse Bash (recent)"

T=$((NOW_MS - 3000))
send "{\"source_app\":\"$APP_AUTH\",\"session_id\":\"$SESSION_AUTH\",\"hook_event_type\":\"PostToolUse\",\"payload\":{\"tool_name\":\"Bash\",\"tool_response\":\"12 tests passed\"},\"summary\":\"All 12 tests passed\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "$APP_AUTH | PostToolUse Bash (recent)"

T=$((NOW_MS - 2000))
send "{\"source_app\":\"$APP_MAIN\",\"session_id\":\"$SESSION_MAIN\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"Grep\",\"tool_input\":{\"pattern\":\"TODO\"}},\"summary\":\"Searching for TODOs\",\"timestamp\":$T,\"model_name\":\"claude-opus-4-6\"}" \
  "$APP_MAIN | PreToolUse Grep (recent)"

sleep 0.2

# ── 6. Task events for auth worktree ──
echo "[6/7] Tasks for auth worktree..."

T=$((NOW_MS - 100000))
send "{\"source_app\":\"$APP_AUTH\",\"session_id\":\"$SESSION_AUTH\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskCreate\",\"tool_input\":{\"subject\":\"Implement OAuth2 flow\",\"description\":\"Add Google and GitHub OAuth2 providers with token refresh\",\"activeForm\":\"Implementing OAuth2 flow\"}},\"summary\":\"Creating task: OAuth2 flow\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "$APP_AUTH | TaskCreate: OAuth2 flow"

T=$((T + 1000))
send "{\"source_app\":\"$APP_AUTH\",\"session_id\":\"$SESSION_AUTH\",\"hook_event_type\":\"PostToolUse\",\"payload\":{\"tool_name\":\"TaskCreate\",\"tool_input\":{\"subject\":\"Implement OAuth2 flow\",\"description\":\"Add Google and GitHub OAuth2 providers with token refresh\",\"activeForm\":\"Implementing OAuth2 flow\"},\"tool_response\":{\"task\":{\"id\":\"1\",\"subject\":\"Implement OAuth2 flow\"}}},\"summary\":\"Task #1 created\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "$APP_AUTH | TaskCreate resolved -> #1"

T=$((T + 1000))
send "{\"source_app\":\"$APP_AUTH\",\"session_id\":\"$SESSION_AUTH\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskCreate\",\"tool_input\":{\"subject\":\"Add session middleware\",\"description\":\"Create Express-style session middleware with Redis store\",\"activeForm\":\"Adding session middleware\"}},\"summary\":\"Creating task: session middleware\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "$APP_AUTH | TaskCreate: session middleware"

T=$((T + 1000))
send "{\"source_app\":\"$APP_AUTH\",\"session_id\":\"$SESSION_AUTH\",\"hook_event_type\":\"PostToolUse\",\"payload\":{\"tool_name\":\"TaskCreate\",\"tool_input\":{\"subject\":\"Add session middleware\",\"description\":\"Create Express-style session middleware with Redis store\"},\"tool_response\":{\"task\":{\"id\":\"2\",\"subject\":\"Add session middleware\"}}},\"summary\":\"Task #2 created\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "$APP_AUTH | TaskCreate resolved -> #2"

T=$((T + 1000))
send "{\"source_app\":\"$APP_AUTH\",\"session_id\":\"$SESSION_AUTH\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskCreate\",\"tool_input\":{\"subject\":\"Write auth tests\",\"description\":\"Unit and integration tests for OAuth2 and session flows\",\"activeForm\":\"Writing auth tests\"}},\"summary\":\"Creating task: auth tests\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "$APP_AUTH | TaskCreate: auth tests"

T=$((T + 1000))
send "{\"source_app\":\"$APP_AUTH\",\"session_id\":\"$SESSION_AUTH\",\"hook_event_type\":\"PostToolUse\",\"payload\":{\"tool_name\":\"TaskCreate\",\"tool_input\":{\"subject\":\"Write auth tests\",\"description\":\"Unit and integration tests for OAuth2 and session flows\"},\"tool_response\":{\"task\":{\"id\":\"3\",\"subject\":\"Write auth tests\"}}},\"summary\":\"Task #3 created\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "$APP_AUTH | TaskCreate resolved -> #3"

# Update task #1 to in_progress
T=$((T + 5000))
send "{\"source_app\":\"$APP_AUTH\",\"session_id\":\"$SESSION_AUTH\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"taskId\":\"1\",\"status\":\"in_progress\",\"owner\":\"auth-builder\"}},\"summary\":\"Task #1 in progress\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "$APP_AUTH | TaskUpdate #1 -> in_progress"

# Complete task #1
T=$((T + 30000))
send "{\"source_app\":\"$APP_AUTH\",\"session_id\":\"$SESSION_AUTH\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"taskId\":\"1\",\"status\":\"completed\"}},\"summary\":\"Task #1 completed\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "$APP_AUTH | TaskUpdate #1 -> completed"

# Task #2 in_progress
T=$((T + 2000))
send "{\"source_app\":\"$APP_AUTH\",\"session_id\":\"$SESSION_AUTH\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"taskId\":\"2\",\"status\":\"in_progress\",\"owner\":\"auth-builder\"}},\"summary\":\"Task #2 in progress\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "$APP_AUTH | TaskUpdate #2 -> in_progress"

sleep 0.2

# ── 7. Tasks for main worktree ──
echo "[7/7] Tasks for main worktree..."

T=$((NOW_MS - 90000))
send "{\"source_app\":\"$APP_MAIN\",\"session_id\":\"$SESSION_MAIN\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskCreate\",\"tool_input\":{\"subject\":\"Fix CI pipeline\",\"description\":\"Debug failing GitHub Actions workflow for deploy stage\",\"activeForm\":\"Fixing CI pipeline\"}},\"summary\":\"Creating task: fix CI\",\"timestamp\":$T,\"model_name\":\"claude-opus-4-6\"}" \
  "$APP_MAIN | TaskCreate: Fix CI pipeline"

T=$((T + 1000))
send "{\"source_app\":\"$APP_MAIN\",\"session_id\":\"$SESSION_MAIN\",\"hook_event_type\":\"PostToolUse\",\"payload\":{\"tool_name\":\"TaskCreate\",\"tool_input\":{\"subject\":\"Fix CI pipeline\",\"description\":\"Debug failing GitHub Actions workflow for deploy stage\"},\"tool_response\":{\"task\":{\"id\":\"1\",\"subject\":\"Fix CI pipeline\"}}},\"summary\":\"Task #1 created\",\"timestamp\":$T,\"model_name\":\"claude-opus-4-6\"}" \
  "$APP_MAIN | TaskCreate resolved -> #1"

T=$((T + 1000))
send "{\"source_app\":\"$APP_MAIN\",\"session_id\":\"$SESSION_MAIN\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskCreate\",\"tool_input\":{\"subject\":\"Update README\",\"description\":\"Add setup instructions and API docs for new endpoints\",\"activeForm\":\"Updating README\"}},\"summary\":\"Creating task: README\",\"timestamp\":$T,\"model_name\":\"claude-opus-4-6\"}" \
  "$APP_MAIN | TaskCreate: Update README"

T=$((T + 1000))
send "{\"source_app\":\"$APP_MAIN\",\"session_id\":\"$SESSION_MAIN\",\"hook_event_type\":\"PostToolUse\",\"payload\":{\"tool_name\":\"TaskCreate\",\"tool_input\":{\"subject\":\"Update README\",\"description\":\"Add setup instructions and API docs for new endpoints\"},\"tool_response\":{\"task\":{\"id\":\"2\",\"subject\":\"Update README\"}}},\"summary\":\"Task #2 created\",\"timestamp\":$T,\"model_name\":\"claude-opus-4-6\"}" \
  "$APP_MAIN | TaskCreate resolved -> #2"

# Complete task #1
T=$((T + 20000))
send "{\"source_app\":\"$APP_MAIN\",\"session_id\":\"$SESSION_MAIN\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"taskId\":\"1\",\"status\":\"in_progress\",\"owner\":\"lead\"}},\"summary\":\"Task #1 in progress\",\"timestamp\":$T,\"model_name\":\"claude-opus-4-6\"}" \
  "$APP_MAIN | TaskUpdate #1 -> in_progress"

T=$((T + 15000))
send "{\"source_app\":\"$APP_MAIN\",\"session_id\":\"$SESSION_MAIN\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"taskId\":\"1\",\"status\":\"completed\"}},\"summary\":\"Task #1 completed\",\"timestamp\":$T,\"model_name\":\"claude-opus-4-6\"}" \
  "$APP_MAIN | TaskUpdate #1 -> completed"

echo ""
echo "=== Expected Worktree UI ==="
echo ""
echo "  Repository: $REPO_NAME"
echo "  +-- main                     ($APP_MAIN)  -> ACTIVE  (green dot, ~2s ago)"
echo "  +-- feat/auth-oauth2         ($APP_AUTH)   -> ACTIVE  (green dot, ~3s ago)"
echo "  +-- feat/dashboard-redesign  ($APP_UI)     -> IDLE    (yellow dot, ~4min ago)"
echo ""
echo ""
echo "  Click any worktree card to expand its Kanban:"
echo "  - main:             2 tasks (1 completed, 1 pending)"
echo "  - feat/auth-oauth2: 3 tasks (1 completed, 1 in_progress, 1 pending)"
echo "  - feat/dashboard:   0 tasks (empty state)"
echo ""
echo "Total: 3 worktrees, 5 tasks, ~45 events sent."
echo "Open http://localhost:5173 -> Worktrees tab"
