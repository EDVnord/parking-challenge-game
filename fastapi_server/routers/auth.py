import json
import hashlib
from fastapi import APIRouter, HTTPException
from database import get_conn
from config import SCHEMA

router = APIRouter(prefix="/auth", tags=["auth"])


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def row_to_profile(row) -> dict:
    result = {
        'id': row[0],
        'name': row[1],
        'emoji': row[2],
        'coins': row[4],
        'gems': row[5],
        'xp': row[6],
        'wins': row[7],
        'gamesPlayed': row[8],
        'bestPosition': row[9],
        'selectedCar': row[10],
        'ownedCars': [int(x) for x in row[11].split(',') if x],
        'upgrades': json.loads(row[12]) if row[12] else {},
    }
    if len(row) > 13 and row[13]:
        result['cars'] = json.loads(row[13])
    if len(row) > 14 and row[14]:
        extra = json.loads(row[14])
        result.update({
            'extraLives': extra.get('extraLives', 0),
            'coinBoostSessions': extra.get('coinBoostSessions', 0),
            'xpBoostGames': extra.get('xpBoostGames', 0),
            'loginStreak': extra.get('loginStreak', 0),
            'lastLoginDate': extra.get('lastLoginDate', ''),
            'level': extra.get('level', 1),
            'dailyQuests': extra.get('dailyQuests', []),
            'dailyQuestsDate': extra.get('dailyQuestsDate', ''),
            'weeklyQuests': extra.get('weeklyQuests', []),
            'weeklyQuestsDate': extra.get('weeklyQuestsDate', ''),
            'upgradeExpiry': extra.get('upgradeExpiry', {}),
            'nicknameChanges': extra.get('nicknameChanges', 0),
        })
    return result


@router.post("")
def auth_handler(body: dict):
    action = body.get('action', '')
    conn = get_conn()
    cur = conn.cursor()

    try:
        if action == 'register':
            name = (body.get('name') or '').strip()
            emoji = body.get('emoji', '😎')
            password = body.get('password', '')

            if len(name) < 2 or len(name) > 16:
                raise HTTPException(400, 'Имя должно быть от 2 до 16 символов')
            if len(password) < 4:
                raise HTTPException(400, 'Пароль минимум 4 символа')

            pw_hash = hash_password(password)
            cur.execute(f'SELECT id FROM {SCHEMA}.players WHERE LOWER(name) = LOWER(%s)', (name,))
            if cur.fetchone():
                raise HTTPException(400, 'Этот ник уже занят. Выбери другой!')

            cur.execute(
                f'''INSERT INTO {SCHEMA}.players
                    (name, emoji, password_hash, coins, gems, xp, wins, games_played,
                     best_position, selected_car, owned_cars, upgrades)
                    VALUES (%s, %s, %s, 1000, 50, 0, 0, 0, 99, 0, '0', '{{}}')
                    RETURNING id, name, emoji, password_hash, coins, gems, xp, wins,
                    games_played, best_position, selected_car, owned_cars, upgrades''',
                (name, emoji, pw_hash)
            )
            row = cur.fetchone()
            conn.commit()
            return {'success': True, 'profile': row_to_profile(row)}

        elif action == 'login':
            name = (body.get('name') or '').strip()
            password = body.get('password', '')

            if not name or not password:
                raise HTTPException(400, 'Введи ник и пароль')

            pw_hash = hash_password(password)
            cur.execute(
                f'''SELECT id, name, emoji, password_hash, coins, gems, xp, wins,
                    games_played, best_position, selected_car, owned_cars, upgrades
                    FROM {SCHEMA}.players WHERE LOWER(name) = LOWER(%s)''',
                (name,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(400, 'Игрок с таким ником не найден')
            if row[3] != pw_hash:
                raise HTTPException(400, 'Неверный пароль')
            return {'success': True, 'profile': row_to_profile(row)}

        elif action == 'save':
            name = (body.get('name') or '').strip()
            password = body.get('password', '')
            profile = body.get('profile', {})

            if not name or not password:
                raise HTTPException(400, 'Нет авторизации')

            pw_hash = hash_password(password)
            cur.execute(
                f'SELECT id FROM {SCHEMA}.players WHERE LOWER(name) = LOWER(%s) AND password_hash = %s',
                (name, pw_hash)
            )
            if not cur.fetchone():
                raise HTTPException(401, 'Ошибка авторизации')

            owned_cars = ','.join(str(x) for x in (profile.get('ownedCars') or [0]))
            upgrades = json.dumps(profile.get('upgrades') or {})

            cur.execute(
                f'''UPDATE {SCHEMA}.players SET
                    emoji=%s, coins=%s, gems=%s, xp=%s, wins=%s, games_played=%s,
                    best_position=%s, selected_car=%s, owned_cars=%s, upgrades=%s,
                    updated_at=NOW()
                    WHERE LOWER(name) = LOWER(%s)''',
                (
                    profile.get('emoji', '😎'),
                    max(0, int(profile.get('coins', 0))),
                    max(0, int(profile.get('gems', 0))),
                    max(0, int(profile.get('xp', 0))),
                    max(0, int(profile.get('wins', 0))),
                    max(0, int(profile.get('gamesPlayed', 0))),
                    int(profile.get('bestPosition', 99)),
                    int(profile.get('selectedCar', 0)),
                    owned_cars, upgrades, name
                )
            )
            conn.commit()
            return {'success': True}

        elif action == 'save_ya':
            ya_id = (body.get('yaId') or '').strip()
            profile = body.get('profile', {})

            if not ya_id:
                raise HTTPException(400, 'Нет yaId')

            name = (profile.get('name') or 'Игрок').strip()[:16] or 'Игрок'
            emoji = profile.get('emoji', '😎')
            coins = max(0, int(profile.get('coins', 0)))
            gems = max(0, int(profile.get('gems', 0)))
            xp = max(0, int(profile.get('xp', 0)))
            wins = max(0, int(profile.get('wins', 0)))
            games_played = max(0, int(profile.get('gamesPlayed', 0)))
            best_position = int(profile.get('bestPosition', 99))
            selected_car = int(profile.get('selectedCar', 0))
            owned_cars = ','.join(str(x) for x in (profile.get('ownedCars') or [0]))
            upgrades = json.dumps(profile.get('upgrades') or {})
            cars_json = json.dumps(profile.get('cars') or []) if profile.get('cars') else None
            extra_data = json.dumps({
                'extraLives': profile.get('extraLives', 0),
                'coinBoostSessions': profile.get('coinBoostSessions', 0),
                'xpBoostGames': profile.get('xpBoostGames', 0),
                'loginStreak': profile.get('loginStreak', 0),
                'lastLoginDate': profile.get('lastLoginDate', ''),
                'level': profile.get('level', 1),
                'dailyQuests': profile.get('dailyQuests', []),
                'dailyQuestsDate': profile.get('dailyQuestsDate', ''),
                'weeklyQuests': profile.get('weeklyQuests', []),
                'weeklyQuestsDate': profile.get('weeklyQuestsDate', ''),
                'upgradeExpiry': profile.get('upgradeExpiry', {}),
                'nicknameChanges': profile.get('nicknameChanges', 0),
            })

            # Если ya-профиля нет — ищем по имени и привязываем ya_id автоматически
            cur.execute(f'SELECT id FROM {SCHEMA}.players WHERE ya_id = %s LIMIT 1', (ya_id,))
            if not cur.fetchone():
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.players WHERE LOWER(name) = LOWER(%s) AND ya_id IS NULL LIMIT 1",
                    (name,)
                )
                row = cur.fetchone()
                if row:
                    cur.execute(f'UPDATE {SCHEMA}.players SET ya_id = %s, anon_id = NULL, updated_at = NOW() WHERE id = %s', (ya_id, row[0]))
                    conn.commit()
                    return {'success': True}

            cur.execute(
                f'''INSERT INTO {SCHEMA}.players
                    (ya_id, name, emoji, coins, gems, xp, wins, games_played,
                     best_position, selected_car, owned_cars, upgrades, cars, extra_data)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (ya_id) DO UPDATE SET
                    name=EXCLUDED.name, emoji=EXCLUDED.emoji, coins=EXCLUDED.coins,
                    gems=EXCLUDED.gems, xp=EXCLUDED.xp, wins=EXCLUDED.wins,
                    games_played=EXCLUDED.games_played, best_position=EXCLUDED.best_position,
                    selected_car=EXCLUDED.selected_car, owned_cars=EXCLUDED.owned_cars,
                    upgrades=EXCLUDED.upgrades, cars=EXCLUDED.cars,
                    extra_data=EXCLUDED.extra_data, updated_at=NOW()''',
                (ya_id, name, emoji, coins, gems, xp, wins, games_played,
                 best_position, selected_car, owned_cars, upgrades, cars_json, extra_data)
            )
            conn.commit()
            return {'success': True}

        elif action == 'load_ya':
            ya_id = (body.get('yaId') or '').strip()
            if not ya_id:
                raise HTTPException(400, 'Нет yaId')

            cur.execute(
                f'''SELECT id, name, emoji, password_hash, coins, gems, xp, wins,
                    games_played, best_position, selected_car, owned_cars, upgrades, cars, extra_data
                    FROM {SCHEMA}.players WHERE ya_id = %s LIMIT 1''',
                (ya_id,)
            )
            row = cur.fetchone()
            if not row:
                return {'found': False}
            return {'found': True, 'profile': row_to_profile(row)}

        elif action == 'save_anon':
            anon_id = (body.get('anonId') or body.get('playerId') or '').strip()
            profile = body.get('profile', {})

            if not anon_id:
                raise HTTPException(400, 'Нет anonId')

            name = (profile.get('name') or 'Гость').strip()[:16] or 'Гость'
            emoji = profile.get('emoji', '😎')
            coins = max(0, int(profile.get('coins', 0)))
            gems = max(0, int(profile.get('gems', 0)))
            xp = max(0, int(profile.get('xp', 0)))
            wins = max(0, int(profile.get('wins', 0)))
            games_played = max(0, int(profile.get('gamesPlayed', 0)))
            best_position = int(profile.get('bestPosition', 99))
            selected_car = int(profile.get('selectedCar', 0))
            owned_cars = ','.join(str(x) for x in (profile.get('ownedCars') or [0]))
            upgrades = json.dumps(profile.get('upgrades') or {})
            cars_json = json.dumps(profile.get('cars') or []) if profile.get('cars') else None
            extra_data = json.dumps({
                'extraLives': profile.get('extraLives', 0),
                'coinBoostSessions': profile.get('coinBoostSessions', 0),
                'xpBoostGames': profile.get('xpBoostGames', 0),
                'loginStreak': profile.get('loginStreak', 0),
                'lastLoginDate': profile.get('lastLoginDate', ''),
                'level': profile.get('level', 1),
                'dailyQuests': profile.get('dailyQuests', []),
                'dailyQuestsDate': profile.get('dailyQuestsDate', ''),
                'weeklyQuests': profile.get('weeklyQuests', []),
                'weeklyQuestsDate': profile.get('weeklyQuestsDate', ''),
                'upgradeExpiry': profile.get('upgradeExpiry', {}),
                'nicknameChanges': profile.get('nicknameChanges', 0),
            })

            # Если игрок с таким anon_id не найден — ищем по имени и привязываем
            cur.execute(f'SELECT id FROM {SCHEMA}.players WHERE anon_id = %s LIMIT 1', (anon_id,))
            if not cur.fetchone():
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.players WHERE LOWER(name) = LOWER(%s) AND (password_hash = '' OR password_hash IS NULL) AND anon_id IS NULL AND ya_id IS NULL LIMIT 1",
                    (name,)
                )
                row = cur.fetchone()
                if row:
                    cur.execute(f'UPDATE {SCHEMA}.players SET anon_id = %s WHERE id = %s', (anon_id, row[0]))
                    conn.commit()

            cur.execute(
                f'''INSERT INTO {SCHEMA}.players
                    (anon_id, name, emoji, coins, gems, xp, wins, games_played,
                     best_position, selected_car, owned_cars, upgrades, cars, extra_data)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (anon_id) DO UPDATE SET
                    name=EXCLUDED.name, emoji=EXCLUDED.emoji, coins=EXCLUDED.coins,
                    gems=EXCLUDED.gems, xp=EXCLUDED.xp, wins=EXCLUDED.wins,
                    games_played=EXCLUDED.games_played, best_position=EXCLUDED.best_position,
                    selected_car=EXCLUDED.selected_car, owned_cars=EXCLUDED.owned_cars,
                    upgrades=EXCLUDED.upgrades, cars=EXCLUDED.cars,
                    extra_data=EXCLUDED.extra_data, updated_at=NOW()''',
                (anon_id, name, emoji, coins, gems, xp, wins, games_played,
                 best_position, selected_car, owned_cars, upgrades, cars_json, extra_data)
            )
            conn.commit()
            return {'success': True}

        elif action == 'load_anon':
            anon_id = (body.get('anonId') or body.get('playerId') or '').strip()
            if not anon_id:
                raise HTTPException(400, 'Нет anonId')

            cur.execute(
                f'''SELECT id, name, emoji, password_hash, coins, gems, xp, wins,
                    games_played, best_position, selected_car, owned_cars, upgrades, cars, extra_data
                    FROM {SCHEMA}.players WHERE anon_id = %s LIMIT 1''',
                (anon_id,)
            )
            row = cur.fetchone()
            if not row:
                return {'found': False}
            return {'found': True, 'profile': row_to_profile(row)}

        elif action == 'merge_ya_with_anon':
            ya_id = (body.get('yaId') or '').strip()
            anon_id = (body.get('anonId') or '').strip()
            search_name = (body.get('searchName') or '').strip()
            if not ya_id:
                raise HTTPException(400, 'Нужен yaId')

            # Ищем ya-профиль
            cur.execute(
                f'SELECT id, coins, gems, xp, wins, games_played, best_position FROM {SCHEMA}.players WHERE ya_id = %s LIMIT 1',
                (ya_id,)
            )
            ya_row = cur.fetchone()

            # Ищем anon-профиль — по anon_id или по имени
            anon_row = None
            if anon_id:
                cur.execute(
                    f'SELECT id, coins, gems, xp, wins, games_played, best_position FROM {SCHEMA}.players WHERE anon_id = %s LIMIT 1',
                    (anon_id,)
                )
                anon_row = cur.fetchone()

            # Если не нашли по anon_id — ищем по имени (без ya_id и без пароля)
            if not anon_row and search_name:
                cur.execute(
                    f"SELECT id, coins, gems, xp, wins, games_played, best_position FROM {SCHEMA}.players WHERE LOWER(name) = LOWER(%s) AND ya_id IS NULL AND (password_hash = '' OR password_hash IS NULL) LIMIT 1",
                    (search_name,)
                )
                anon_row = cur.fetchone()

            if not anon_row:
                return {'merged': False, 'reason': 'anon_not_found'}

            if ya_row:
                # ya-профиль уже есть — берём лучшие значения из обоих
                ya_id_db = ya_row[0]
                anon_id_db = anon_row[0]
                if ya_id_db == anon_id_db:
                    return {'merged': False, 'reason': 'same_profile'}
                merged_coins = max(ya_row[1], anon_row[1])
                merged_gems = max(ya_row[2], anon_row[2])
                merged_xp = max(ya_row[3], anon_row[3])
                merged_wins = max(ya_row[4], anon_row[4])
                merged_games = max(ya_row[5], anon_row[5])
                merged_best = min(ya_row[6], anon_row[6])
                cur.execute(
                    f'''UPDATE {SCHEMA}.players SET
                        coins=%s, gems=%s, xp=%s, wins=%s, games_played=%s,
                        best_position=%s, updated_at=NOW()
                        WHERE ya_id=%s''',
                    (merged_coins, merged_gems, merged_xp, merged_wins, merged_games, merged_best, ya_id)
                )
                # Удаляем anon-профиль
                cur.execute(f'DELETE FROM {SCHEMA}.players WHERE anon_id=%s', (anon_id,))
                conn.commit()
                # Возвращаем обновлённый ya-профиль
                cur.execute(
                    f'''SELECT id, name, emoji, password_hash, coins, gems, xp, wins,
                        games_played, best_position, selected_car, owned_cars, upgrades, cars, extra_data
                        FROM {SCHEMA}.players WHERE ya_id = %s LIMIT 1''',
                    (ya_id,)
                )
                row = cur.fetchone()
                return {'merged': True, 'profile': row_to_profile(row)}
            else:
                # ya-профиля ещё нет — просто привязываем ya_id к anon-профилю
                cur.execute(
                    f'UPDATE {SCHEMA}.players SET ya_id=%s, anon_id=NULL, updated_at=NOW() WHERE anon_id=%s',
                    (ya_id, anon_id)
                )
                conn.commit()
                cur.execute(
                    f'''SELECT id, name, emoji, password_hash, coins, gems, xp, wins,
                        games_played, best_position, selected_car, owned_cars, upgrades, cars, extra_data
                        FROM {SCHEMA}.players WHERE ya_id = %s LIMIT 1''',
                    (ya_id,)
                )
                row = cur.fetchone()
                return {'merged': True, 'profile': row_to_profile(row)}

        elif action == 'count':
            cur.execute(f'SELECT COUNT(*) FROM {SCHEMA}.players')
            row = cur.fetchone()
            return {'count': row[0] if row else 0}

        else:
            raise HTTPException(400, f'Неизвестный action: {action}')

    finally:
        cur.close()
        conn.close()