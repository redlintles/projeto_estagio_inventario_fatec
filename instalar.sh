#!/usr/bin/env bash
# Unica entrada para instalar/configurar/iniciar a producao no Linux.
set -Eeuo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
umask 077
trap 'echo "Não foi possível concluir. Leia a mensagem acima e LEIA-ME-PRIMEIRO.txt. Dados preservados; execute bash instalar.sh novamente." >&2' ERR
if ! command -v docker >/dev/null; then
  echo 'Instale o Docker manualmente e execute bash instalar.sh novamente. Consulte LEIA-ME-PRIMEIRO.txt.'; exit 1
fi
if [[ -e producao/.env && ! -r producao/.env ]]; then
  echo 'A instalação pertence ao administrador. O Linux pedirá sua senha.'
  exec sudo bash "$PWD/instalar.sh"
fi
if ! docker info >/dev/null 2>&1; then
  if (( EUID != 0 )); then
    echo 'O Linux pedirá sua senha para acessar/iniciar o Docker.'
    exec sudo bash "$PWD/instalar.sh"
  fi
  systemctl start docker
  docker info >/dev/null
fi
version=$(docker compose version --short)
version=${version#v}; version=${version%%-*}
IFS=. read -r major minor patch <<< "$version"
if (( major < 2 || (major == 2 && (minor < 24 || (minor == 24 && ${patch:-0} < 4))) )); then
  echo 'Atualize o Docker e o plugin Compose. É necessário Compose 2.24.4 ou superior.'; exit 1
fi
mkdir -p producao
chmod 700 producao
host=localhost
if command -v ip >/dev/null; then
  interface=$({ ip -4 route show default 2>/dev/null || true; } | awk 'NR==1 {for(i=1;i<=NF;i++) if($i=="dev") print $(i+1)}')
  if [[ -n "$interface" ]]; then
    detected=$({ ip -o -4 addr show dev "$interface" scope global 2>/dev/null || true; } | awk 'NR==1 {split($4,a,"/"); print a[1]}')
    host=${detected:-localhost}
  fi
fi
busy=''
if command -v ss >/dev/null; then
  busy=$({ ss -H -ltn 2>/dev/null || true; } | awk '{n=split($4,a,":"); print a[n]}' | sort -u | paste -sd, -)
fi
port=443
if [[ ,$busy, == *,443,* ]]; then port=8443; fi
supported=false
security=$(docker info --format '{{json .SecurityOptions}}')
if [[ -d /run/systemd/system && "$security" != *rootless* ]] && systemctl cat docker.service >/dev/null 2>&1; then supported=true; fi
user_args=(--user "$(id -u):$(id -g)")
if [[ "$security" == *rootless* ]]; then user_args=(); port=8443; fi
interactive=(-i)
if [[ -t 0 && -t 1 ]]; then interactive=(-it); fi
docker run --rm "${interactive[@]}" "${user_args[@]}" --mount "type=bind,source=$PWD/producao,target=/config" --mount "type=bind,source=$PWD/scripts/production-setup.mjs,target=/setup.mjs,readonly" -e SETUP_OS=linux -e "DEFAULT_HOST=$host" -e "DEFAULT_PORT=$port" -e "BUSY_PORTS=$busy" -e "AUTO_SUPPORTED=$supported" node:24-alpine node /setup.mjs
bash producao.sh
bash scripts/production-host-linux.sh
get_value() { sed -n "s/^$1=//p" producao/.env | tr -d '\r'; }
echo
echo "INSTALAÇÃO CONCLUÍDA: https://$(get_value SITE_HOST)$(get_value SITE_PORT_SUFFIX)"
echo 'Seu usuário e senha inicial estão em producao/ACESSO.txt (arquivo privado).'
echo 'Para iniciar novamente, use: bash instalar.sh'
if (( EUID != 0 )) && command -v xdg-open >/dev/null; then
  xdg-open "https://$(get_value SITE_HOST)$(get_value SITE_PORT_SUFFIX)" >/dev/null 2>&1 || true
fi
