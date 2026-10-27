#!/usr/bin/env bash
set -Eeuo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
umask 077
action="${1:-iniciar}"
case "$action" in iniciar|parar|status|logs|backup) ;; *) echo 'Use: bash producao.sh [iniciar|parar|status|logs|backup]'; exit 1;; esac
trap 'echo "Não foi possível concluir. Leia a mensagem acima. Consulte docs/PRODUCAO.md. Os dados foram preservados." >&2' ERR
if ! command -v docker >/dev/null; then
  echo 'Docker não instalado. Leia docs/PRODUCAO.md, etapa de instalação do Docker.'; exit 1
fi
docker info >/dev/null
docker compose version
mkdir -p producao
chmod 700 producao
if [[ ! -f producao/.env ]]; then
  [[ "$action" == iniciar ]] || { echo 'Execute primeiro: bash producao.sh'; exit 1; }
  read -r -p 'IP fixo ou nome deste servidor (exemplo: 192.168.1.50): ' host
  temporary=$(mktemp producao/config.XXXXXX)
  if docker run --rm --mount "type=bind,source=$PWD/scripts/production-config.mjs,target=/setup.mjs,readonly" node:24-alpine node /setup.mjs "$host" --stdout > "$temporary"; then
    mv "$temporary" producao/.env
  else
    rm -f "$temporary"
    echo 'Não foi possível gerar a configuração. Confira o endereço informado e tente novamente.'
    exit 1
  fi
fi
chmod 600 producao/.env
compose=(docker compose --env-file producao/.env -f infra/compose.production.yaml)
case "$action" in
  iniciar)
    echo 'Preparando o sistema. A primeira execução pode demorar vários minutos.'
    "${compose[@]}" up --build -d --wait --wait-timeout 300
    if [[ $(sed -n 's/^TLS_MODE=//p' producao/.env | tr -d '\r') == internal ]]; then
      "${compose[@]}" cp gateway:/data/caddy/pki/authorities/local/root.crt producao/certificado-local.crt
    fi
    echo 'Serviços iniciados. Endereço: https://'"$(sed -n 's/^SITE_HOST=//p' producao/.env | tr -d '\r')$(sed -n 's/^SITE_PORT_SUFFIX=//p' producao/.env | tr -d '\r')"
    echo "Login inicial: $(sed -n 's/^BOOTSTRAP_EMAIL=//p' producao/.env | tr -d '\r'). Consulte producao/ACESSO.txt; em instalações antigas, producao/.env."
    echo 'Instale o certificado conforme docs/PRODUCAO.md antes de acessar. API do celular: mesmo endereço acrescido de /api.'
    ;;
  parar) "${compose[@]}" stop; echo 'Sistema parado. Dados preservados.' ;;
  status) "${compose[@]}" ps -a ;;
  logs) "${compose[@]}" logs --tail=100 ;;
  backup)
    destination="producao/backups/$(date -u +%Y%m%dT%H%M%SZ)"
    mkdir -p "$destination"
    # Interrompe gravações; em caso de falha, mantém parado para não mascarar o erro.
    "${compose[@]}" stop gateway web backend
    "${compose[@]}" exec -T database pg_dump -U patrimonio -d patrimonio -Fc > "$destination/banco.dump"
    "${compose[@]}" run --rm --no-deps -T --entrypoint tar backend czf - -C /app/uploads . > "$destination/fotos.tar.gz"
    cp producao/.env "$destination/config.env"
    "${compose[@]}" cp gateway:/data/caddy "$destination/caddy"
    echo 'Backup concluído em:' "$destination"
    echo 'Copie a pasta para armazenamento externo protegido. Reinicie: bash producao.sh'
    ;;
esac
