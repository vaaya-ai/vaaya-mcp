#!/usr/bin/env bash
# SessionStart hook for the Vaaya plugin.
#
# Mirrors the superpowers plugin: read the forcing reminder from session-inject.md,
# JSON-escape it with bash parameter substitution (no external deps like jq), and
# print the structured `hookSpecificOutput.additionalContext` JSON that Claude Code
# injects into the agent's context. This is the reliable channel — preferred over
# raw stdout.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
payload="$(cat "${SCRIPT_DIR}/session-inject.md")"

# Escape a string for embedding inside a JSON string value.
escape_json() {
  local s="$1"
  s="${s//\\/\\\\}"   # backslash first
  s="${s//\"/\\\"}"   # double quotes
  s="${s//$'\n'/\\n}" # newlines
  s="${s//$'\r'/\\r}" # carriage returns
  s="${s//$'\t'/\\t}" # tabs
  printf '%s' "$s"
}

escaped="$(escape_json "$payload")"
printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$escaped"
