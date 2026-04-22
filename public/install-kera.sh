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
# Permite pular a verificação (não recomendado): KERA_SKIP_VERIFY=1 curl … | bash
SKIP_VERIFY="${KERA_SKIP_VERIFY:-0}"

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
# sha256sum vem do coreutils (presente em qualquer distro mainstream).
if [[ "$SKIP_VERIFY" != "1" ]] && ! command -v sha256sum >/dev/null 2>&1; then
  die "sha256sum não encontrado. Instale o coreutils ou rode com KERA_SKIP_VERIFY=1 (não recomendado)."
fi

log "Buscando última versão em $REPO…"
JSON="$(curl -fsSL -H 'Accept: application/vnd.github+json' "$API")" \
  || die "Falha ao consultar GitHub. Sem internet?"

# Extrai URLs de download dos assets sem precisar de jq.
ASSET_URLS="$(printf '%s' "$JSON" \
  | grep -oE '"browser_download_url"[[:space:]]*:[[:space:]]*"[^"]+"' \
  | sed -E 's/.*"([^"]+)"$/\1/')"

DEB_URL="$(printf '%s\n' "$ASSET_URLS" | grep -E '\.deb$'      | head -n1 || true)"
APP_URL="$(printf '%s\n' "$ASSET_URLS" | grep -E '\.AppImage$' | head -n1 || true)"
SUMS_URL="$(printf '%s\n' "$ASSET_URLS" | grep -E '/SHA256SUMS\.txt$' | head -n1 || true)"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

# Baixa o manifesto de hashes UMA VEZ e valida o asset escolhido contra ele.
# Mitigação contra MITM e contra alguém anexando um asset adulterado num
# release. (Defesa em profundidade — o GitHub já serve via HTTPS.)
SUMS_FILE=""
if [[ "$SKIP_VERIFY" == "1" ]]; then
  warn "KERA_SKIP_VERIFY=1 — pulando verificação de SHA-256 (NÃO recomendado)."
elif [[ -z "$SUMS_URL" ]]; then
  warn "Esta release ainda não publica SHA256SUMS.txt — instalando sem verificar."
  warn "(A próxima versão buildada já incluirá o manifesto.)"
else
  SUMS_FILE="$TMPDIR/SHA256SUMS.txt"
  log "Baixando manifesto de hashes: $SUMS_URL"
  curl -fsSL -o "$SUMS_FILE" "$SUMS_URL" \
    || die "Falha ao baixar SHA256SUMS.txt"
fi

verify_sha256() {
  # $1 = caminho do arquivo baixado; $2 = nome do asset (como aparece no manifesto)
  local file="$1" name="$2"
  if [[ "$SKIP_VERIFY" == "1" || -z "$SUMS_FILE" ]]; then
    return 0
  fi
  local expected
  expected="$(grep -E "[[:space:]]${name}\$" "$SUMS_FILE" | awk '{print $1}' | head -n1 || true)"
  if [[ -z "$expected" ]]; then
    die "Asset $name não consta em SHA256SUMS.txt — release inconsistente, abortando."
  fi
  local actual
  actual="$(sha256sum "$file" | awk '{print $1}')"
  if [[ "$expected" != "$actual" ]]; then
    die "Hash NÃO confere para $name!\n  esperado: $expected\n  obtido:   $actual"
  fi
  log "🔐 SHA-256 confere para $name"
}

install_deb() {
  local url="$1" file="$TMPDIR/keradesktop.deb"
  local name
  name="$(basename "$url")"
  log "Baixando .deb: $url"
  curl -fL --progress-bar -o "$file" "$url"
  verify_sha256 "$file" "$name"

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
  local name
  name="$(basename "$url")"

  mkdir -p "$dest_dir" "$desktop_dir"
  log "Baixando AppImage: $url"
  # Baixa pra um arquivo temporário e só promove pro destino final
  # depois da verificação — evita deixar binário inválido no PATH.
  local tmp="$TMPDIR/keradesktop.AppImage"
  curl -fL --progress-bar -o "$tmp" "$url"
  verify_sha256 "$tmp" "$name"
  mv "$tmp" "$dest"
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