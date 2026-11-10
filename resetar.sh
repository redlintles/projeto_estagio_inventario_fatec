#!/usr/bin/env bash
# Apaga tudo o que a instalação de produção criou (containers, banco, fotos,
# configuração, firewall, certificado e início automático) e instala do zero.
# Antes de apagar, guarda banco, fotos e a pasta producao em reset-backups/<data>.
# Uso: bash resetar.sh [--sim] [--sem-reinstalar]
set -Eeuo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
umask 077
project=fatec-producao
label="label=com.docker.compose.project=$project"
unit=fatec-patrimonio.service
confirmed=false
reinstall=true
for arg in "$@"; do
  case "$arg" in
    --sim) confirmed=true ;;
    --sem-reinstalar) reinstall=false ;;
    *) echo 'Uso: bash resetar.sh [--sim] [--sem-reinstalar]'; exit 1 ;;
  esac
done
trap 'echo "O reset parou antes de terminar. Leia a mensagem acima. Nenhum dado é apagado antes da cópia de segurança; cópias ficam em reset-backups/." >&2' ERR

if ! command -v docker >/dev/null; then
  echo 'Docker não está instalado. Consulte LEIA-ME-PRIMEIRO.txt.'; exit 1
fi
if [[ -e producao/.env && ! -r producao/.env ]] || ! docker info >/dev/null 2>&1; then
  if (( EUID != 0 )); then
    echo 'A instalação pertence ao administrador ou o Docker exige permissão. O Linux pedirá sua senha.'
    exec sudo bash "$PWD/resetar.sh" "$@"
  fi
  systemctl start docker
  docker info >/dev/null
fi
as_admin() { if (( EUID == 0 )); then "$@"; else sudo "$@"; fi; }
get_value() { if [[ -f producao/.env ]]; then sed -n "s/^$1=//p" producao/.env | tr -d '\r'; fi; }
volume_exists() { docker volume inspect "$1" >/dev/null 2>&1; }

if ! $confirmed; then
  if [[ ! -t 0 ]]; then
    echo 'Sem terminal para confirmar. Para executar sem pergunta: bash resetar.sh --sim'; exit 1
  fi
  echo
  echo 'ATENÇÃO: o reset apaga a instalação atual do Patrimônio Fatec:'
  echo '  - containers, banco de dados, fotos e configuração (pasta producao);'
  echo '  - regra de firewall, certificado local e início automático.'
  echo 'Uma cópia de segurança será guardada em reset-backups antes de apagar.'
  echo 'Depois, a instalação começa do zero e fará as mesmas perguntas da primeira vez.'
  echo
  read -r -p 'Para continuar, digite RESETAR e pressione Enter: ' answer
  if [[ ${answer//[[:space:]]/} != RESETAR ]]; then
    echo 'Reset cancelado. Nada foi alterado.'; exit 1
  fi
fi

# 1. Início automático (systemd). Parado antes para não religar os containers.
if [[ -f /etc/systemd/system/$unit ]]; then
  echo 'Removendo o início automático...'
  as_admin systemctl disable "$unit" >/dev/null 2>&1 || true
  as_admin systemctl stop "$unit" >/dev/null 2>&1 || true
  as_admin rm -f "/etc/systemd/system/$unit"
  as_admin systemctl daemon-reload
fi

# 2. Cópia de segurança antes de apagar qualquer dado.
backup="reset-backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup"
chmod 700 reset-backups "$backup"
owner="$(id -u):$(id -g)"
# No Docker rootless, o root do container já é o usuário atual.
if [[ $(docker info --format '{{json .SecurityOptions}}') == *rootless* ]]; then owner=''; fi
save_volume() {
  docker run --rm --mount "type=volume,source=$1,target=/data,readonly" \
    --mount "type=bind,source=$PWD/$backup,target=/backup" postgres:17-alpine \
    sh -c 'tar czf "/backup/$1" -C /data . && if [ -n "$2" ]; then chown "$2" "/backup/$1"; fi' sh "$2" "$owner"
}
dumped=false
db=$(docker ps -aq --filter "$label" --filter label=com.docker.compose.service=database | head -n 1)
if [[ -n $db ]]; then
  echo 'Salvando o banco de dados...'
  docker start "$db" >/dev/null 2>&1 || true
  for _ in $(seq 60); do
    if docker exec "$db" pg_isready -U patrimonio -d patrimonio >/dev/null 2>&1; then break; fi
    sleep 1
  done
  # Conexão local dentro do container: funciona mesmo se a senha do .env não bater.
  if docker exec "$db" pg_dump -U patrimonio -d patrimonio -Fc > "$backup/banco.dump" 2>/dev/null; then
    dumped=true
  else
    rm -f "$backup/banco.dump"
  fi
fi
mapfile -t containers < <(docker ps -aq --filter "$label")
if (( ${#containers[@]} )); then docker stop "${containers[@]}" >/dev/null 2>&1 || true; fi
if $dumped; then
  echo 'Banco salvo em banco.dump.'
elif volume_exists "${project}_postgres_data"; then
  echo 'Não foi possível exportar o banco; salvando cópia bruta dos arquivos do banco...'
  save_volume "${project}_postgres_data" banco-arquivos.tar.gz
fi
if volume_exists "${project}_photos"; then
  echo 'Salvando as fotos...'
  save_volume "${project}_photos" fotos.tar.gz
fi

# 3. Firewall: remove somente a regra criada pelo instalador (porta e sub-rede do .env).
port=$(get_value HTTP_PORT); port=${port:-$(get_value HTTPS_PORT)}; port=${port:-443}
subnet=''
if command -v ip >/dev/null; then
  interface=$({ ip -4 route show default 2>/dev/null || true; } | awk 'NR==1 {for(i=1;i<=NF;i++) if($i=="dev") print $(i+1)}')
  if [[ -n $interface ]]; then
    subnet=$({ ip -4 route show dev "$interface" scope link 2>/dev/null || true; } | awk 'NR==1 {print $1}')
  fi
fi
if [[ -f producao/.env && $port =~ ^[0-9]+$ && $subnet =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/[0-9]+$ ]]; then
  if command -v ufw >/dev/null; then
    as_admin ufw delete allow from "$subnet" to any port "$port" proto tcp >/dev/null 2>&1 || true
  fi
  if command -v firewall-cmd >/dev/null && as_admin firewall-cmd --state >/dev/null 2>&1; then
    as_admin firewall-cmd --permanent --remove-rich-rule="rule family=ipv4 source address=$subnet port port=$port protocol=tcp accept" >/dev/null 2>&1 || true
    as_admin firewall-cmd --reload >/dev/null 2>&1 || true
  fi
fi

# 4. Certificado local de instalações antigas com HTTPS.
if [[ -f /usr/local/share/ca-certificates/fatec-patrimonio.crt ]]; then
  as_admin rm -f /usr/local/share/ca-certificates/fatec-patrimonio.crt
  as_admin update-ca-certificates --fresh >/dev/null 2>&1 || true
fi
if [[ -f /etc/pki/ca-trust/source/anchors/fatec-patrimonio.crt ]]; then
  as_admin rm -f /etc/pki/ca-trust/source/anchors/fatec-patrimonio.crt
  as_admin update-ca-trust extract >/dev/null 2>&1 || true
fi

# 5. Containers, volumes, redes e imagens do projeto.
echo 'Removendo containers, banco, fotos, redes e imagens da instalação anterior...'
mapfile -t containers < <(docker ps -aq --filter "$label")
if (( ${#containers[@]} )); then docker rm -f -v "${containers[@]}" >/dev/null; fi
mapfile -t volumes < <({ docker volume ls -q --filter "$label"; docker volume ls -q | grep "^${project}_" || true; } | sort -u)
if (( ${#volumes[@]} )); then docker volume rm -f "${volumes[@]}" >/dev/null; fi
mapfile -t networks < <(docker network ls -q --filter "$label")
if (( ${#networks[@]} )); then docker network rm "${networks[@]}" >/dev/null 2>&1 || true; fi
mapfile -t images < <({ docker images -q --filter "$label"; docker images -q "${project}-backend"; docker images -q "${project}-web"; } | sort -u)
if (( ${#images[@]} )); then docker rmi -f "${images[@]}" >/dev/null 2>&1 || true; fi

# 6. Configuração, senhas e logs: movidos para a cópia de segurança.
if [[ -e producao ]]; then mv producao "$backup/producao"; fi

if [[ -n $(docker ps -aq --filter "$label") || -n $(docker volume ls -q --filter "$label") ]]; then
  echo 'Ainda restaram componentes da instalação anterior. Execute bash resetar.sh novamente.'; exit 1
fi

echo
echo "RESET CONCLUÍDO. Cópia de segurança em: $backup"
if ! $reinstall; then
  echo 'Para instalar novamente: bash instalar.sh'; exit 0
fi
echo 'Iniciando a instalação do zero...'
echo
exec bash instalar.sh
