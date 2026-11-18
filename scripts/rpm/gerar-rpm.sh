#!/usr/bin/env bash
# Gera dist/OpenVPNConnect-<versão>.rpm dentro de um contêiner Fedora.
# O .rpm sai em dist/ sem tocar no latest-linux.yml (que é do AppImage e usado pelo atualizador).
# Uso: scripts/rpm/gerar-rpm.sh   (na raiz do projeto, com node_modules já instalado)
set -euo pipefail
cd "$(dirname "$0")/../.."
docker build -q -t openvpn-connect-rpm scripts/rpm >/dev/null
docker run --rm -v "$PWD":/work -w /work -e HOME=/tmp/home -e ELECTRON_BUILDER_CACHE=/tmp/eb-cache openvpn-connect-rpm \
  bash -c 'mkdir -p /tmp/home && npx electron-builder --linux rpm --publish never -c.directories.output=dist/rpm-tmp && mv dist/rpm-tmp/*.rpm dist/ && rm -rf dist/rpm-tmp && chown -R '"$(id -u):$(id -g)"' /work/dist'
ls -la dist/*.rpm
