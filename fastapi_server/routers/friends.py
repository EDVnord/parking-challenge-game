import hashlib
from fastapi import APIRouter, HTTPException
from database import get_conn
from config import SCHEMA

router = APIRouter(prefix="/friends", tags=["friends"])


def resolve_player_id(cur, body):
    ya_id = body.get('yaId', '')
    anon_id = body.get('playerId', '')
    if ya_id:
        cur.execute(f'SELECT id FROM {SCHEMA}.players WHERE ya_id = %s LIMIT 1', (ya_id,))
    elif anon_id:
        cur.execute(f'SELECT id FROM {SCHEMA}.players WHERE anon_id = %s LIMIT 1', (anon_id,))
    else:
        return None
    row = cur.fetchone()
    return row[0] if row else None


def ensure_friend_code(cur, conn, player_id):
    cur.execute(f'SELECT friend_code FROM {SCHEMA}.players WHERE id = %s', (player_id,))
    row = cur.fetchone()
    if row and row[0]:
        return row[0]
    base = hashlib.md5(str(player_id).encode()).hexdigest()[:8].upper()
    code = base[:6]
    cur.execute(f'UPDATE {SCHEMA}.players SET friend_code = %s WHERE id = %s', (code, player_id))
    conn.commit()
    return code


@router.post("/")
def friends_handler(body: dict):
    action = body.get('action', '')
    conn = get_conn()
    cur = conn.cursor()

    try:
        if action == 'lookup':
            code = (body.get('code') or '').strip().upper()
            if len(code) < 6:
                raise HTTPException(400, 'Код слишком короткий')
            cur.execute(
                f'SELECT id, name, emoji, friend_code FROM {SCHEMA}.players WHERE UPPER(friend_code) = %s LIMIT 1',
                (code,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(400, 'Игрок с таким кодом не найден')
            return {'found': True, 'id': row[0], 'name': row[1], 'emoji': row[2], 'code': row[3]}

        elif action == 'add':
            my_id = resolve_player_id(cur, body)
            if not my_id:
                raise HTTPException(400, 'Игрок не найден')

            friend_code = (body.get('code') or '').strip().upper()
            if len(friend_code) < 6:
                raise HTTPException(400, 'Неверный код друга')

            cur.execute(
                f'SELECT id, name, emoji FROM {SCHEMA}.players WHERE UPPER(friend_code) = %s LIMIT 1',
                (friend_code,)
            )
            friend_row = cur.fetchone()
            if not friend_row:
                raise HTTPException(400, 'Игрок с таким кодом не найден')

            friend_id = friend_row[0]
            if friend_id == my_id:
                raise HTTPException(400, 'Нельзя добавить себя')

            cur.execute(
                f'SELECT id FROM {SCHEMA}.friends WHERE (player_id = %s AND friend_id = %s)',
                (my_id, friend_id)
            )
            if cur.fetchone():
                raise HTTPException(400, 'Этот игрок уже в друзьях')

            cur.execute(
                f'INSERT INTO {SCHEMA}.friends (player_id, friend_id, status) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING',
                (my_id, friend_id, 'accepted')
            )
            cur.execute(
                f'INSERT INTO {SCHEMA}.friends (player_id, friend_id, status) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING',
                (friend_id, my_id, 'accepted')
            )
            conn.commit()
            return {'success': True, 'friend': {'name': friend_row[1], 'emoji': friend_row[2], 'code': friend_code}}

        elif action == 'list':
            my_id = resolve_player_id(cur, body)
            if not my_id:
                return {'friends': [], 'myCode': None}

            my_code = ensure_friend_code(cur, conn, my_id)
            cur.execute(
                f'''SELECT p.id, p.name, p.emoji, p.friend_code, p.xp, p.wins, f.games_together
                    FROM {SCHEMA}.friends f
                    JOIN {SCHEMA}.players p ON p.id = f.friend_id
                    WHERE f.player_id = %s
                    ORDER BY f.created_at DESC''',
                (my_id,)
            )
            rows = cur.fetchall()
            friends = [
                {'id': r[0], 'name': r[1], 'emoji': r[2], 'code': r[3], 'xp': r[4], 'wins': r[5], 'gamesTogether': r[6]}
                for r in rows
            ]
            return {'friends': friends, 'myCode': my_code}

        elif action == 'remove':
            my_id = resolve_player_id(cur, body)
            if not my_id:
                raise HTTPException(400, 'Игрок не найден')
            friend_code = (body.get('code') or '').strip().upper()
            cur.execute(
                f'SELECT id FROM {SCHEMA}.players WHERE UPPER(friend_code) = %s LIMIT 1', (friend_code,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(400, 'Друг не найден')
            friend_id = row[0]
            cur.execute(
                f'DELETE FROM {SCHEMA}.friends WHERE (player_id=%s AND friend_id=%s) OR (player_id=%s AND friend_id=%s)',
                (my_id, friend_id, friend_id, my_id)
            )
            conn.commit()
            return {'success': True}

        elif action == 'my_code':
            my_id = resolve_player_id(cur, body)
            if not my_id:
                raise HTTPException(400, 'Игрок не найден')
            code = ensure_friend_code(cur, conn, my_id)
            return {'code': code}

        else:
            raise HTTPException(400, f'Неизвестный action: {action}')

    finally:
        cur.close()
        conn.close()
