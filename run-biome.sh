#!/bin/bash
. ./bin/activate-hermit
echo "Running biome in desktop..."
cd desktop && pnpm exec biome check --write --unsafe .
echo "Running biome in web..."
cd ../web && pnpm exec biome check --write --unsafe .
