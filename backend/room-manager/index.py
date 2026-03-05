"""
Управление игровыми комнатами для мультиплеера.
Действия: join, state, move, leave, tick (серверный тик для ботов/фаз).
"""
import json
import os
import uuid
import time
import math
import random
import psycopg2

SCHEMA = 't_p25425030_parking_challenge_ga'
MAX_PLAYERS = 10
LOBBY_TIMEOUT = 20  # секунд ожидания до добавления ботов
LOBBY_MIN_REAL = 2  # минимум реальных игроков для старта
BOT_NAMES = ['Вася', 'Петя', 'Коля', 'Маша', 'Катя', 'Женя', 'Саша', 'Лёша', 'Дима', 'Игорь']
BOT_EMOJIS = ['🚕', '🚙', '🏎️', '🚓', '🚑', '🚒', '🛻', '🚐', '🚌', '🚗']
BOT_COLORS = ['#007AFF', '#34C759', '#FF6B35', '#AF52DE', '#5AC8FA',
              '#FFD600', '#FF3B30', '#30D158', '#FF9F0A', '#FF2D55']
BOT_BODY  = ['#0055CC', '#248A3D', '#CC4400', '#7B2FA8', '#0088CC',
             '#CC9900', '#AA0000', '#1A8833', '#CC6600', '#CC0033']

CANVAS_W, CANVAS_H = 800, 600
CENTER_X, CENTER_Y = 400, 300
SPOT_COLS = 5
SPOT_COL_GAP = 66
SPOT_ROW_GAP = 80


def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def make_spots(count: int) -> list:
    spots = []
    grid_w = (SPOT_COLS - 1) * SPOT_COL_GAP
    grid_h = (math.ceil(count / SPOT_COLS) - 1) * SPOT_ROW_GAP
    for i in range(count):
        col = i % SPOT_COLS
        row = i // SPOT_COLS
        spots.append({
            'x': CENTER_X - grid_w / 2 + col * SPOT_COL_GAP,
            'y': CENTER_Y - grid_h / 2 + row * SPOT_ROW_GAP,
            'occupied': False,
            'car_id': None,
        })
    return spots


def cors():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }


def resp(data, code=200):
    return {'statusCode': code, 'headers': {**cors(), 'Content-Type': 'application/json'}, 'body': json.dumps(data, ensure_ascii=False)}


def find_or_create_room(db) -> str:
    """Ищет комнату в ожидании или создаёт новую."""
    cur = db.cursor()
    cur.execute(
        f"SELECT id FROM {SCHEMA}.rooms WHERE status='waiting' ORDER BY created_at LIMIT 1"
    )
    row = cur.fetchone()
    if row:
        return row[0]
    room_id = str(uuid.uuid4())
    now_ms = int(time.time() * 1000)
    spots = make_spots(MAX_PLAYERS)
    cur.execute(
        f"INSERT INTO {SCHEMA}.rooms (id, status, round, phase, timer_end, spots_json, created_at, started_at, max_players) "
        f"VALUES (%s, 'waiting', 0, 'lobby', %s, %s, %s, 0, %s)",
        (room_id, now_ms + LOBBY_TIMEOUT * 1000, json.dumps(spots), now_ms, MAX_PLAYERS)
    )
    db.commit()
    return room_id


def get_room_players(db, room_id: str) -> list:
    cur = db.cursor()
    cur.execute(
        f"SELECT player_id, name, emoji, color, body_color, x, y, angle, speed, hp, max_hp, "
        f"orbit_angle, orbit_radius, parked, park_spot, eliminated, is_bot, last_seen "
        f"FROM {SCHEMA}.room_players WHERE room_id=%s",
        (room_id,)
    )
    cols = ['player_id','name','emoji','color','body_color','x','y','angle','speed',
            'hp','max_hp','orbit_angle','orbit_radius','parked','park_spot',
            'eliminated','is_bot','last_seen']
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def get_room(db, room_id: str) -> dict | None:
    cur = db.cursor()
    cur.execute(
        f"SELECT id, status, round, phase, timer_end, spots_json, created_at, started_at "
        f"FROM {SCHEMA}.rooms WHERE id=%s",
        (room_id,)
    )
    row = cur.fetchone()
    if not row:
        return None
    cols = ['id','status','round','phase','timer_end','spots_json','created_at','started_at']
    d = dict(zip(cols, row))
    d['spots'] = json.loads(d['spots_json'])
    return d


def add_bots(db, room_id: str, players: list, max_players: int):
    """Добавляет ботов до заполнения комнаты."""
    existing_ids = {p['player_id'] for p in players}
    slots_needed = max_players - len(players)
    if slots_needed <= 0:
        return
    cur = db.cursor()
    bot_idx = 0
    for _ in range(slots_needed):
        while f'bot_{bot_idx}' in existing_ids:
            bot_idx += 1
        bot_id = f'bot_{bot_idx}'
        name = BOT_NAMES[bot_idx % len(BOT_NAMES)]
        emoji = BOT_EMOJIS[bot_idx % len(BOT_EMOJIS)]
        color = BOT_COLORS[bot_idx % len(BOT_COLORS)]
        body_color = BOT_BODY[bot_idx % len(BOT_BODY)]
        all_players_count = len(players) + bot_idx + 1
        orbit_radius = 270 + (all_players_count % 3) * 20
        orbit_angle = (all_players_count / max_players) * math.pi * 2
        x = CENTER_X + math.cos(orbit_angle) * orbit_radius
        y = CENTER_Y + math.sin(orbit_angle) * orbit_radius
        now_ms = int(time.time() * 1000)
        cur.execute(
            f"INSERT INTO {SCHEMA}.room_players "
            f"(room_id, player_id, name, emoji, color, body_color, x, y, angle, speed, hp, max_hp, "
            f"orbit_angle, orbit_radius, parked, park_spot, eliminated, is_bot, last_seen) "
            f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (room_id, bot_id, name, emoji, color, body_color,
             x, y, orbit_angle + math.pi, 0, 100, 100,
             orbit_angle, orbit_radius, False, -1, False, True, now_ms)
        )
        existing_ids.add(bot_id)
        bot_idx += 1
    db.commit()


def action_join(db, body: dict) -> dict:
    """Игрок входит в комнату ожидания."""
    player_id = body.get('playerId', '')
    name = body.get('name', 'Игрок')[:16]
    emoji = body.get('emoji', '🚗')
    color = body.get('color', '#FF2D55')
    body_color = body.get('bodyColor', '#CC0033')
    max_hp = float(body.get('maxHp', 100))

    if not player_id:
        return resp({'error': 'playerId required'}, 400)

    room_id = find_or_create_room(db)
    players = get_room_players(db, room_id)

    already_in = any(p['player_id'] == player_id for p in players)
    if not already_in:
        idx = len(players)
        orbit_radius = 270 + (idx % 3) * 20
        orbit_angle = (idx / MAX_PLAYERS) * math.pi * 2
        x = CENTER_X + math.cos(orbit_angle) * orbit_radius
        y = CENTER_Y + math.sin(orbit_angle) * orbit_radius
        now_ms = int(time.time() * 1000)
        cur = db.cursor()
        cur.execute(
            f"INSERT INTO {SCHEMA}.room_players "
            f"(room_id, player_id, name, emoji, color, body_color, x, y, angle, speed, hp, max_hp, "
            f"orbit_angle, orbit_radius, parked, park_spot, eliminated, is_bot, last_seen) "
            f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"
            f" ON CONFLICT (room_id, player_id) DO UPDATE SET last_seen=EXCLUDED.last_seen",
            (room_id, player_id, name, emoji, color, body_color,
             x, y, orbit_angle + math.pi, 0, max_hp, max_hp,
             orbit_angle, orbit_radius, False, -1, False, False, now_ms)
        )
        db.commit()
        players = get_room_players(db, room_id)

    room = get_room(db, room_id)
    now_ms = int(time.time() * 1000)
    real_players = [p for p in players if not p['is_bot']]

    # Старт: 10 реальных OR таймаут истёк и есть хоть LOBBY_MIN_REAL реальных
    should_start = (
        len(players) >= MAX_PLAYERS or
        (now_ms >= room['timer_end'] and len(real_players) >= LOBBY_MIN_REAL)
    )

    if should_start and room['status'] == 'waiting':
        add_bots(db, room_id, players, MAX_PLAYERS)
        players = get_room_players(db, room_id)
        spots = make_spots(MAX_PLAYERS)  # round 0: всем места
        round_timer = int(time.time() * 1000) + 7000  # 7с тренировка
        cur = db.cursor()
        cur.execute(
            f"UPDATE {SCHEMA}.rooms SET status='playing', round=0, phase='driving', "
            f"timer_end=%s, spots_json=%s, started_at=%s WHERE id=%s",
            (round_timer, json.dumps(spots), now_ms, room_id)
        )
        db.commit()
        room = get_room(db, room_id)

    return resp({
        'roomId': room_id,
        'status': room['status'],
        'round': room['round'],
        'phase': room['phase'],
        'timerEnd': room['timer_end'],
        'spots': room['spots'],
        'players': players,
        'playerId': player_id,
    })


def action_state(db, body: dict) -> dict:
    """Получить текущее состояние комнаты."""
    room_id = body.get('roomId', '')
    if not room_id:
        return resp({'error': 'roomId required'}, 400)
    room = get_room(db, room_id)
    if not room:
        return resp({'error': 'room not found'}, 404)
    players = get_room_players(db, room_id)
    return resp({
        'roomId': room_id,
        'status': room['status'],
        'round': room['round'],
        'phase': room['phase'],
        'timerEnd': room['timer_end'],
        'spots': room['spots'],
        'players': players,
    })


def action_move(db, body: dict) -> dict:
    """Игрок отправляет свою позицию."""
    room_id = body.get('roomId', '')
    player_id = body.get('playerId', '')
    if not room_id or not player_id:
        return resp({'error': 'roomId and playerId required'}, 400)

    now_ms = int(time.time() * 1000)
    cur = db.cursor()
    cur.execute(
        f"UPDATE {SCHEMA}.room_players SET "
        f"x=%s, y=%s, angle=%s, speed=%s, hp=%s, orbit_angle=%s, "
        f"parked=%s, park_spot=%s, eliminated=%s, last_seen=%s "
        f"WHERE room_id=%s AND player_id=%s",
        (
            float(body.get('x', 400)), float(body.get('y', 300)),
            float(body.get('angle', 0)), float(body.get('speed', 0)),
            float(body.get('hp', 100)), float(body.get('orbitAngle', 0)),
            bool(body.get('parked', False)), int(body.get('parkSpot', -1)),
            bool(body.get('eliminated', False)), now_ms,
            room_id, player_id
        )
    )
    db.commit()

    # Если игрок запарковался — обновить спот
    if body.get('parked') and body.get('parkSpot', -1) >= 0:
        room = get_room(db, room_id)
        spots = room['spots']
        spot_idx = int(body['parkSpot'])
        if 0 <= spot_idx < len(spots):
            spots[spot_idx]['occupied'] = True
            spots[spot_idx]['car_id'] = player_id
            cur.execute(
                f"UPDATE {SCHEMA}.rooms SET spots_json=%s WHERE id=%s",
                (json.dumps(spots), room_id)
            )
            db.commit()

    players = get_room_players(db, room_id)
    room = get_room(db, room_id)
    return resp({
        'status': room['status'],
        'round': room['round'],
        'phase': room['phase'],
        'timerEnd': room['timer_end'],
        'spots': room['spots'],
        'players': players,
    })


def action_next_round(db, body: dict) -> dict:
    """Хост-клиент сигнализирует о переходе к следующему раунду."""
    room_id = body.get('roomId', '')
    player_id = body.get('playerId', '')
    if not room_id:
        return resp({'error': 'roomId required'}, 400)

    players = get_room_players(db, room_id)
    room = get_room(db, room_id)
    if not room:
        return resp({'error': 'room not found'}, 404)

    active = [p for p in players if not p['eliminated']]
    real_players = [p for p in active if not p['is_bot']]

    # Проверить — первый реальный игрок = хост (по порядку join)
    # Только хост может переключать раунд (все клиенты вычислят сами по timer_end)
    cur = db.cursor()
    new_round = room['round'] + 1
    active_count = len(active)

    if active_count <= 1 or new_round > 9:
        cur.execute(
            f"UPDATE {SCHEMA}.rooms SET status='finished', phase='winner' WHERE id=%s",
            (room_id,)
        )
        db.commit()
        return resp({'finished': True})

    is_final = active_count == 2
    spot_count = active_count - 1
    if new_round == 1:
        spot_count = active_count - 1  # переходим к реальной игре
    spots = make_spots(1 if is_final else spot_count)

    # Случайный таймер 1-12 секунд
    round_secs = 1 + random.random() * 11
    timer_end = int(time.time() * 1000) + int(round_secs * 1000)

    cur.execute(
        f"UPDATE {SCHEMA}.rooms SET round=%s, phase='driving', timer_end=%s, spots_json=%s WHERE id=%s",
        (new_round, timer_end, json.dumps(spots), room_id)
    )
    # Сбросить parked/park_spot у активных игроков
    cur.execute(
        f"UPDATE {SCHEMA}.room_players SET parked=FALSE, park_spot=-1 WHERE room_id=%s AND NOT eliminated",
        (room_id,)
    )
    db.commit()

    players = get_room_players(db, room_id)
    room = get_room(db, room_id)
    return resp({
        'round': room['round'],
        'phase': room['phase'],
        'timerEnd': room['timer_end'],
        'spots': room['spots'],
        'players': players,
        'isFinal': is_final,
    })


def action_eliminate(db, body: dict) -> dict:
    """Отметить игрока как выбывшего."""
    room_id = body.get('roomId', '')
    target_id = body.get('targetPlayerId', '')
    if not room_id or not target_id:
        return resp({'error': 'roomId and targetPlayerId required'}, 400)
    cur = db.cursor()
    cur.execute(
        f"UPDATE {SCHEMA}.room_players SET eliminated=TRUE WHERE room_id=%s AND player_id=%s",
        (room_id, target_id)
    )
    db.commit()
    return resp({'ok': True})


def action_leave(db, body: dict) -> dict:
    room_id = body.get('roomId', '')
    player_id = body.get('playerId', '')
    if not room_id or not player_id:
        return resp({'error': 'roomId and playerId required'}, 400)
    cur = db.cursor()
    cur.execute(
        f"UPDATE {SCHEMA}.room_players SET eliminated=TRUE WHERE room_id=%s AND player_id=%s",
        (room_id, player_id)
    )
    db.commit()
    return resp({'ok': True})


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors(), 'body': ''}

    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except Exception:
            pass

    action = body.get('action', '')
    db = get_db()
    try:
        if action == 'join':
            return action_join(db, body)
        elif action == 'state':
            return action_state(db, body)
        elif action == 'move':
            return action_move(db, body)
        elif action == 'next_round':
            return action_next_round(db, body)
        elif action == 'eliminate':
            return action_eliminate(db, body)
        elif action == 'leave':
            return action_leave(db, body)
        else:
            return resp({'error': f'unknown action: {action}'}, 400)
    finally:
        db.close()