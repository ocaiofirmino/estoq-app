#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
export ESTOQ_OPEN_BROWSER=1
exec node --env-file-if-exists=.env.local scripts/local-server.mjs
