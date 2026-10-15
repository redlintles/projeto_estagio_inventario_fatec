#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
case "${1:-}" in
  "") exec npm run demo ;;
  --rede) exec npm run demo:lan ;;
  --parar) exec npm run demo:stop ;;
  *) printf 'Uso: ./iniciar.sh [--rede|--parar]\n' >&2; exit 2 ;;
esac
