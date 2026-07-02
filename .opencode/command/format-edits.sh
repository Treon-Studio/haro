#!/usr/bin/env bash

# This script is a hook for Claude Code.
# It runs `pnpm check` to auto-format any files that Claude edits.
echo "Running Biome formatter..."
pnpm check || echo "Biome check failed, but continuing..."
