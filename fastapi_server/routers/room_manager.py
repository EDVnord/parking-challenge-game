import json
import uuid
import time
import math
import random
from fastapi import APIRouter, HTTPException
from database import get_conn

router = APIRouter(prefix="/room-manager", tags=["room-manager"])

SCHEMA = 't_p25425030_parking_challenge_ga'
MAX_PLAYERS = 10
LOBBY_TIMEOUT = 15
LOBBY_MIN_REAL = 1
SIGNAL_DURATION = 8000
ROUND_END_DURATION = 3000

BOT_NAMES = ['Вася', 'Петя', 'Коля', 'Маша', 'Катя', 'Женя', 'Саша', 'Лёша', 'Дима', 'Игорь']
BOT_EMOJIS = ['🚕', '🚙', '🏎️', '🚓', '🚑', '🚒', '🛻', '🚐', '🚌', '🚗']
BOT_COLORS = ['#007AFF', '#34C759', '#FF6B35', '#AF52DE', '#5AC8FA',
              '#FFD600', '#FF3B30', '#30D158', '#FF9F0A', '#FF2D55']
BOT_BODY = ['#0055CC', '#248A3D', '#CC4400', '#7B2FA8', '#0088CC',
            '#CC9900', '#AA0000', '#1A8833', '#CC6600', '#CC0033']

CANVAS_W, CANVAS_H = 800, 600
CENTER_X, CENTER_Y = 400, 300
ORBIT_R = 230
SPOT_COLS = 5
SPOT_COL_GAP = 66
SPOT_ROW_GAP = 80


def now_ms() -> int:
    return int(time.time() * 1000)


def make_spots(count: int) -> list:
    if count == 0:
        return []
    if count <= 6:
        spots = []
        radius = 0 if count == 1 else min(80, 50 + count * 8)
        for i in range(count):
            if count == 1:
                spots.append({'x': CENTER_X, 'y': CENTER_Y, 'occupied': False, 'car_id': None})
            elif count == 2:
                spots.append({'x': CENTER_X + (-70 if i == 0 else 70), 'y': CENTER_Y, 'occupied': False, 'car_id': None})
            else:
                angle = (i / count) * math.pi * 2 - math.pi / 2
                spots.append({
                    'x': CENTER_X + math.cos(angle) * radius,
                    'y': CENTER_Y + math.sin(angle) * radius,
                    'occupied': False, 'car_id': None,
                })
        return spots
    spots = []
    grid_w = (SPOT_COLS - 1) * SPOT_COL_GAP
    grid_h = (math.ceil(count / SPOT_COLS) - 1) * SPOT_ROW_GAP
    for i in range(count):
        col = i % SPOT_COLS
        row = i // SPOT_COLS
        spots.append({
            'x': CENTER_X - grid_w / 2 + col * SPOT_COL_GAP,
            'y': CENTER_Y - grid_h / 2 + row * SPOT_ROW_GAP,
            'occupied': False, 'car_id': None,
        })
    return spots


def get_room_players(db, room_id: str) -> list:
    cur = db.cursor()
    cur.execute(
        f"SELECT player_id, name, emoji, color, body_color, x, y, angle, speed, hp, max_hp, "
        f"orbit_angle, orbit_radius, parked, park_spot, eliminated, is_bot, last_seen, target_spot "
        f"FROM {SCHEMA}.room_players WHERE room_id=%s ORDER BY is_bot, player_id",
        (room_id,)
    )
    cols = ['player_id', 'name', 'emoji', 'color', 'body_color', 'x', 'y', 'angle', 'speed',
            'hp', 'max_hp', 'orbit_angle', 'orbit_radius', 'parked', 'park_spot',
            'eliminated', 'is_bot', 'last_seen', 'target_spot']
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def get_room(db, room_id: str):
    cur = db.cursor()
    cur.execute(
        f"SELECT id, status, round, phase, timer_end, spots_json, created_at, started_at, max_players "
        f"FROM {SCHEMA}.rooms WHERE id=%s",
        (room_id,)
    )
    row = cur.fetchone()
    if not row:
        return None
    cols = ['id', 'status', 'round', 'phase', 'timer_end', 'spots_json', 'created_at', 'started_at', 'max_players']
    d = dict(zip(cols, row))
    d['spots'] = json.loads(d['spots_json'])
    return d


def build_response(room: dict, players: list, room_id: str = None) -> dict:
    active = [p for p in players if not p['eliminated']]
    is_final = len(active) == 2
    resp = {
        'status': room['status'],
        'round': room['round'],
        'phase': room['phase'],
        'timerEnd': room['timer_end'],
        'serverNow': now_ms(),
        'spots': room['spots'],
        'players': players,
        'isFinal': is_final,
    }
    if room_id:
        resp['roomId'] = room_id
    return resp


def tick_bots(db, room_id: str, room: dict, players: list) -> list:
    """Двигает ботов на сервере — орбита в driving, к споту в signal."""
    t = now_ms()
    phase = room['phase']
    spots = room['spots']
    cur = db.cursor()
    changed = False

    for p in players:
        if not p['is_bot'] or p['eliminated'] or p['parked']:
            continue

        # В driving фазе — просто крутим orbit_angle
        if phase == 'driving':
            speed = 0.016 + 0.008 * (p['hp'] / max(p['max_hp'], 1))
            new_angle = p['orbit_angle'] + speed
            nx = CENTER_X + math.cos(new_angle) * ORBIT_R
            ny = CENTER_Y + math.sin(new_angle) * ORBIT_R
            cur.execute(
                f"UPDATE {SCHEMA}.room_players SET x=%s, y=%s, angle=%s, orbit_angle=%s, last_seen=%s "
                f"WHERE room_id=%s AND player_id=%s",
                (nx, ny, new_angle + math.pi, new_angle, t, room_id, p['player_id'])
            )
            p['x'], p['y'], p['orbit_angle'] = nx, ny, new_angle
            changed = True

        elif phase == 'signal':
            target_spot_idx = p.get('target_spot')

            # Назначаем целевой спот если ещё нет
            if target_spot_idx is None or target_spot_idx < 0:
                time_left_ms = room['timer_end'] - t
                health_ratio = p['hp'] / max(p['max_hp'], 1)
                hesitate_ms = int((1 - health_ratio) * 1500)
                reaction_ms = SIGNAL_DURATION - int(health_ratio * 3000) - hesitate_ms
                if time_left_ms < reaction_ms:
                    free = [(i, s) for i, s in enumerate(spots) if not s['occupied']]
                    if free:
                        # 75% выбор ближайшего, 25% случайный
                        if random.random() < 0.75:
                            free.sort(key=lambda x: math.hypot(x[1]['x'] - p['x'], x[1]['y'] - p['y']))
                            target_spot_idx = free[0][0]
                        else:
                            target_spot_idx = random.choice(free)[0]
                        cur.execute(
                            f"UPDATE {SCHEMA}.room_players SET target_spot=%s WHERE room_id=%s AND player_id=%s",
                            (target_spot_idx, room_id, p['player_id'])
                        )
                        p['target_spot'] = target_spot_idx
                        changed = True

            # Двигаемся к целевому споту
            if target_spot_idx is not None and target_spot_idx >= 0 and target_spot_idx < len(spots):
                spot = spots[target_spot_idx]
                if spot['occupied'] and spot['car_id'] != p['player_id']:
                    # Спот занят другим — переназначаем
                    cur.execute(
                        f"UPDATE {SCHEMA}.room_players SET target_spot=-1 WHERE room_id=%s AND player_id=%s",
                        (room_id, p['player_id'])
                    )
                    p['target_spot'] = None
                    changed = True
                    continue

                dx = spot['x'] - p['x']
                dy = spot['y'] - p['y']
                dist = math.hypot(dx, dy)
                if dist < 12:
                    # Припарковались
                    cur.execute(
                        f"UPDATE {SCHEMA}.room_players SET x=%s, y=%s, parked=TRUE, park_spot=%s, speed=0, target_spot=-1, last_seen=%s "
                        f"WHERE room_id=%s AND player_id=%s",
                        (spot['x'], spot['y'], target_spot_idx, t, room_id, p['player_id'])
                    )
                    spots[target_spot_idx]['occupied'] = True
                    spots[target_spot_idx]['car_id'] = p['player_id']
                    p['parked'] = True
                    changed = True
                else:
                    hp_factor = 0.6 + (p['hp'] / max(p['max_hp'], 1)) * 0.4
                    spd = min(2.5 * hp_factor, dist * 0.12)
                    nx = p['x'] + (dx / dist) * spd
                    ny = p['y'] + (dy / dist) * spd
                    angle = math.atan2(dx, -dy)
                    cur.execute(
                        f"UPDATE {SCHEMA}.room_players SET x=%s, y=%s, angle=%s, speed=%s, last_seen=%s "
                        f"WHERE room_id=%s AND player_id=%s",
                        (nx, ny, angle, spd, t, room_id, p['player_id'])
                    )
                    p['x'], p['y'], p['angle'] = nx, ny, angle
                    changed = True

    if changed:
        # Сохраняем обновлённые споты если были изменения
        new_spots_json = json.dumps(spots)
        cur.execute(f"UPDATE {SCHEMA}.rooms SET spots_json=%s WHERE id=%s", (new_spots_json, room_id))
        room['spots'] = spots
        db.commit()
        players = get_room_players(db, room_id)

    return players


def tick_phases(db, room_id: str, room: dict, players: list):
    """Переключает фазы по таймеру."""
    if room['status'] != 'playing':
        return room, players

    t = now_ms()
    phase = room['phase']
    timer_end = room['timer_end']

    if phase == 'driving' and t >= timer_end:
        active = [p for p in players if not p['eliminated']]
        spots_count = len(active) if room['round'] == 0 else max(1, len(active) - 1)
        spots = make_spots(spots_count)
        signal_end = t + SIGNAL_DURATION
        cur = db.cursor()
        cur.execute(
            f"UPDATE {SCHEMA}.rooms SET phase='signal', timer_end=%s, spots_json=%s WHERE id=%s",
            (signal_end, json.dumps(spots), room_id)
        )
        db.commit()
        room = get_room(db, room_id)
        players = get_room_players(db, room_id)

    elif phase == 'signal' and t >= timer_end:
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

        round_end = t + ROUND_END_DURATION
        cur.execute(
            f"UPDATE {SCHEMA}.rooms SET phase='roundEnd', timer_end=%s WHERE id=%s",
            (round_end, room_id)
        )
        db.commit()
        players = get_room_players(db, room_id)
        room = get_room(db, room_id)

    elif phase == 'roundEnd' and t >= timer_end:
        active = [p for p in players if not p['eliminated']]
        new_round = room['round'] + 1
        cur = db.cursor()

        if len(active) <= 1 or new_round > 9:
            cur.execute(
                f"UPDATE {SCHEMA}.rooms SET status='finished', phase='winner' WHERE id=%s",
                (room_id,)
            )
            db.commit()
            room = get_room(db, room_id)
            return room, get_room_players(db, room_id)

        round_secs = 3 + random.random() * 8
        new_timer_end = t + int(round_secs * 1000)
        spots_count = max(1, len(active) - 1)
        spots = make_spots(spots_count)

        cur.execute(
            f"UPDATE {SCHEMA}.rooms SET round=%s, phase='driving', timer_end=%s, spots_json=%s WHERE id=%s",
            (new_round, new_timer_end, json.dumps(spots), room_id)
        )
        cur.execute(
            f"UPDATE {SCHEMA}.room_players SET parked=FALSE, park_spot=-1, target_spot=-1 WHERE room_id=%s AND NOT eliminated",
            (room_id,)
        )
        db.commit()
        players = get_room_players(db, room_id)
        room = get_room(db, room_id)

    return room, players


def find_or_create_room(db) -> str:
    cur = db.cursor()
    t = now_ms()
    stale_threshold = t - 90_000

    cur.execute(
        f"SELECT id FROM {SCHEMA}.rooms "
        f"WHERE status='waiting' AND timer_end > %s "
        f"ORDER BY created_at LIMIT 1",
        (stale_threshold,)
    )
    row = cur.fetchone()
    if row:
        return row[0]

    room_id = str(uuid.uuid4())
    spots = make_spots(MAX_PLAYERS)
    cur.execute(
        f"INSERT INTO {SCHEMA}.rooms (id, status, round, phase, timer_end, spots_json, created_at, started_at, max_players) "
        f"VALUES (%s, 'waiting', 0, 'lobby', %s, %s, %s, 0, %s)",
        (room_id, t + LOBBY_TIMEOUT * 1000, json.dumps(spots), t, MAX_PLAYERS)
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
    t = now_ms()
    for _ in range(slots_needed):
        while f'bot_{bot_idx}' in existing_ids:
            bot_idx += 1
        bot_id = f'bot_{bot_idx}'
        name = BOT_NAMES[bot_idx % len(BOT_NAMES)]
        emoji = BOT_EMOJIS[bot_idx % len(BOT_EMOJIS)]
        color = BOT_COLORS[bot_idx % len(BOT_COLORS)]
        body_color = BOT_BODY[bot_idx % len(BOT_BODY)]
        total = len(players) + bot_idx + 1
        orbit_angle = (total / max_players) * math.pi * 2
        x = CENTER_X + math.cos(orbit_angle) * ORBIT_R
        y = CENTER_Y + math.sin(orbit_angle) * ORBIT_R
        cur.execute(
            f"INSERT INTO {SCHEMA}.room_players "
            f"(room_id, player_id, name, emoji, color, body_color, x, y, angle, speed, hp, max_hp, "
            f"orbit_angle, orbit_radius, parked, park_spot, eliminated, is_bot, last_seen, target_spot) "
            f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (room_id, bot_id, name, emoji, color, body_color,
             x, y, orbit_angle + math.pi, 0, 100, 100,
             orbit_angle, ORBIT_R, False, -1, False, True, t, -1)
        )
        existing_ids.add(bot_id)
        bot_idx += 1
    db.commit()


def maybe_start_room(db, room_id: str, room: dict, players: list):
    if room['status'] != 'waiting':
        return room, players

    t = now_ms()
    real_players = [p for p in players if not p['is_bot']]
    should_start = (
        len(players) >= MAX_PLAYERS or
        (t >= room['timer_end'] and len(real_players) >= LOBBY_MIN_REAL)
    )
    if not should_start:
        return room, players

    add_bots(db, room_id, players, MAX_PLAYERS)
    players = get_room_players(db, room_id)

    round_secs = 3 + random.random() * 8
    round_timer = t + int(round_secs * 1000)
    spots = make_spots(MAX_PLAYERS)

    cur = db.cursor()
    cur.execute(
        f"UPDATE {SCHEMA}.rooms SET status='playing', round=0, phase='driving', "
        f"timer_end=%s, spots_json=%s, started_at=%s WHERE id=%s",
        (round_timer, json.dumps(spots), t, room_id)
    )
    db.commit()
    room = get_room(db, room_id)
    return room, players


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

            room_id = find_or_create_room(db)
            players = get_room_players(db, room_id)

            already_in = any(p['player_id'] == player_id for p in players)
            if not already_in:
                idx = len(players)
                orbit_angle = (idx / MAX_PLAYERS) * math.pi * 2
                x = CENTER_X + math.cos(orbit_angle) * ORBIT_R
                y = CENTER_Y + math.sin(orbit_angle) * ORBIT_R
                t = now_ms()
                cur = db.cursor()
                cur.execute(
                    f"INSERT INTO {SCHEMA}.room_players "
                    f"(room_id, player_id, name, emoji, color, body_color, x, y, angle, speed, hp, max_hp, "
                    f"orbit_angle, orbit_radius, parked, park_spot, eliminated, is_bot, last_seen, target_spot) "
                    f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                    f"ON CONFLICT (room_id, player_id) DO UPDATE SET last_seen=%s",
                    (room_id, player_id, name, emoji, color, body_color,
                     x, y, orbit_angle + math.pi, 0, max_hp, max_hp,
                     orbit_angle, ORBIT_R, False, -1, False, False, t, -1, t)
                )
                db.commit()
                players = get_room_players(db, room_id)

            room = get_room(db, room_id)
            room, players = maybe_start_room(db, room_id, room, players)
            players = tick_bots(db, room_id, room, players)
            room, players = tick_phases(db, room_id, room, players)

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
            players = tick_bots(db, room_id, room, players)
            room, players = tick_phases(db, room_id, room, players)

            return build_response(room, players)

        elif action == 'move':
            room_id = body.get('roomId', '')
            player_id = body.get('playerId', '')
            if not room_id or not player_id:
                raise HTTPException(400, 'roomId and playerId required')

            t = now_ms()
            parked = bool(body.get('parked', False))
            park_spot = int(body.get('parkSpot', -1))

            cur = db.cursor()
            cur.execute(
                f"UPDATE {SCHEMA}.room_players SET "
                f"x=%s, y=%s, angle=%s, speed=%s, hp=%s, orbit_angle=%s, "
                f"parked=%s, park_spot=%s, eliminated=%s, last_seen=%s "
                f"WHERE room_id=%s AND player_id=%s AND is_bot=FALSE",
                (
                    float(body.get('x', CENTER_X)), float(body.get('y', CENTER_Y)),
                    float(body.get('angle', 0)), float(body.get('speed', 0)),
                    float(body.get('hp', 100)), float(body.get('orbitAngle', 0)),
                    parked, park_spot,
                    bool(body.get('eliminated', False)), t,
                    room_id, player_id
                )
            )

            if parked and park_spot >= 0:
                room = get_room(db, room_id)
                spots = room['spots']
                if park_spot < len(spots) and not spots[park_spot]['occupied']:
                    spots[park_spot]['occupied'] = True
                    spots[park_spot]['car_id'] = player_id
                    cur.execute(
                        f"UPDATE {SCHEMA}.rooms SET spots_json=%s WHERE id=%s",
                        (json.dumps(spots), room_id)
                    )

            db.commit()

            room = get_room(db, room_id)
            players = get_room_players(db, room_id)
            players = tick_bots(db, room_id, room, players)
            room, players = tick_phases(db, room_id, room, players)

            return build_response(room, players)

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

        else:
            raise HTTPException(400, f'unknown action: {action}')

    finally:
        db.close()
