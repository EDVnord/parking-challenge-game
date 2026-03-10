#!/bin/bash
set -e

# =====================================================
#  Обновление «Король парковки» (бэкенд + фронтенд)
#  Запуск: sudo bash update.sh
# =====================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
ask()   { echo -e "${YELLOW}[?]${NC} $1"; }

echo ""
echo "================================================="
echo "   Обновление «Король парковки»"
echo "================================================="
echo ""

if [ "$EUID" -ne 0 ]; then
  error "Запусти от root: sudo bash update.sh"
fi

INSTALL_DIR="/var/www/parking"
FRONTEND_DIR="$INSTALL_DIR/frontend"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ ! -d "$INSTALL_DIR" ]; then
  error "Бэкенд не установлен. Сначала запусти install.sh"
fi

if [ ! -f "$INSTALL_DIR/.env" ]; then
  error "Файл .env не найден в $INSTALL_DIR. Что-то пошло не так."
fi

# =====================================================
#  BUN — установка если не установлен
# =====================================================
if ! command -v bun &>/dev/null; then
  info "Устанавливаю Bun..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi
export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

# =====================================================
#  ФРОНТЕНД — сборка и деплой
# =====================================================
info "Собираю фронтенд..."
cd "$REPO_ROOT"
bun install --frozen-lockfile 2>/dev/null || bun install
bun run build

DIST_DIR=""
if [ -d "$REPO_ROOT/dist" ]; then
  DIST_DIR="$REPO_ROOT/dist"
elif [ -d "$REPO_ROOT/build" ]; then
  DIST_DIR="$REPO_ROOT/build"
fi

if [ -n "$DIST_DIR" ]; then
  info "Копирую билд в $FRONTEND_DIR..."
  mkdir -p "$FRONTEND_DIR"
  rsync -a --delete "$DIST_DIR/" "$FRONTEND_DIR/"
  info "Фронтенд обновлён!"
else
  warn "Билд не найден — проверь ошибки выше."
fi

# =====================================================
#  БЭКЕНД
# =====================================================
info "Копирую обновлённые файлы бэкенда..."
rsync -a --exclude='.env' --exclude='venv/' --exclude='install.sh' \
  "$SCRIPT_DIR/" "$INSTALL_DIR/"

info "Обновляю Python зависимости..."
"$INSTALL_DIR/venv/bin/pip" install -q --upgrade pip
"$INSTALL_DIR/venv/bin/pip" install -q -r "$INSTALL_DIR/requirements.txt"

chown -R www-data:www-data "$INSTALL_DIR"

info "Перезапускаю сервис..."
systemctl restart parking

sleep 2
if systemctl is-active --quiet parking; then
  info "Сервис успешно обновлён и запущен!"
else
  warn "Сервис не запустился. Проверь логи: journalctl -u parking -n 50"
fi

# =====================================================
#  NGINX
# =====================================================
if nginx -t 2>/dev/null; then
  systemctl reload nginx
  info "Nginx перезагружен!"
fi

echo ""
echo "================================================="
info "Обновление завершено!"
echo ""
echo "  Проверь сайт: https://$(hostname -f 2>/dev/null || echo 'твой-домен')"
echo "  Логи:         journalctl -u parking -f"
echo "================================================="