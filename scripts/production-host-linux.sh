#!/usr/bin/env bash
set -Eeuo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
get_value() { sed -n "s/^$1=//p" producao/.env | tr -d '\r'; }
port=$(get_value HTTPS_PORT); port=${port:-443}
[[ $port =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 ))
admin=()
if (( EUID != 0 )); then
  echo 'O Linux pedirá sua senha para confiar no HTTPS e preparar a inicialização.'
  sudo -v
  admin=(sudo)
fi
if [[ -f producao/certificado-local.crt ]]; then
  if command -v update-ca-certificates >/dev/null; then
    "${admin[@]}" install -m 644 producao/certificado-local.crt /usr/local/share/ca-certificates/fatec-patrimonio.crt
    "${admin[@]}" update-ca-certificates
  elif command -v update-ca-trust >/dev/null; then
    "${admin[@]}" install -m 644 producao/certificado-local.crt /etc/pki/ca-trust/source/anchors/fatec-patrimonio.crt
    "${admin[@]}" update-ca-trust extract
  else
    echo 'Não foi encontrado o gerenciador de certificados deste Linux. Peça ao responsável para instalar producao/certificado-local.crt.'
    exit 1
  fi
fi
# Só modifica firewalls conhecidos, e somente para a sub-rede ligada à rede padrão.
subnet=''
if command -v ip >/dev/null; then
  interface=$(ip -4 route show default | awk 'NR==1 {for(i=1;i<=NF;i++) if($i=="dev") print $(i+1)}')
  if [[ -n "$interface" ]]; then subnet=$(ip -4 route show dev "$interface" scope link | awk 'NR==1 {print $1}'); fi
fi
if [[ $(get_value BIND_ADDRESS) != 127.0.0.1 && $subnet =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/[0-9]+$ ]]; then
  if command -v ufw >/dev/null && "${admin[@]}" ufw status | grep -q 'Status: active'; then
    "${admin[@]}" ufw allow from "$subnet" to any port "$port" proto tcp
  elif command -v firewall-cmd >/dev/null && "${admin[@]}" firewall-cmd --state >/dev/null 2>&1; then
    rule="rule family=ipv4 source address=$subnet port port=$port protocol=tcp accept"
    "${admin[@]}" firewall-cmd --permanent --add-rich-rule="$rule"
    "${admin[@]}" firewall-cmd --reload
  fi
fi
unit=fatec-patrimonio.service
if [[ $(get_value SETUP_AUTOSTART) == s ]]; then
  # Somente Docker Engine administrado pelo systemd; a interface recusa outros casos.
  systemctl cat docker.service >/dev/null
  docker_path=$(command -v docker)
  # Escapa caminhos para a sintaxe de argumentos/specifiers do systemd.
  quote() { local value=$1; value=${value//\\/\\\\}; value=${value//\"/\\\"}; value=${value//%/%%}; value=${value//\$/\$\$}; printf '"%s"' "$value"; }
  executable=$(quote "$docker_path")
  env_file=$(quote "$PWD/producao/.env")
  compose_file=$(quote "$PWD/infra/compose.production.yaml")
  temporary=$(mktemp)
  trap 'rm -f "$temporary"' EXIT
  cat > "$temporary" <<UNIT
[Unit]
Description=Patrimonio Fatec
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=$executable compose --env-file $env_file -f $compose_file up --no-build --pull never -d --wait --wait-timeout 300
ExecStop=$executable compose --env-file $env_file -f $compose_file stop
TimeoutStartSec=360
TimeoutStopSec=120
[Install]
WantedBy=multi-user.target
UNIT
  "${admin[@]}" install -m 644 "$temporary" "/etc/systemd/system/$unit"
  "${admin[@]}" systemctl daemon-reload
  "${admin[@]}" systemctl enable docker.service "$unit"
  echo 'Início automático ao ligar o computador ativado.'
elif [[ -f /etc/systemd/system/$unit ]]; then
  "${admin[@]}" systemctl disable "$unit"
fi
