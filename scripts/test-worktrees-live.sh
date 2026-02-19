#!/bin/bash
# Simulates a live multi-worktree session with tasks moving in real-time
# Usage: bash scripts/test-worktrees-live.sh

API="http://localhost:4000/events"
REPO_ID="live-demo-repo-001"
REPO_NAME="live-demo-app"

SESSION_MAIN="eeee1111-live-0000-0000-000000000001"
SESSION_API="ffff2222-live-0000-0000-000000000002"
SESSION_FE="gggg3333-live-0000-0000-000000000003"

APP_MAIN="live-main"
APP_API="live-feat-api"
APP_FE="live-feat-frontend"

now() { python3 -c "import time; print(int(time.time()*1000))"; }

send() {
  curl -s -X POST "$API" -H "Content-Type: application/json" -d "$1" > /dev/null
  echo "  $2"
}

echo ""
echo "========================================="
echo "   LIVE WORKTREE + KANBAN SIMULATION"
echo "========================================="
echo ""
echo "  Open http://localhost:5173 -> Worktrees tab"
echo "  Click on a worktree card to see its Kanban"
echo ""
echo "  3 worktrees: main, feat/api-v2, feat/new-ui"
echo "  Watch tasks move between columns in real-time!"
echo ""
echo "-----------------------------------------"

# ══════════════════════════════════════════════
# PHASE 1: Session Start (all 3 worktrees)
# ══════════════════════════════════════════════
echo ""
echo "[Phase 1] Starting 3 worktree sessions..."

T=$(now)
send "{\"source_app\":\"$APP_MAIN\",\"session_id\":\"$SESSION_MAIN\",\"hook_event_type\":\"SessionStart\",\"payload\":{\"git_metadata\":{\"repo_id\":\"$REPO_ID\",\"repo_name\":\"$REPO_NAME\",\"branch\":\"main\",\"worktree_path\":\"/projects/live-demo-app\",\"is_worktree\":false},\"source\":\"cli\"},\"summary\":\"Session started on main\",\"timestamp\":$T,\"model_name\":\"claude-opus-4-6\"}" \
  "main         | SessionStart"

sleep 0.5
T=$(now)
send "{\"source_app\":\"$APP_API\",\"session_id\":\"$SESSION_API\",\"hook_event_type\":\"SessionStart\",\"payload\":{\"git_metadata\":{\"repo_id\":\"$REPO_ID\",\"repo_name\":\"$REPO_NAME\",\"branch\":\"feat/api-v2\",\"worktree_path\":\"/projects/live-demo-app-wt/feat-api-v2\",\"is_worktree\":true},\"source\":\"cli\"},\"summary\":\"Session started on feat/api-v2\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "feat/api-v2  | SessionStart"

sleep 0.5
T=$(now)
send "{\"source_app\":\"$APP_FE\",\"session_id\":\"$SESSION_FE\",\"hook_event_type\":\"SessionStart\",\"payload\":{\"git_metadata\":{\"repo_id\":\"$REPO_ID\",\"repo_name\":\"$REPO_NAME\",\"branch\":\"feat/new-ui\",\"worktree_path\":\"/projects/live-demo-app-wt/feat-new-ui\",\"is_worktree\":true},\"source\":\"cli\"},\"summary\":\"Session started on feat/new-ui\",\"timestamp\":$T,\"model_name\":\"claude-haiku-4-5-20251001\"}" \
  "feat/new-ui  | SessionStart"

sleep 2

# ══════════════════════════════════════════════
# PHASE 2: Create tasks on API worktree
# ══════════════════════════════════════════════
echo ""
echo "[Phase 2] Creating tasks on feat/api-v2..."

TASKS_API=("Design REST endpoints" "Implement auth middleware" "Add rate limiting" "Write API tests")
DESCS_API=(
  "Design RESTful endpoints for users, products, and orders resources"
  "JWT-based auth middleware with refresh token rotation"
  "Token bucket rate limiter with Redis backend, 100 req/min per user"
  "Integration tests for all endpoints with mock database"
)
ACTIVE_API=("Designing REST endpoints" "Implementing auth middleware" "Adding rate limiting" "Writing API tests")

for i in 0 1 2 3; do
  sleep 1.5
  T=$(now)
  ID=$((i + 1))
  send "{\"source_app\":\"$APP_API\",\"session_id\":\"$SESSION_API\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskCreate\",\"tool_input\":{\"subject\":\"${TASKS_API[$i]}\",\"description\":\"${DESCS_API[$i]}\",\"activeForm\":\"${ACTIVE_API[$i]}\"}},\"summary\":\"Creating: ${TASKS_API[$i]}\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
    "feat/api-v2  | TaskCreate: ${TASKS_API[$i]}"

  sleep 0.3
  T=$(now)
  send "{\"source_app\":\"$APP_API\",\"session_id\":\"$SESSION_API\",\"hook_event_type\":\"PostToolUse\",\"payload\":{\"tool_name\":\"TaskCreate\",\"tool_input\":{\"subject\":\"${TASKS_API[$i]}\",\"description\":\"${DESCS_API[$i]}\"},\"tool_response\":{\"task\":{\"id\":\"$ID\",\"subject\":\"${TASKS_API[$i]}\"}}},\"summary\":\"Task #$ID created\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
    "feat/api-v2  | -> Task #$ID resolved"
done

sleep 2

# ══════════════════════════════════════════════
# PHASE 3: Create tasks on Frontend worktree
# ══════════════════════════════════════════════
echo ""
echo "[Phase 3] Creating tasks on feat/new-ui..."

TASKS_FE=("Setup Tailwind + dark mode" "Build dashboard layout" "Create data table component")
DESCS_FE=(
  "Configure Tailwind CSS v4 with automatic dark mode detection and theme tokens"
  "Responsive sidebar + header + main content area with collapsible navigation"
  "Sortable, filterable, paginated data table with virtual scrolling for 10k+ rows"
)
ACTIVE_FE=("Setting up Tailwind" "Building dashboard layout" "Creating data table")

for i in 0 1 2; do
  sleep 1.5
  T=$(now)
  ID=$((i + 1))
  send "{\"source_app\":\"$APP_FE\",\"session_id\":\"$SESSION_FE\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskCreate\",\"tool_input\":{\"subject\":\"${TASKS_FE[$i]}\",\"description\":\"${DESCS_FE[$i]}\",\"activeForm\":\"${ACTIVE_FE[$i]}\"}},\"summary\":\"Creating: ${TASKS_FE[$i]}\",\"timestamp\":$T,\"model_name\":\"claude-haiku-4-5-20251001\"}" \
    "feat/new-ui  | TaskCreate: ${TASKS_FE[$i]}"

  sleep 0.3
  T=$(now)
  send "{\"source_app\":\"$APP_FE\",\"session_id\":\"$SESSION_FE\",\"hook_event_type\":\"PostToolUse\",\"payload\":{\"tool_name\":\"TaskCreate\",\"tool_input\":{\"subject\":\"${TASKS_FE[$i]}\",\"description\":\"${DESCS_FE[$i]}\"},\"tool_response\":{\"task\":{\"id\":\"$ID\",\"subject\":\"${TASKS_FE[$i]}\"}}},\"summary\":\"Task #$ID created\",\"timestamp\":$T,\"model_name\":\"claude-haiku-4-5-20251001\"}" \
    "feat/new-ui  | -> Task #$ID resolved"
done

sleep 2

# ══════════════════════════════════════════════
# PHASE 4: Tasks start moving! API worktree
# ══════════════════════════════════════════════
echo ""
echo "[Phase 4] API agent starts working on tasks..."

# Task 1 -> in_progress
sleep 1
T=$(now)
send "{\"source_app\":\"$APP_API\",\"session_id\":\"$SESSION_API\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"taskId\":\"1\",\"status\":\"in_progress\",\"owner\":\"api-builder\"}},\"summary\":\"Starting task #1\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "feat/api-v2  | Task #1 -> IN PROGRESS (Design REST endpoints)"

# Simulate tool activity while working
sleep 2
T=$(now)
send "{\"source_app\":\"$APP_API\",\"session_id\":\"$SESSION_API\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\"/src/routes/index.ts\"}},\"summary\":\"Reading routes/index.ts\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "feat/api-v2  |   Reading routes file..."

sleep 2
T=$(now)
send "{\"source_app\":\"$APP_API\",\"session_id\":\"$SESSION_API\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"/src/routes/users.ts\"}},\"summary\":\"Writing users route\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "feat/api-v2  |   Writing users route..."

# Task 1 -> completed!
sleep 3
T=$(now)
send "{\"source_app\":\"$APP_API\",\"session_id\":\"$SESSION_API\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"taskId\":\"1\",\"status\":\"completed\"}},\"summary\":\"Task #1 done!\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "feat/api-v2  | Task #1 -> COMPLETED"

sleep 1

# Task 2 -> in_progress
T=$(now)
send "{\"source_app\":\"$APP_API\",\"session_id\":\"$SESSION_API\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"taskId\":\"2\",\"status\":\"in_progress\",\"owner\":\"api-builder\"}},\"summary\":\"Starting task #2\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "feat/api-v2  | Task #2 -> IN PROGRESS (Implement auth middleware)"

sleep 3

# ══════════════════════════════════════════════
# PHASE 5: Frontend agent starts working too
# ══════════════════════════════════════════════
echo ""
echo "[Phase 5] Frontend agent starts working in parallel..."

# FE Task 1 -> in_progress
T=$(now)
send "{\"source_app\":\"$APP_FE\",\"session_id\":\"$SESSION_FE\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"taskId\":\"1\",\"status\":\"in_progress\",\"owner\":\"ui-builder\"}},\"summary\":\"Starting task #1\",\"timestamp\":$T,\"model_name\":\"claude-haiku-4-5-20251001\"}" \
  "feat/new-ui  | Task #1 -> IN PROGRESS (Setup Tailwind)"

sleep 2
T=$(now)
send "{\"source_app\":\"$APP_FE\",\"session_id\":\"$SESSION_FE\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"bun add tailwindcss\"}},\"summary\":\"Installing Tailwind\",\"timestamp\":$T,\"model_name\":\"claude-haiku-4-5-20251001\"}" \
  "feat/new-ui  |   Installing Tailwind..."

sleep 2
T=$(now)
send "{\"source_app\":\"$APP_FE\",\"session_id\":\"$SESSION_FE\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"/tailwind.config.ts\"}},\"summary\":\"Writing Tailwind config\",\"timestamp\":$T,\"model_name\":\"claude-haiku-4-5-20251001\"}" \
  "feat/new-ui  |   Writing config..."

# FE Task 1 -> completed
sleep 2
T=$(now)
send "{\"source_app\":\"$APP_FE\",\"session_id\":\"$SESSION_FE\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"taskId\":\"1\",\"status\":\"completed\"}},\"summary\":\"Task #1 done!\",\"timestamp\":$T,\"model_name\":\"claude-haiku-4-5-20251001\"}" \
  "feat/new-ui  | Task #1 -> COMPLETED"

sleep 1

# FE Task 2 -> in_progress
T=$(now)
send "{\"source_app\":\"$APP_FE\",\"session_id\":\"$SESSION_FE\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"taskId\":\"2\",\"status\":\"in_progress\",\"owner\":\"ui-builder\"}},\"summary\":\"Starting task #2\",\"timestamp\":$T,\"model_name\":\"claude-haiku-4-5-20251001\"}" \
  "feat/new-ui  | Task #2 -> IN PROGRESS (Build dashboard layout)"

sleep 3

# ══════════════════════════════════════════════
# PHASE 6: Both agents completing tasks
# ══════════════════════════════════════════════
echo ""
echo "[Phase 6] Both agents completing tasks..."

# API Task 2 -> completed
T=$(now)
send "{\"source_app\":\"$APP_API\",\"session_id\":\"$SESSION_API\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"taskId\":\"2\",\"status\":\"completed\"}},\"summary\":\"Task #2 done!\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "feat/api-v2  | Task #2 -> COMPLETED"

sleep 1

# API Task 3 -> in_progress
T=$(now)
send "{\"source_app\":\"$APP_API\",\"session_id\":\"$SESSION_API\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"taskId\":\"3\",\"status\":\"in_progress\",\"owner\":\"api-builder\"}},\"summary\":\"Starting task #3\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "feat/api-v2  | Task #3 -> IN PROGRESS (Add rate limiting)"

sleep 3

# FE Task 2 -> completed
T=$(now)
send "{\"source_app\":\"$APP_FE\",\"session_id\":\"$SESSION_FE\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"taskId\":\"2\",\"status\":\"completed\"}},\"summary\":\"Task #2 done!\",\"timestamp\":$T,\"model_name\":\"claude-haiku-4-5-20251001\"}" \
  "feat/new-ui  | Task #2 -> COMPLETED"

sleep 1

# FE Task 3 -> in_progress
T=$(now)
send "{\"source_app\":\"$APP_FE\",\"session_id\":\"$SESSION_FE\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"taskId\":\"3\",\"status\":\"in_progress\",\"owner\":\"ui-builder\"}},\"summary\":\"Starting task #3\",\"timestamp\":$T,\"model_name\":\"claude-haiku-4-5-20251001\"}" \
  "feat/new-ui  | Task #3 -> IN PROGRESS (Create data table)"

sleep 3

# API Task 3 -> completed
T=$(now)
send "{\"source_app\":\"$APP_API\",\"session_id\":\"$SESSION_API\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"taskId\":\"3\",\"status\":\"completed\"}},\"summary\":\"Task #3 done!\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "feat/api-v2  | Task #3 -> COMPLETED"

sleep 1

# API Task 4 -> in_progress then completed
T=$(now)
send "{\"source_app\":\"$APP_API\",\"session_id\":\"$SESSION_API\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"taskId\":\"4\",\"status\":\"in_progress\",\"owner\":\"api-builder\"}},\"summary\":\"Starting task #4\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "feat/api-v2  | Task #4 -> IN PROGRESS (Write API tests)"

sleep 2
T=$(now)
send "{\"source_app\":\"$APP_API\",\"session_id\":\"$SESSION_API\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"bun test\"}},\"summary\":\"Running tests\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "feat/api-v2  |   Running bun test..."

sleep 3
T=$(now)
send "{\"source_app\":\"$APP_API\",\"session_id\":\"$SESSION_API\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"taskId\":\"4\",\"status\":\"completed\"}},\"summary\":\"Task #4 done!\",\"timestamp\":$T,\"model_name\":\"claude-sonnet-4-5-20250929\"}" \
  "feat/api-v2  | Task #4 -> COMPLETED  (all API tasks done!)"

sleep 2

# FE Task 3 -> completed
T=$(now)
send "{\"source_app\":\"$APP_FE\",\"session_id\":\"$SESSION_FE\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"taskId\":\"3\",\"status\":\"completed\"}},\"summary\":\"Task #3 done!\",\"timestamp\":$T,\"model_name\":\"claude-haiku-4-5-20251001\"}" \
  "feat/new-ui  | Task #3 -> COMPLETED  (all UI tasks done!)"

sleep 1

# ══════════════════════════════════════════════
# PHASE 7: Main creates a task for integration
# ══════════════════════════════════════════════
echo ""
echo "[Phase 7] Main branch - integration task..."

T=$(now)
send "{\"source_app\":\"$APP_MAIN\",\"session_id\":\"$SESSION_MAIN\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskCreate\",\"tool_input\":{\"subject\":\"Merge and deploy\",\"description\":\"Merge feat/api-v2 and feat/new-ui, run full test suite, deploy to staging\",\"activeForm\":\"Merging and deploying\"}},\"summary\":\"Creating integration task\",\"timestamp\":$T,\"model_name\":\"claude-opus-4-6\"}" \
  "main         | TaskCreate: Merge and deploy"

sleep 0.3
T=$(now)
send "{\"source_app\":\"$APP_MAIN\",\"session_id\":\"$SESSION_MAIN\",\"hook_event_type\":\"PostToolUse\",\"payload\":{\"tool_name\":\"TaskCreate\",\"tool_input\":{\"subject\":\"Merge and deploy\",\"description\":\"Merge feat/api-v2 and feat/new-ui, run full test suite, deploy to staging\"},\"tool_response\":{\"task\":{\"id\":\"1\",\"subject\":\"Merge and deploy\"}}},\"summary\":\"Task #1 created\",\"timestamp\":$T,\"model_name\":\"claude-opus-4-6\"}" \
  "main         | -> Task #1 resolved"

sleep 2
T=$(now)
send "{\"source_app\":\"$APP_MAIN\",\"session_id\":\"$SESSION_MAIN\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"taskId\":\"1\",\"status\":\"in_progress\",\"owner\":\"lead\"}},\"summary\":\"Starting merge\",\"timestamp\":$T,\"model_name\":\"claude-opus-4-6\"}" \
  "main         | Task #1 -> IN PROGRESS"

sleep 3
T=$(now)
send "{\"source_app\":\"$APP_MAIN\",\"session_id\":\"$SESSION_MAIN\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git merge feat/api-v2\"}},\"summary\":\"Merging api-v2\",\"timestamp\":$T,\"model_name\":\"claude-opus-4-6\"}" \
  "main         |   Merging feat/api-v2..."

sleep 2
T=$(now)
send "{\"source_app\":\"$APP_MAIN\",\"session_id\":\"$SESSION_MAIN\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git merge feat/new-ui\"}},\"summary\":\"Merging new-ui\",\"timestamp\":$T,\"model_name\":\"claude-opus-4-6\"}" \
  "main         |   Merging feat/new-ui..."

sleep 2
T=$(now)
send "{\"source_app\":\"$APP_MAIN\",\"session_id\":\"$SESSION_MAIN\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"tool_name\":\"TaskUpdate\",\"tool_input\":{\"taskId\":\"1\",\"status\":\"completed\"}},\"summary\":\"Deploy complete!\",\"timestamp\":$T,\"model_name\":\"claude-opus-4-6\"}" \
  "main         | Task #1 -> COMPLETED"

echo ""
echo "========================================="
echo "   SIMULATION COMPLETE!"
echo "========================================="
echo ""
echo "  Final state:"
echo "  feat/api-v2:  4/4 tasks completed (100%)"
echo "  feat/new-ui:  3/3 tasks completed (100%)"
echo "  main:         1/1 tasks completed (100%)"
echo ""
echo "  All progress bars should show green 100%"
echo "========================================="
