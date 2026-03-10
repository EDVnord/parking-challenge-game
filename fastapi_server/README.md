# Бэкенд "Король парковки" — FastAPI

Готовый бэкенд для переноса на свой VPS сервер.

## Быстрый старт

### 1. Загрузи файлы на сервер
```bash
scp -r fastapi_server/ root@<IP_СЕРВЕРА>:/var/www/parking/
```

### 2. Установи зависимости
```bash
cd /var/www/parking/fastapi_server
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Настрой переменные окружения
```bash
cp .env.example .env
nano .env  # заполни DATABASE_URL и остальные
```

### 4. Запусти сервер
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

Проверь: http://<IP_СЕРВЕРА>:8000/

---

## Автозапуск через systemd

Создай файл `/etc/systemd/system/parking.service`:
```ini
[Unit]
Description=Король парковки API
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/parking/fastapi_server
ExecStart=/var/www/parking/fastapi_server/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable parking
systemctl start parking
```

---

## Nginx конфиг

Создай файл `/etc/nginx/sites-available/parking`:
```nginx
server {
    listen 80;
    server_name твой-домен.ru;

    # API бэкенд
    location /api/ {
        rewrite ^/api(/.*)$ $1 break;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Фронтенд (билд из poehali.dev)
    location / {
        root /var/www/parking/frontend;
        try_files $uri /index.html;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/parking /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## Эндпоинты

| Путь | Метод | Описание |
|------|-------|---------|
| `/auth/` | POST | Авторизация (action: register/login/save/save_ya/load_ya/save_anon/load_anon/count) |
| `/friends/` | POST | Друзья (action: lookup/add/list/remove/my_code) |
| `/leaderboard/` | GET | Лидерборд (?name=НикИгрока) |
| `/payment/` | POST | Платежи ЮKassa (action: create/check) |
| `/room-manager/` | POST | Мультиплеер (action: join/state/move/next_round/eliminate/leave) |

---

## Переменные окружения

| Переменная | Обязательна | Описание |
|-----------|-------------|---------|
| `DATABASE_URL` | ДА | Строка подключения к PostgreSQL |
| `MAIN_DB_SCHEMA` | ДА | Схема БД (например: `parking`) |
| `YOOKASSA_SHOP_ID` | Нет | ID магазина ЮKassa (только если нужны платежи) |
| `YOOKASSA_SECRET_KEY` | Нет | Ключ ЮKassa |

---

## Подключение фронтенда

В файле `src/api/` (или где у тебя хранятся URL функций) замени адреса:

```
Было:  https://functions.poehali.dev/3b4361d7-...
Стало: https://твой-домен.ru/api/auth
```

Маппинг:
- `auth` функция → `/api/auth`
- `friends` функция → `/api/friends`
- `leaderboard` функция → `/api/leaderboard`
- `payment` функция → `/api/payment`
- `room-manager` функция → `/api/room-manager`
