#!/bin/bash
# Fast hook wrapper — reads stdin, backgrounds the node CLI, exits immediately.
# Claude Code hooks block until the command exits. By backgrounding node and
# redirecting all file descriptors, bash exits in ~2-5ms instead of ~50-100ms.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
input=$(cat)
echo "$input" | node "$SCRIPT_DIR/observe_cli.mjs" hook > /dev/null 2>&1 &
exit 0
