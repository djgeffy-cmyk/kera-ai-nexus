#!/usr/bin/env bash
# ============================================================
# Kera Desktop — instalador rápido para Linux (x64)
#
# Uso:
#   curl -fsSL https://space.kera.ia.br/install-kera.sh | bash
#
# O script descobre a release mais recente no GitHub, baixa o
# .deb (preferido em Ubuntu/Debian) e instala via apt. Se não
# houver .deb na release, cai no .AppImage portátil em
# ~/.local/bin/keradesktop e cria um atalho no menu.
# ============================================================
set -euo pipefail

REPO="${KERA_REPO:-djgeffy-cmyk/kera-ai-nexus}"
API="https://api.github.com/repos/${REPO}/releases/latest"

log()  { printf "\033[1;36m[kera]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[kera]\033[0m %s\n" "$*" >&2; }
die()  { printf "\033[1;31m[kera]\033[0m %s\n" "$*" >&2; exit 1; }

[[ "$(uname -s)" == "Linux" ]] || die "Este instalador é só pra Linux."
ARCH="$(uname -m)"
[[ "$ARCH" == "x86_64" || "$ARCH" == "amd64" ]] \
  || die "Arquitetura $ARCH não suportada (apenas x86_64)."

for bin in curl grep sed; do
  command -v "$bin" >/dev/null 2>&1 || die "Faltando: $bin"
done

log "Buscando última versão em $REPO…"
JSON="$(curl -fsSL -H 'Accept: application/vnd.github+json' "$API")" \
  || die "Falha ao consultar GitHub. Sem internet?"

# Extrai URLs de download dos assets sem precisar de jq.
ASSET_URLS="$(printf '%s' "$JSON" \
  | grep -oE '"browser_download_url"[[:space:]]*:[[:space:]]*"[^"]+"' \
  | sed -E 's/.*"([^"]+)"$/\1/')"

DEB_URL="$(printf '%s\n' "$ASSET_URLS" | grep -E '\.deb$'      | head -n1 || true)"
APP_URL="$(printf '%s\n' "$ASSET_URLS" | grep -E '\.AppImage$' | head -n1 || true)"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

install_deb() {
  local url="$1" file="$TMPDIR/keradesktop.deb"
  log "Baixando .deb: $url"
  curl -fL --progress-bar -o "$file" "$url"

  log "Instalando via apt (vai pedir sua senha sudo)…"
  if command -v sudo >/dev/null 2>&1; then
    sudo apt install -y "$file"
  else
    apt install -y "$file"
  fi
  log "✅ Pronto! Procure 'KeraDesktop' no menu de aplicativos."
}

install_appimage() {
  local url="$1"
  local dest_dir="$HOME/.local/bin"
  local dest="$dest_dir/keradesktop.AppImage"
  local desktop_dir="$HOME/.local/share/applications"
  local desktop_file="$desktop_dir/keradesktop.desktop"

  mkdir -p "$dest_dir" "$desktop_dir"
  log "Baixando AppImage: $url"
  curl -fL --progress-bar -o "$dest" "$url"
  chmod +x "$dest"

  cat > "$desktop_file" <<EOF
[Desktop Entry]
Type=Application
Name=Kera Desktop
Comment=Assistente Kera AI
Exec=$dest --no-sandbox
Icon=utilities-terminal
Terminal=false
Categories=Utility;
EOF

  log "✅ AppImage instalado em $dest"
  log "   Atalho criado em $desktop_file"
  log "   (Procure 'Kera Desktop' no menu, ou rode: $dest)"

  warn "Dica Ubuntu 24+: se reclamar de sandbox, rode uma vez:"
  warn "  sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0"
}

if [[ -n "$DEB_URL" ]]; then
  install_deb "$DEB_URL"
elif [[ -n "$APP_URL" ]]; then
  warn "Nenhum .deb na release — caindo no AppImage portátil."
  install_appimage "$APP_URL"
else
  die "Release não tem .deb nem .AppImage. Veja: https://github.com/${REPO}/releases/latest"
fi