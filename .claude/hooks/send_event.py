#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "anthropic",
#     "python-dotenv",
# ]
# ///

"""
Multi-Agent Observability Hook Script
Sends Claude Code hook events to the observability server.

Supported event types (12 total):
  SessionStart, SessionEnd, UserPromptSubmit, PreToolUse, PostToolUse,
  PostToolUseFailure, PermissionRequest, Notification, SubagentStart,
  SubagentStop, Stop, PreCompact
"""

import json
import sys
import os
import argparse
import hashlib
import subprocess
import urllib.request
import urllib.error
from datetime import datetime
from utils.summarizer import generate_event_summary
from utils.model_extractor import get_model_from_transcript


def _get_git_metadata():
    """Extract git metadata for worktree grouping. Returns dict or None if not in a git repo."""
    try:
        def _run_git(cmd_args):
            result = subprocess.run(
                ['git'] + cmd_args,
                capture_output=True, text=True, timeout=5
            )
            if result.returncode != 0:
                return None
            return result.stdout.strip()

        # Check if we're in a git repo at all
        common_dir = _run_git(['rev-parse', '--git-common-dir'])
        if not common_dir:
            return None

        toplevel = _run_git(['rev-parse', '--show-toplevel'])
        if not toplevel:
            return None

        branch = _run_git(['rev-parse', '--abbrev-ref', 'HEAD']) or 'HEAD'

        abs_common_dir = os.path.abspath(common_dir)
        repo_id = hashlib.sha256(abs_common_dir.encode()).hexdigest()[:12]

        # repo_name: basename of the parent of common_dir
        # e.g. /path/to/myrepo/.git -> "myrepo"
        repo_name = os.path.basename(os.path.dirname(abs_common_dir))

        # is_worktree: true when common_dir != <toplevel>/.git
        expected_git_dir = os.path.join(toplevel, '.git')
        is_worktree = os.path.abspath(expected_git_dir) != abs_common_dir

        return {
            'repo_id': repo_id,
            'repo_name': repo_name,
            'branch': branch,
            'worktree_path': toplevel,
            'is_worktree': is_worktree,
        }
    except Exception:
        return None

def send_event_to_server(event_data, server_url='http://localhost:4000/events'):
    """Send event data to the observability server."""
    try:
        # Prepare the request
        req = urllib.request.Request(
            server_url,
            data=json.dumps(event_data).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'User-Agent': 'Claude-Code-Hook/1.0'
            }
        )
        
        # Send the request
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                return True
            else:
                print(f"Server returned status: {response.status}", file=sys.stderr)
                return False
                
    except urllib.error.URLError as e:
        print(f"Failed to send event: {e}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        return False

def _resolve_source_app(base_source_app):
    """
    Derive a unique source_app per worktree.

    In a git worktree, appends the branch name to distinguish it in the dashboard.
    e.g. "cc-hook-multi-agent-obvs" -> "cc-hook-multi-agent-obvs:feat/api-v2"

    For the main worktree (not a secondary worktree), returns the base name as-is.
    Env var SOURCE_APP_OVERRIDE takes full precedence if set.
    """
    override = os.environ.get('SOURCE_APP_OVERRIDE')
    if override:
        return override

    try:
        # Check if we're in a git worktree
        result = subprocess.run(
            ['git', 'rev-parse', '--git-common-dir'],
            capture_output=True, text=True, timeout=3
        )
        if result.returncode != 0:
            return base_source_app

        common_dir = os.path.abspath(result.stdout.strip())

        result = subprocess.run(
            ['git', 'rev-parse', '--show-toplevel'],
            capture_output=True, text=True, timeout=3
        )
        if result.returncode != 0:
            return base_source_app

        toplevel = result.stdout.strip()
        expected_git_dir = os.path.abspath(os.path.join(toplevel, '.git'))
        is_worktree = expected_git_dir != common_dir

        if not is_worktree:
            return base_source_app

        # Get current branch name for the worktree suffix
        result = subprocess.run(
            ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
            capture_output=True, text=True, timeout=3
        )
        branch = result.stdout.strip() if result.returncode == 0 else 'unknown'

        return f"{base_source_app}:{branch}"
    except Exception:
        return base_source_app


def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Send Claude Code hook events to observability server')
    parser.add_argument('--source-app', required=True, help='Source application name')
    parser.add_argument('--event-type', required=True, help='Hook event type (PreToolUse, PostToolUse, etc.)')
    parser.add_argument('--server-url', default='http://localhost:4000/events', help='Server URL')
    parser.add_argument('--add-chat', action='store_true', help='Include chat transcript if available')
    parser.add_argument('--summarize', action='store_true', help='Generate AI summary of the event')

    args = parser.parse_args()

    try:
        # Read hook data from stdin
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Failed to parse JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    # Resolve source_app: append branch name if running in a secondary worktree
    source_app = _resolve_source_app(args.source_app)

    # Extract model name from transcript (with caching)
    session_id = input_data.get('session_id', 'unknown')
    transcript_path = input_data.get('transcript_path', '')
    model_name = ''
    if transcript_path:
        model_name = get_model_from_transcript(session_id, transcript_path)

    # Prepare event data for server
    event_data = {
        'source_app': source_app,
        'session_id': session_id,
        'hook_event_type': args.event_type,
        'payload': input_data,
        'timestamp': int(datetime.now().timestamp() * 1000),
        'model_name': model_name
    }

    # Enrich SessionStart with git metadata for worktree grouping
    if args.event_type == 'SessionStart':
        git_metadata = _get_git_metadata()
        if git_metadata:
            event_data['payload']['git_metadata'] = git_metadata

    # Forward event-specific fields as top-level properties for easier querying.
    # These fields are only present for certain event types.

    # tool_name: PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest
    if 'tool_name' in input_data:
        event_data['tool_name'] = input_data['tool_name']

    # tool_use_id: PreToolUse, PostToolUse, PostToolUseFailure
    if 'tool_use_id' in input_data:
        event_data['tool_use_id'] = input_data['tool_use_id']

    # error, is_interrupt: PostToolUseFailure
    if 'error' in input_data:
        event_data['error'] = input_data['error']
    if 'is_interrupt' in input_data:
        event_data['is_interrupt'] = input_data['is_interrupt']

    # permission_suggestions: PermissionRequest
    if 'permission_suggestions' in input_data:
        event_data['permission_suggestions'] = input_data['permission_suggestions']

    # agent_id: SubagentStart, SubagentStop
    if 'agent_id' in input_data:
        event_data['agent_id'] = input_data['agent_id']

    # agent_type: SessionStart, SubagentStart, SubagentStop
    if 'agent_type' in input_data:
        event_data['agent_type'] = input_data['agent_type']

    # agent_transcript_path: SubagentStop
    if 'agent_transcript_path' in input_data:
        event_data['agent_transcript_path'] = input_data['agent_transcript_path']

    # stop_hook_active: Stop, SubagentStop
    if 'stop_hook_active' in input_data:
        event_data['stop_hook_active'] = input_data['stop_hook_active']

    # notification_type: Notification
    if 'notification_type' in input_data:
        event_data['notification_type'] = input_data['notification_type']

    # custom_instructions: PreCompact
    if 'custom_instructions' in input_data:
        event_data['custom_instructions'] = input_data['custom_instructions']

    # source: SessionStart
    if 'source' in input_data:
        event_data['source'] = input_data['source']

    # reason: SessionEnd
    if 'reason' in input_data:
        event_data['reason'] = input_data['reason']
    
    # Handle --add-chat option
    if args.add_chat and 'transcript_path' in input_data:
        transcript_path = input_data['transcript_path']
        if os.path.exists(transcript_path):
            # Read .jsonl file and convert to JSON array
            chat_data = []
            try:
                with open(transcript_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            try:
                                chat_data.append(json.loads(line))
                            except json.JSONDecodeError:
                                pass  # Skip invalid lines
                
                # Add chat to event data
                event_data['chat'] = chat_data
            except Exception as e:
                print(f"Failed to read transcript: {e}", file=sys.stderr)
    
    # Generate summary if requested
    if args.summarize:
        summary = generate_event_summary(event_data)
        if summary:
            event_data['summary'] = summary
        # Continue even if summary generation fails
    
    # Send to server
    success = send_event_to_server(event_data, args.server_url)
    
    # Always exit with 0 to not block Claude Code operations
    sys.exit(0)

if __name__ == '__main__':
    main()