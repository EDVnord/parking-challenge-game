import json
import uuid
import time
import math
import random
from fastapi import APIRouter, HTTPException
from database import get_conn

router = APIRouter(prefix="/room-manager", tags=["room-manager"])

SCHEMA = 'parking'
MAX_PLAYERS = 10
LOBBY_TIMEOUT = 15
LOBBY_MIN_REAL = 1
SIGNAL_DURATION = 8000    # ms — фаза парковки
ROUND_END_DURATION = 3000 # ms — пауза между раундами
SLOT_INTERVAL = 30        # сек — глобальный интервал заездов

BOT_NAMES = ['Вася', 'Петя', 'Коля', 'Маша', 'Катя', 'Женя', 'Саша', 'Лёша', 'Дима', 'Игорь']
BOT_EMOJIS = ['🚕', '🚙', '🏎️', '🚓', '🚑', '🚒', '🛻', '🚐', '🚌', '🚗']
BOT_COLORS = ['#007AFF', '#34C759', '#FF6B35', '#AF52DE', '#5AC8FA',
              '#FFD600', '#FF3B30', '#30D158', '#FF9F0A', '#FF2D55']
BOT_BODY = ['#0055CC', '#248A3D', '#CC4400', '#7B2FA8', '#0088CC',
            '#CC9900', '#AA0000', '#1A8833', '#CC6600', '#CC0033']

CANVAS_W, CANVAS_H = 800, 600
CENTER_X, CENTER_Y = 400, 300
SPOT_COLS = 5
SPOT_COL_GAP = 66
SPOT_ROW_GAP = 80


def get_next_slot_ms() -> int:
    """Возвращает время старта следующего глобального слота (кратно SLOT_INTERVAL)."""
    now_ms = int(time.time() * 1000)
    slot_ms = SLOT_INTERVAL * 1000
    return ((now_ms // slot_ms) + 1) * slot_ms


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


def get_room_players(db, room_id: str) -> list:
    cur = db.cursor()
    cur.execute(
        f"SELECT player_id, name, emoji, color, body_color, x, y, angle, speed, hp, max_hp, "
        f"orbit_angle, orbit_radius, parked, park_spot, eliminated, is_bot, last_seen "
        f"FROM {SCHEMA}.room_players WHERE room_id=%s",
        (room_id,)
    )
    cols = ['player_id', 'name', 'emoji', 'color', 'body_color', 'x', 'y', 'angle', 'speed',
            'hp', 'max_hp', 'orbit_angle', 'orbit_radius', 'parked', 'park_spot',
            'eliminated', 'is_bot', 'last_seen']
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def get_room(db, room_id: str):
    cur = db.cursor()
    cur.execute(
        f"SELECT id, status, round, phase, timer_end, spots_json, created_at, started_at, "
        f"max_players, eliminated_this_round "
        f"FROM {SCHEMA}.rooms WHERE id=%s",
        (room_id,)
    )
    row = cur.fetchone()
    if not row:
        return None
    cols = ['id', 'status', 'round', 'phase', 'timer_end', 'spots_json', 'created_at',
            'started_at', 'max_players', 'eliminated_this_round']
    d = dict(zip(cols, row))
    d['spots'] = json.loads(d['spots_json'])
    return d


def tick_room(db, room_id: str, room: dict, players: list):
    """Серверный тик: проверяет таймеры и переключает фазы."""
    now_ms = int(time.time() * 1000)
    phase = room['phase']
    timer_end = room['timer_end']

    if phase == 'driving' and now_ms >= timer_end:
        active = [p for p in players if not p['eliminated']]
        spots_count = max(1, len(active) - 1)
        if room['round'] == 0:
            spots_count = len(active)
        spots = make_spots(spots_count)
        signal_end = now_ms + SIGNAL_DURATION
        cur = db.cursor()
        cur.execute(
            f"UPDATE {SCHEMA}.rooms SET phase='signal', timer_end=%s, spots_json=%s, "
            f"eliminated_this_round=NULL WHERE id=%s",
            (signal_end, json.dumps(spots), room_id)
        )
        db.commit()
        room = get_room(db, room_id)

    elif phase == 'signal' and now_ms >= timer_end:
        active = [p for p in players if not p['eliminated']]
        unparked = [p for p in active if not p['parked']]
        cur = db.cursor()
        eliminated_id = None

        if room['round'] > 0 and unparked:
            elim = sorted(unparked, key=lambda p: p['hp'] / max(p['max_hp'], 1))[0]
            eliminated_id = elim['player_id']
            cur.execute(
                f"UPDATE {SCHEMA}.room_players SET eliminated=TRUE WHERE room_id=%s AND player_id=%s",
                (room_id, eliminated_id)
            )

        round_end_end = now_ms + ROUND_END_DURATION
        cur.execute(
            f"UPDATE {SCHEMA}.rooms SET phase='roundEnd', timer_end=%s, eliminated_this_round=%s WHERE id=%s",
            (round_end_end, eliminated_id, room_id)
        )
        db.commit()
        players = get_room_players(db, room_id)
        room = get_room(db, room_id)

    elif phase == 'roundEnd' and now_ms >= timer_end:
        active = [p for p in players if not p['eliminated']]
        new_round = room['round'] + 1
        cur = db.cursor()

        if len(active) <= 1 or new_round > 9:
            cur.execute(
                f"UPDATE {SCHEMA}.rooms SET status='finished', phase='winner', "
                f"eliminated_this_round=NULL WHERE id=%s",
                (room_id,)
            )
            db.commit()
            room = get_room(db, room_id)
        else:
            is_final = len(active) == 2
            spot_count = 1 if is_final else len(active) - 1
            spots = make_spots(spot_count)
            round_secs = 5000 + int(random.random() * 7000)
            new_timer_end = now_ms + round_secs
            cur.execute(
                f"UPDATE {SCHEMA}.rooms SET round=%s, phase='driving', timer_end=%s, "
                f"spots_json=%s, eliminated_this_round=NULL WHERE id=%s",
                (new_round, new_timer_end, json.dumps(spots), room_id)
            )
            cur.execute(
                f"UPDATE {SCHEMA}.room_players SET parked=FALSE, park_spot=-1 "
                f"WHERE room_id=%s AND NOT eliminated",
                (room_id,)
            )
            db.commit()
            players = get_room_players(db, room_id)
            room = get_room(db, room_id)

    return room, players


def find_or_create_room(db, friend_codes: list = None) -> str:
    cur = db.cursor()
    now_ms = int(time.time() * 1000)
    stale_threshold = now_ms - 60_000

    if friend_codes:
        for code in friend_codes:
            cur.execute(
                f"SELECT r.id FROM {SCHEMA}.rooms r "
                f"JOIN {SCHEMA}.room_players rp ON rp.room_id = r.id "
                f"WHERE r.status='waiting' AND r.timer_end > %s "
                f"AND rp.is_bot=false AND upper(rp.player_id) LIKE %s "
                f"ORDER BY r.created_at LIMIT 1",
                (stale_threshold, f'%{code.upper()}%')
            )
            row = cur.fetchone()
            if row:
                return row[0]

    # Ищем существующую комнату ожидания
    cur.execute(
        f"SELECT r.id FROM {SCHEMA}.rooms r "
        f"WHERE r.status='waiting' AND r.timer_end > %s "
        f"ORDER BY r.created_at LIMIT 1",
        (stale_threshold,)
    )
    row = cur.fetchone()
    if row:
        return row[0]

    # Создаём новую комнату, лобби заканчивается на ближайшем глобальном слоте
    room_id = str(uuid.uuid4())
    spots = make_spots(MAX_PLAYERS)
    lobby_end = get_next_slot_ms()
    cur.execute(
        f"INSERT INTO {SCHEMA}.rooms (id, status, round, phase, timer_end, spots_json, "
        f"created_at, started_at, max_players, eliminated_this_round) "
        f"VALUES (%s, 'waiting', 0, 'lobby', %s, %s, %s, 0, %s, NULL)",
        (room_id, lobby_end, json.dumps(spots), now_ms, MAX_PLAYERS)
    )
    db.commit()
    return room_id


def add_bots(db, room_id: str, players: list, max_players: int):
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


def maybe_start_room(db, room_id: str, room: dict, players: list):
    if room['status'] != 'waiting':
        return room, players

    now_ms = int(time.time() * 1000)
    real_players = [p for p in players if not p['is_bot']]
    should_start = (
        len(players) >= MAX_PLAYERS or
        (now_ms >= room['timer_end'] and len(real_players) >= LOBBY_MIN_REAL)
    )
    if not should_start:
        return room, players

    add_bots(db, room_id, players, MAX_PLAYERS)
    players = get_room_players(db, room_id)
    spots = make_spots(MAX_PLAYERS)
    # Первый раунд стартует через 7 сек после старта лобби
    round_timer = now_ms + 7000
    cur = db.cursor()
    cur.execute(
        f"UPDATE {SCHEMA}.rooms SET status='playing', round=0, phase='driving', "
        f"timer_end=%s, spots_json=%s, started_at=%s WHERE id=%s",
        (round_timer, json.dumps(spots), now_ms, room_id)
    )
    db.commit()
    room = get_room(db, room_id)
    return room, players


def build_response(room: dict, players: list, room_id: str = None) -> dict:
    active = [p for p in players if not p['eliminated']]
    is_final = len(active) == 2 and room['phase'] in ('driving', 'signal')
    resp = {
        'status': room['status'],
        'round': room['round'],
        'phase': room['phase'],
        'timerEnd': room['timer_end'],
        'serverNow': int(time.time() * 1000),
        'spots': room['spots'],
        'players': players,
        'isFinal': is_final,
        'eliminatedThisRound': room.get('eliminated_this_round'),
    }
    if room_id:
        resp['roomId'] = room_id
    return resp


@router.post("")
def room_handler(body: dict):
    action = body.get('action', '')
    db = get_conn()

    try:
        if action == 'join':
            player_id = body.get('playerId', '')
            name = body.get('name', 'Игрок')[:16]
            emoji = body.get('emoji', '🚗')
            color = body.get('color', '#FF2D55')
            body_color = body.get('bodyColor', '#CC0033')
            max_hp = float(body.get('maxHp', 100))

            if not player_id:
                raise HTTPException(400, 'playerId required')

            friend_codes = body.get('friendCodes', []) or []
            room_id = find_or_create_room(db, friend_codes)
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
                    f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                    f"ON CONFLICT (room_id, player_id) DO UPDATE SET last_seen=%s",
                    (room_id, player_id, name, emoji, color, body_color,
                     x, y, orbit_angle + math.pi, 0, max_hp, max_hp,
                     orbit_angle, orbit_radius, False, -1, False, False, now_ms, now_ms)
                )
                db.commit()
                players = get_room_players(db, room_id)

            room = get_room(db, room_id)
            room, players = maybe_start_room(db, room_id, room, players)
            room, players = tick_room(db, room_id, room, players)

            return build_response(room, players, room_id)

        elif action == 'state':
            room_id = body.get('roomId', '')
            if not room_id:
                raise HTTPException(400, 'roomId required')

            room = get_room(db, room_id)
            if not room:
                raise HTTPException(404, 'room not found')

            players = get_room_players(db, room_id)
            room, players = maybe_start_room(db, room_id, room, players)
            room, players = tick_room(db, room_id, room, players)

            return build_response(room, players)

        elif action == 'move':
            room_id = body.get('roomId', '')
            player_id = body.get('playerId', '')
            if not room_id or not player_id:
                raise HTTPException(400, 'roomId and playerId required')

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

            if body.get('parked') and body.get('parkSpot', -1) >= 0:
                room = get_room(db, room_id)
                spots = room['spots']
                spot_idx = int(body['parkSpot'])
                if 0 <= spot_idx < len(spots) and not spots[spot_idx]['occupied']:
                    spots[spot_idx]['occupied'] = True
                    spots[spot_idx]['car_id'] = player_id
                    cur.execute(
                        f"UPDATE {SCHEMA}.rooms SET spots_json=%s WHERE id=%s",
                        (json.dumps(spots), room_id)
                    )
                    db.commit()

            players = get_room_players(db, room_id)
            room = get_room(db, room_id)
            room, players = tick_room(db, room_id, room, players)

            return build_response(room, players)

        elif action == 'eliminate':
            room_id = body.get('roomId', '')
            target_id = body.get('targetPlayerId', '')
            if not room_id or not target_id:
                raise HTTPException(400, 'roomId and targetPlayerId required')
            cur = db.cursor()
            cur.execute(
                f"UPDATE {SCHEMA}.room_players SET eliminated=TRUE WHERE room_id=%s AND player_id=%s",
                (room_id, target_id)
            )
            db.commit()
            return {'ok': True}

        elif action == 'leave':
            room_id = body.get('roomId', '')
            player_id = body.get('playerId', '')
            if not room_id or not player_id:
                raise HTTPException(400, 'roomId and playerId required')
            cur = db.cursor()
            cur.execute(
                f"UPDATE {SCHEMA}.room_players SET eliminated=TRUE WHERE room_id=%s AND player_id=%s",
                (room_id, player_id)
            )
            db.commit()
            return {'ok': True}

        else:
            raise HTTPException(400, f'unknown action: {action}')

    finally:
        db.close()
