#!/bin/bash
set -e

# =====================================================
#  Установка бэкенда "Король парковки" на Ubuntu 22.04
#  Запуск: sudo bash install.sh
# =====================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
ask()   { echo -e "${YELLOW}[?]${NC} $1"; }

echo ""
echo "================================================="
echo "   Установка бэкенда «Король парковки»"
echo "================================================="
echo ""

# --- Проверка root ---
if [ "$EUID" -ne 0 ]; then
  error "Запусти скрипт от root: sudo bash install.sh"
fi

# --- Параметры ---
ask "Введи домен сервера (например: ednord.ru):"
read -r DOMAIN

ask "Введи YOOKASSA_SHOP_ID (или Enter чтобы пропустить):"
read -r YOOKASSA_SHOP_ID

ask "Введи YOOKASSA_SECRET_KEY (или Enter чтобы пропустить):"
read -r YOOKASSA_SECRET_KEY

DB_NAME="parking_db"
DB_USER="parking_user"
DB_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 20)"
DB_SCHEMA="parking"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
INSTALL_DIR="/var/www/parking"

echo ""
info "Обновляю систему..."
apt-get update -qq
apt-get upgrade -y -qq

info "Устанавливаю зависимости..."
apt-get install -y -qq \
  python3.11 python3.11-venv python3-pip \
  postgresql postgresql-contrib \
  libpq-dev python3-dev \
  nginx \
  certbot python3-certbot-nginx \
  git curl openssl

# =====================================================
#  БАЗА ДАННЫХ
# =====================================================
info "Настраиваю PostgreSQL..."
systemctl start postgresql
systemctl enable postgresql

# Создаём пользователя и БД
sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>/dev/null || true
sudo -u postgres psql -c "DROP USER IF EXISTS ${DB_USER};" 2>/dev/null || true
sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

info "Создаю схему и таблицы..."
sudo -u postgres psql -d "${DB_NAME}" <<EOSQL

-- Создаём схему
CREATE SCHEMA IF NOT EXISTS ${DB_SCHEMA};
GRANT ALL ON SCHEMA ${DB_SCHEMA} TO ${DB_USER};

-- Таблица игроков
CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.players (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(16) NOT NULL,
    emoji           VARCHAR(8)  NOT NULL DEFAULT '😎',
    password_hash   VARCHAR(64) NOT NULL DEFAULT '',
    coins           INTEGER     NOT NULL DEFAULT 1000,
    gems            INTEGER     NOT NULL DEFAULT 50,
    xp              INTEGER     NOT NULL DEFAULT 0,
    wins            INTEGER     NOT NULL DEFAULT 0,
    games_played    INTEGER     NOT NULL DEFAULT 0,
    best_position   INTEGER     NOT NULL DEFAULT 99,
    selected_car    INTEGER     NOT NULL DEFAULT 0,
    owned_cars      TEXT        NOT NULL DEFAULT '0',
    upgrades        TEXT        NOT NULL DEFAULT '{}',
    created_at      TIMESTAMP   DEFAULT NOW(),
    updated_at      TIMESTAMP   DEFAULT NOW(),
    ya_id           VARCHAR(64)  NULL,
    anon_id         VARCHAR(128) NULL,
    friend_code     VARCHAR(16)  NULL,
    cars            TEXT         NULL,
    extra_data      TEXT         NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_ya_id    ON ${DB_SCHEMA}.players (ya_id)    WHERE ya_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_anon_id  ON ${DB_SCHEMA}.players (anon_id)  WHERE anon_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_name     ON ${DB_SCHEMA}.players (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_fcode    ON ${DB_SCHEMA}.players (friend_code) WHERE friend_code IS NOT NULL;

GRANT ALL ON ${DB_SCHEMA}.players TO ${DB_USER};
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${DB_SCHEMA} TO ${DB_USER};

-- Таблица друзей
CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.friends (
    id            SERIAL PRIMARY KEY,
    player_id     INTEGER     NOT NULL REFERENCES ${DB_SCHEMA}.players(id) ON DELETE CASCADE,
    friend_id     INTEGER     NOT NULL REFERENCES ${DB_SCHEMA}.players(id) ON DELETE CASCADE,
    status        VARCHAR(20) NOT NULL DEFAULT 'accepted',
    games_together INTEGER    NOT NULL DEFAULT 0,
    created_at    TIMESTAMP   DEFAULT NOW(),
    UNIQUE (player_id, friend_id)
);

GRANT ALL ON ${DB_SCHEMA}.friends TO ${DB_USER};
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${DB_SCHEMA} TO ${DB_USER};

-- Таблица комнат
CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.rooms (
    id          VARCHAR(36) PRIMARY KEY,
    status      VARCHAR(16) NOT NULL DEFAULT 'waiting',
    round       INTEGER     NOT NULL DEFAULT 0,
    phase       VARCHAR(16) NOT NULL DEFAULT 'lobby',
    timer_end   BIGINT      NOT NULL DEFAULT 0,
    spots_json  TEXT        NOT NULL DEFAULT '[]',
    created_at  BIGINT      NOT NULL DEFAULT 0,
    started_at  BIGINT      NOT NULL DEFAULT 0,
    max_players INTEGER     NOT NULL DEFAULT 10
);

GRANT ALL ON ${DB_SCHEMA}.rooms TO ${DB_USER};

-- Таблица игроков в комнатах
CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.room_players (
    room_id      VARCHAR(36) NOT NULL REFERENCES ${DB_SCHEMA}.rooms(id) ON DELETE CASCADE,
    player_id    VARCHAR(64) NOT NULL,
    name         VARCHAR(32) NOT NULL,
    emoji        VARCHAR(8)  NOT NULL DEFAULT '🚗',
    color        VARCHAR(16) NOT NULL DEFAULT '#FF2D55',
    body_color   VARCHAR(16) NOT NULL DEFAULT '#CC0033',
    x            DOUBLE PRECISION NOT NULL DEFAULT 400,
    y            DOUBLE PRECISION NOT NULL DEFAULT 300,
    angle        DOUBLE PRECISION NOT NULL DEFAULT 0,
    speed        DOUBLE PRECISION NOT NULL DEFAULT 0,
    hp           DOUBLE PRECISION NOT NULL DEFAULT 100,
    max_hp       DOUBLE PRECISION NOT NULL DEFAULT 100,
    orbit_angle  DOUBLE PRECISION NOT NULL DEFAULT 0,
    orbit_radius DOUBLE PRECISION NOT NULL DEFAULT 270,
    parked       BOOLEAN NOT NULL DEFAULT false,
    park_spot    INTEGER NOT NULL DEFAULT -1,
    eliminated   BOOLEAN NOT NULL DEFAULT false,
    is_bot       BOOLEAN NOT NULL DEFAULT false,
    last_seen    BIGINT  NOT NULL DEFAULT 0,
    PRIMARY KEY (room_id, player_id)
);

GRANT ALL ON ${DB_SCHEMA}.room_players TO ${DB_USER};

-- Таблица истории подарков
CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.admin_gifts_log (
    id          SERIAL PRIMARY KEY,
    coins       INTEGER NOT NULL DEFAULT 0,
    gems        INTEGER NOT NULL DEFAULT 0,
    target      VARCHAR(32) NOT NULL DEFAULT 'all',
    affected    INTEGER NOT NULL DEFAULT 0,
    comment     VARCHAR(120),
    created_at  TIMESTAMP DEFAULT NOW()
);

GRANT ALL ON ${DB_SCHEMA}.admin_gifts_log TO ${DB_USER};
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${DB_SCHEMA} TO ${DB_USER};

-- =====================================================
--  ПЕРЕНОС ДАННЫХ из poehali.dev (снимок от 2026-03-10)
-- =====================================================
INSERT INTO ${DB_SCHEMA}.players
  (id, name, emoji, password_hash, coins, gems, xp, wins, games_played,
   best_position, selected_car, owned_cars, upgrades,
   ya_id, anon_id, friend_code, created_at, updated_at)
VALUES
  (3,  'EDnord',         '😈', 'b0361197c00892a715e4b567de4043af57fc060158b6534a88a7045ba376ae63', 271,   4,   1555, 1, 21, 1,  6, '0,1,6,7', '{"nitro":true,"gps":false,"bumper":false,"autoRepair":false,"magnet":false,"turbo":false,"shield":false}', NULL, NULL, 'ECCBC8', '2026-03-04 13:19:02', '2026-03-09 09:32:22'),
  (5,  '--',             '🤠', '0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c', 1194,  50,  90,   0, 2,  9,  0, '0',       '{"nitro":false,"gps":false,"bumper":false,"autoRepair":false,"magnet":false,"turbo":false,"shield":false}', NULL, NULL, 'E4DA3B', '2026-03-04 14:30:33', '2026-03-04 14:31:38'),
  (6,  'Артем',          '😎', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 1262,  50,  60,   0, 2,  10, 0, '0',       '{"nitro":false,"gps":false,"bumper":false,"autoRepair":false,"magnet":false,"turbo":false,"shield":false}', NULL, NULL, '167909', '2026-03-05 03:25:24', '2026-03-05 04:13:48'),
  (7,  'TestKingXYZ9991','😎', '937e8d5fbb48bd4949536cd65b8d35c426b80d2f830c5c308e2cdec422ae2244', 1000,  50,  0,    0, 0,  99, 0, '0',       '{}', NULL, NULL, '8F14E4', '2026-03-05 04:50:50', '2026-03-05 04:50:50'),
  (8,  'ЯИгрок',        '🚗', '',                                                                 500,   0,   100,  1, 3,  2,  0, '0',       '{}', 'ya_test999888', NULL, 'BE6403', '2026-03-05 09:30:46', '2026-03-09 09:32:21'),
  (9,  'TestKingXYZ9992','😎', '937e8d5fbb48bd4949536cd65b8d35c426b80d2f830c5c308e2cdec422ae2244', 1000,  50,  0,    0, 0,  99, 0, '0',       '{}', NULL, NULL, '45C48C', '2026-03-05 09:31:25', '2026-03-05 09:31:25'),
  (12, 'TestKingXYZ9993','😎', '937e8d5fbb48bd4949536cd65b8d35c426b80d2f830c5c308e2cdec422ae2244', 1000,  50,  0,    0, 0,  99, 0, '0',       '{}', NULL, NULL, 'C20AD4', '2026-03-05 10:20:16', '2026-03-05 10:20:16'),
  (13, 'АнонИгрок',     '🚗', '',                                                                 300,   0,   250,  2, 5,  3,  0, '0',       '{}', NULL, 'anon_test_777', '6D0D59', '2026-03-05 10:20:17', '2026-03-09 09:32:21'),
  (17, 'Игрок',         '😎', '',                                                                 13000, 100, 200,  0, 2,  6,  0, '0',       '{"nitro":true,"gps":false,"bumper":false,"autoRepair":false,"magnet":false,"turbo":false,"shield":false}', NULL, 'anon_1772877678782_3nzj7md', '70EFDF', '2026-03-08 10:18:01', '2026-03-08 10:18:01')
ON CONFLICT DO NOTHING;

-- Сдвигаем sequence чтобы новые ID не конфликтовали
SELECT setval('${DB_SCHEMA}.players_id_seq', (SELECT MAX(id) FROM ${DB_SCHEMA}.players));

EOSQL

info "База данных создана и данные перенесены (9 игроков)!"

# =====================================================
#  ПРИЛОЖЕНИЕ
# =====================================================
info "Создаю папку проекта: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

info "Копирую файлы бэкенда..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR/"

info "Создаю Python окружение..."
python3.11 -m venv "$INSTALL_DIR/venv"
"$INSTALL_DIR/venv/bin/pip" install -q --upgrade pip
"$INSTALL_DIR/venv/bin/pip" install -q -r "$INSTALL_DIR/requirements.txt"

info "Создаю файл переменных окружения..."
ADMIN_SECRET_VAL="$(openssl rand -base64 18 | tr -d '/+=')"
cat > "$INSTALL_DIR/.env" <<EOF
DATABASE_URL=${DATABASE_URL}
MAIN_DB_SCHEMA=${DB_SCHEMA}
YOOKASSA_SHOP_ID=${YOOKASSA_SHOP_ID}
YOOKASSA_SECRET_KEY=${YOOKASSA_SECRET_KEY}
ADMIN_SECRET=${ADMIN_SECRET_VAL}
EOF
chmod 600 "$INSTALL_DIR/.env"

# =====================================================
#  SYSTEMD СЕРВИС
# =====================================================
info "Создаю systemd сервис..."
cat > /etc/systemd/system/parking.service <<EOF
[Unit]
Description=Король парковки — API
After=network.target postgresql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

chown -R www-data:www-data "$INSTALL_DIR"

systemctl daemon-reload
systemctl enable parking
systemctl start parking

sleep 2
if systemctl is-active --quiet parking; then
  info "Сервис запущен успешно!"
else
  warn "Сервис не запустился. Проверь логи: journalctl -u parking -n 50"
fi

# =====================================================
#  NGINX
# =====================================================
info "Настраиваю Nginx..."
cat > /etc/nginx/sites-available/parking <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location /api/ {
        rewrite ^/api(/.*)$ \$1 break;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 30s;
    }

    location / {
        root /var/www/parking/frontend;
        try_files \$uri /index.html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/parking /etc/nginx/sites-enabled/parking
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
info "Nginx настроен!"

# =====================================================
#  SSL
# =====================================================
echo ""
ask "Настроить SSL (HTTPS) через Let's Encrypt? (y/n):"
read -r SETUP_SSL

if [ "$SETUP_SSL" = "y" ] || [ "$SETUP_SSL" = "Y" ]; then
  ask "Введи email для SSL-сертификата:"
  read -r SSL_EMAIL
  warn "Убедись что DNS запись ${DOMAIN} указывает на IP этого сервера!"
  ask "Продолжить? (y/n):"
  read -r CONTINUE_SSL
  if [ "$CONTINUE_SSL" = "y" ] || [ "$CONTINUE_SSL" = "Y" ]; then
    certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${SSL_EMAIL}" --redirect
    info "SSL настроен! Сайт доступен по https://${DOMAIN}"
  fi
fi

# =====================================================
#  PGWEB — веб-интерфейс для базы данных
# =====================================================
echo ""
ask "Установить pgweb (веб-интерфейс для просмотра БД)? (y/n):"
read -r SETUP_PGWEB

if [ "$SETUP_PGWEB" = "y" ] || [ "$SETUP_PGWEB" = "Y" ]; then
  ask "Придумай пароль для входа в pgweb (логин будет: admin):"
  read -r PGWEB_PASS

  info "Скачиваю pgweb..."
  apt-get install -y -qq unzip
  PGWEB_VER="0.15.0"
  wget -q "https://github.com/sosedoff/pgweb/releases/download/v${PGWEB_VER}/pgweb_linux_amd64.zip" -O /tmp/pgweb.zip
  unzip -q /tmp/pgweb.zip -d /tmp/pgweb_extracted
  # Ищем бинарник внутри архива
  PGWEB_BIN=$(find /tmp/pgweb_extracted -name 'pgweb*' -type f | head -1)
  mv "$PGWEB_BIN" /usr/local/bin/pgweb
  chmod +x /usr/local/bin/pgweb
  rm -rf /tmp/pgweb.zip /tmp/pgweb_extracted

  info "Создаю systemd сервис pgweb..."
  cat > /etc/systemd/system/pgweb.service <<EOF
[Unit]
Description=pgweb — веб-интерфейс PostgreSQL
After=postgresql.service

[Service]
ExecStart=/usr/local/bin/pgweb --bind=127.0.0.1 --listen=5435 --url=${DATABASE_URL}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable pgweb
  systemctl start pgweb

  info "Настраиваю защиту паролем..."
  apt-get install -y -qq apache2-utils
  htpasswd -cb /etc/nginx/.pgweb_pass admin "${PGWEB_PASS}"

  info "Добавляю pgweb в Nginx на /db/..."
  # Добавляем location /db/ в существующий конфиг
  sed -i "s|    location / {|    location /db/ {\n        auth_basic \"DB Access\";\n        auth_basic_user_file /etc/nginx/.pgweb_pass;\n        proxy_pass http://127.0.0.1:5435/;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade \$http_upgrade;\n        proxy_set_header Connection \"upgrade\";\n    }\n\n    location / {|" /etc/nginx/sites-available/parking

  nginx -t && systemctl reload nginx
  info "pgweb установлен!"
  echo ""
  echo "  База данных (веб):  https://${DOMAIN}/db/"
  echo "  Логин: admin  Пароль: ${PGWEB_PASS}"
fi

# =====================================================
#  ИТОГ
# =====================================================
echo ""
echo "================================================="
info "Установка завершена!"
echo ""
echo "  Домен:    http://${DOMAIN}/api/"
echo "  Проверь:  curl http://${DOMAIN}/api/"
echo ""
echo "  Данные БД (сохрани!):"
echo "  • База:     ${DB_NAME}"
echo "  • Юзер:     ${DB_USER}"
echo "  • Пароль:   ${DB_PASS}"
echo "  • URL:      ${DATABASE_URL}"
echo ""
echo "  Админ-панель:"
echo "  • Адрес:    https://${DOMAIN}/#/admin"
echo "  • Пароль:   ${ADMIN_SECRET_VAL}"
echo ""
echo "  Полезные команды:"
echo "  • Статус:      systemctl status parking"
echo "  • Логи API:    journalctl -u parking -f"
echo "  • Перезапуск:  systemctl restart parking"
echo "  • Логи Nginx:  tail -f /var/log/nginx/error.log"
echo "  • Статус pgweb: systemctl status pgweb"
echo "================================================="