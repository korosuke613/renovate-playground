#!/usr/bin/env bash

set -euo pipefail

# default branch
echo "Renovate dry-run (default branch)"
git switch main

LOG_LEVEL=debug \
LOG_FORMAT=json \
renovate --token $TMP_GH_TOKEN --dry-run --print-config --schedule= korosuke613/renovate-playground > ./dist/json_default_branch.log

# topic branch
echo "Renovate dry-run (topic branch)"
git switch -

LOG_LEVEL=debug \
LOG_FORMAT=json \
RENOVATE_CONFIG_FILE=force-local-renovate-config.js \
renovate --token $TMP_GH_TOKEN --dry-run --print-config --schedule= korosuke613/renovate-playground > ./dist/json_topic_branch.log

deno run --allow-net --allow-run --allow-read --allow-env --allow-write ./tools/compare-renovate-logs.ts

delta --max-line-length 0 --paging never ./dist/default_branch_log.json ./dist/topic_branch_log.json
