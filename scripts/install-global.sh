#!/usr/bin/env bash
# install-global.sh — Install observability hooks at user-level (~/.claude/)
# After running this once, ANY Claude Code session in ANY project sends events
# to the observability dashboard automatically.
#
# Usage: bash scripts/install-global.sh
#
# Idempotent: safe to re-run. Overwrites hooks + plist, merges settings.json.

set -euo pipefail

# ─── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC_HOOKS="$PROJECT_DIR/.claude/hooks"
DST_HOOKS="$HOME/.claude/hooks/observability"
SETTINGS="$HOME/.claude/settings.json"
PLIST_NAME="com.observability.server"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
LOG_DIR="$HOME/.claude/logs"
SERVER_ENTRY="$PROJECT_DIR/apps/server/src/index.ts"

# Find bun
BUN_PATH="${BUN_PATH:-$(command -v bun 2>/dev/null || echo "$HOME/.bun/bin/bun")}"
if [[ ! -x "$BUN_PATH" ]]; then
    echo "ERROR: bun not found. Install it: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

echo "╔═══════════════════════════════════════════════════════╗"
echo "║   Observability Hooks — Global Installer             ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# ─── 1. Copy hook scripts ────────────────────────────────────────────────────
echo "→ [1/4] Copying hook scripts to $DST_HOOKS ..."
mkdir -p "$DST_HOOKS/utils/llm"

cp "$SRC_HOOKS/send_event.py"           "$DST_HOOKS/send_event.py"
cp "$SRC_HOOKS/utils/summarizer.py"     "$DST_HOOKS/utils/summarizer.py"
cp "$SRC_HOOKS/utils/model_extractor.py" "$DST_HOOKS/utils/model_extractor.py"
cp "$SRC_HOOKS/utils/llm/anth.py"       "$DST_HOOKS/utils/llm/anth.py"

# Create __init__.py files for Python packages
touch "$DST_HOOKS/utils/__init__.py"
touch "$DST_HOOKS/utils/llm/__init__.py"

# Patch send_event.py: add sys.path fix and make --source-app optional
# Only patch if not already patched (idempotent)
if ! grep -q "sys.path.insert(0, os.path.dirname" "$DST_HOOKS/send_event.py"; then
    # Add sys.path fix after the last stdlib import
    sed -i '' '/^from datetime import datetime$/a\
\
# Ensure imports work regardless of CWD\
import sys, os\
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
' "$DST_HOOKS/send_event.py"
fi

# Make --source-app optional with default
if grep -q "'--source-app', required=True" "$DST_HOOKS/send_event.py"; then
    sed -i '' "s/'--source-app', required=True, help='Source application name'/'--source-app', default='cc-observability', help='Source application name (default: cc-observability)'/" "$DST_HOOKS/send_event.py"
fi

chmod +x "$DST_HOOKS/send_event.py"
echo "  ✓ Hook scripts installed"

# ─── 2. Merge hooks into ~/.claude/settings.json ─────────────────────────────
echo "→ [2/4] Merging hooks into $SETTINGS ..."

HOOK_CMD="uv run ~/.claude/hooks/observability/send_event.py"

# Build the hooks JSON
HOOKS_JSON=$(cat <<'HOOKEOF'
{
  "SessionStart": [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type SessionStart"}]}],
  "SessionEnd": [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type SessionEnd"}]}],
  "UserPromptSubmit": [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type UserPromptSubmit --summarize"}]}],
  "PreToolUse": [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type PreToolUse --summarize"}]}],
  "PostToolUse": [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type PostToolUse --summarize"}]}],
  "PostToolUseFailure": [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type PostToolUseFailure --summarize"}]}],
  "PermissionRequest": [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type PermissionRequest --summarize"}]}],
  "Notification": [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type Notification --summarize"}]}],
  "SubagentStart": [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type SubagentStart"}]}],
  "SubagentStop": [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type SubagentStop"}]}],
  "Stop": [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type Stop --add-chat"}]}],
  "PreCompact": [{"hooks": [{"type": "command", "command": "uv run ~/.claude/hooks/observability/send_event.py --event-type PreCompact"}]}]
}
HOOKEOF
)

if [[ -f "$SETTINGS" ]]; then
    # Merge: add/replace .hooks key without touching env, enabledPlugins, etc.
    # Requires python3 (available on macOS by default)
    python3 - "$SETTINGS" "$HOOKS_JSON" <<'PYEOF'
import json, sys

settings_path = sys.argv[1]
hooks_json = sys.argv[2]

with open(settings_path, 'r') as f:
    settings = json.load(f)

hooks = json.loads(hooks_json)
settings['hooks'] = hooks

with open(settings_path, 'w') as f:
    json.dump(settings, f, indent=2)
    f.write('\n')

print("  ✓ Hooks merged into settings.json")
PYEOF
else
    # Create from scratch
    python3 -c "
import json
settings = {'hooks': json.loads('''$HOOKS_JSON''')}
with open('$SETTINGS', 'w') as f:
    json.dump(settings, f, indent=2)
    f.write('\n')
print('  ✓ settings.json created with hooks')
"
fi

# ─── 3. Install LaunchAgent ──────────────────────────────────────────────────
echo "→ [3/4] Installing LaunchAgent for observability server ..."
mkdir -p "$LOG_DIR"

cat > "$PLIST_DST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>

    <key>ProgramArguments</key>
    <array>
        <string>$BUN_PATH</string>
        <string>run</string>
        <string>$SERVER_ENTRY</string>
    </array>

    <key>WorkingDirectory</key>
    <string>$PROJECT_DIR/apps/server</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>

    <key>StandardOutPath</key>
    <string>$LOG_DIR/observability-server.log</string>

    <key>StandardErrorPath</key>
    <string>$LOG_DIR/observability-server.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PORT</key>
        <string>4000</string>
        <key>PATH</key>
        <string>$(dirname "$BUN_PATH"):/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
</dict>
</plist>
PLISTEOF

echo "  ✓ LaunchAgent plist written"

# ─── 4. Load LaunchAgent ─────────────────────────────────────────────────────
echo "→ [4/4] Loading LaunchAgent ..."

# Unload first if already loaded (idempotent)
launchctl bootout "gui/$(id -u)/$PLIST_NAME" 2>/dev/null || true
sleep 1
launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"

echo "  ✓ LaunchAgent loaded"

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║   Installation complete!                             ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
echo "Verify:"
echo "  1. Server:    curl http://localhost:4000/events/recent"
echo "  2. Dashboard: open http://localhost:5173"
echo "  3. Test:      cd /tmp && mkdir test && cd test && git init && claude"
echo "  4. Logs:      tail -f ~/.claude/logs/observability-server.log"
echo ""
echo "To uninstall:"
echo "  launchctl bootout gui/$(id -u)/$PLIST_NAME"
echo "  rm -rf ~/.claude/hooks/observability"
echo "  # Remove 'hooks' key from ~/.claude/settings.json"
