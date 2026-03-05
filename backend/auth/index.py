"""
Авторизация игры 'Король парковки': регистрация, логин, сохранение, счётчик.
POST / с полем action: register | login | save | save_ya | save_anon | count
"""
import json
import os
import hashlib
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p25425030_parking_challenge_ga')

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def ok(data: dict) -> dict:
    return {'statusCode': 200, 'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'}, 'body': json.dumps(data)}

def err(msg: str, code: int = 400) -> dict:
    return {'statusCode': code, 'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'}, 'body': json.dumps({'error': msg})}

def row_to_profile(row) -> dict:
    return {
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

def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    if event.get('httpMethod') != 'POST':
        return err('Method not allowed', 405)

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return err('Invalid JSON')

    action = body.get('action', '')
    conn = get_conn()
    cur = conn.cursor()

    try:
        if action == 'register':
            name = (body.get('name') or '').strip()
            emoji = body.get('emoji', '😎')
            password = body.get('password', '')

            if len(name) < 2 or len(name) > 16:
                return err('Имя должно быть от 2 до 16 символов')
            if len(password) < 4:
                return err('Пароль минимум 4 символа')

            pw_hash = hash_password(password)

            # Проверяем уникальность ника
            cur.execute(f'SELECT id FROM {SCHEMA}.players WHERE LOWER(name) = LOWER(%s)', (name,))
            if cur.fetchone():
                return err('Этот ник уже занят. Выбери другой!')

            cur.execute(
                f'''INSERT INTO {SCHEMA}.players (name, emoji, password_hash, coins, gems, xp, wins, games_played, best_position, selected_car, owned_cars, upgrades)
                    VALUES (%s, %s, %s, 1000, 50, 0, 0, 0, 99, 0, '0', '{{}}')
                    RETURNING id, name, emoji, password_hash, coins, gems, xp, wins, games_played, best_position, selected_car, owned_cars, upgrades''',
                (name, emoji, pw_hash)
            )
            row = cur.fetchone()
            conn.commit()
            return ok({'success': True, 'profile': row_to_profile(row)})

        elif action == 'login':
            name = (body.get('name') or '').strip()
            password = body.get('password', '')

            if not name or not password:
                return err('Введи ник и пароль')

            pw_hash = hash_password(password)
            cur.execute(
                f'''SELECT id, name, emoji, password_hash, coins, gems, xp, wins, games_played, best_position, selected_car, owned_cars, upgrades
                    FROM {SCHEMA}.players WHERE LOWER(name) = LOWER(%s)''',
                (name,)
            )
            row = cur.fetchone()
            if not row:
                return err('Игрок с таким ником не найден')
            if row[3] != pw_hash:
                return err('Неверный пароль')

            return ok({'success': True, 'profile': row_to_profile(row)})

        elif action == 'save':
            name = (body.get('name') or '').strip()
            password = body.get('password', '')
            profile = body.get('profile', {})

            if not name or not password:
                return err('Нет авторизации')

            pw_hash = hash_password(password)
            cur.execute(
                f'SELECT id FROM {SCHEMA}.players WHERE LOWER(name) = LOWER(%s) AND password_hash = %s',
                (name, pw_hash)
            )
            if not cur.fetchone():
                return err('Ошибка авторизации', 401)

            owned_cars = ','.join(str(x) for x in (profile.get('ownedCars') or [0]))
            upgrades = json.dumps(profile.get('upgrades') or {})

            cur.execute(
                f'''UPDATE {SCHEMA}.players SET
                    emoji = %s, coins = %s, gems = %s, xp = %s,
                    wins = %s, games_played = %s, best_position = %s,
                    selected_car = %s, owned_cars = %s, upgrades = %s,
                    updated_at = NOW()
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
                    owned_cars,
                    upgrades,
                    name
                )
            )
            conn.commit()
            return ok({'success': True})

        elif action == 'save_ya':
            ya_id = (body.get('yaId') or '').strip()
            profile = body.get('profile', {})

            if not ya_id:
                return err('Нет yaId')

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

            cur.execute(
                f'''INSERT INTO {SCHEMA}.players (name, emoji, password_hash, coins, gems, xp, wins, games_played, best_position, selected_car, owned_cars, upgrades, ya_id)
                    VALUES (%s, %s, '', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (ya_id) DO UPDATE SET
                        name = EXCLUDED.name, emoji = EXCLUDED.emoji,
                        coins = EXCLUDED.coins, gems = EXCLUDED.gems, xp = EXCLUDED.xp,
                        wins = EXCLUDED.wins, games_played = EXCLUDED.games_played,
                        best_position = EXCLUDED.best_position, selected_car = EXCLUDED.selected_car,
                        owned_cars = EXCLUDED.owned_cars, upgrades = EXCLUDED.upgrades,
                        updated_at = NOW()''',
                (name, emoji, coins, gems, xp, wins, games_played, best_position, selected_car, owned_cars, upgrades, ya_id)
            )
            conn.commit()
            return ok({'success': True})

        elif action == 'save_anon':
            anon_id = (body.get('playerId') or '').strip()
            profile = body.get('profile', {})

            if not anon_id:
                return err('Нет playerId')

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

            cur.execute(
                f'''INSERT INTO {SCHEMA}.players (name, emoji, password_hash, coins, gems, xp, wins, games_played, best_position, selected_car, owned_cars, upgrades, anon_id)
                    VALUES (%s, %s, '', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (anon_id) DO UPDATE SET
                        name = EXCLUDED.name, emoji = EXCLUDED.emoji,
                        coins = EXCLUDED.coins, gems = EXCLUDED.gems, xp = EXCLUDED.xp,
                        wins = EXCLUDED.wins, games_played = EXCLUDED.games_played,
                        best_position = EXCLUDED.best_position, selected_car = EXCLUDED.selected_car,
                        owned_cars = EXCLUDED.owned_cars, upgrades = EXCLUDED.upgrades,
                        updated_at = NOW()''',
                (name, emoji, coins, gems, xp, wins, games_played, best_position, selected_car, owned_cars, upgrades, anon_id)
            )
            conn.commit()
            return ok({'success': True})

        elif action == 'count':
            cur.execute(f'SELECT COUNT(*) FROM {SCHEMA}.players')
            count = cur.fetchone()[0]
            return ok({'count': count})

        else:
            return err('Unknown action')

    except Exception as e:
        conn.rollback()
        return err(f'Server error: {str(e)}', 500)
    finally:
        cur.close()
        conn.close()