#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
case "${1:-}" in
  "") exec npm start ;;
  --rede) exec npm start ;;
  --local) exec npm run demo ;;
  --parar) exec npm run demo:stop ;;
  *) printf 'Uso: ./iniciar.sh [--rede|--local|--parar]\n' >&2; exit 2 ;;
esac
