#!/usr/bin/env bash
# Instalação pelo repositório oficial, limitada a Ubuntu/Debian.
set -Eeuo pipefail
source /etc/os-release
case "$ID" in ubuntu|debian) ;; *) echo 'Distribuição não atendida por este instalador. Consulte https://docs.docker.com/engine/install/'; exit 1;; esac
if command -v docker >/dev/null; then
  echo 'Docker já está instalado. Nada foi alterado. Teste: sudo docker compose version'; exit 0
fi
installed_packages=$(dpkg-query -W -f='${Status}\n' docker.io containerd runc podman-docker 2>/dev/null || true)
if [[ "$installed_packages" == *'install ok installed'* ]]; then
  echo 'Existe um runtime de contêiner instalado. Peça ao responsável técnico para instalar o plugin Compose sem remover dados.'; exit 1
fi
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n' "$(dpkg --print-architecture)" "$ID" "$VERSION_CODENAME" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker compose version
echo 'Instalação concluída. Agora execute: sudo bash producao.sh'
