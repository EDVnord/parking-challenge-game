import json
import os
from fastapi import APIRouter, HTTPException
from database import get_conn
from config import SCHEMA

router = APIRouter(prefix="/admin", tags=["admin"])

ADMIN_SECRET = os.environ.get('ADMIN_SECRET', 'changeme')


def check_auth(body: dict):
    if body.get('secret') != ADMIN_SECRET:
        raise HTTPException(403, 'Неверный пароль администратора')


@router.post("")
def admin_handler(body: dict):
    """Административная панель — управление игроками"""
    check_auth(body)
    action = body.get('action', '')
    conn = get_conn()
    cur = conn.cursor()

    try:
        if action == 'list':
            search = body.get('search', '').strip()
            limit = min(int(body.get('limit', 50)), 200)
            offset = int(body.get('offset', 0))

            if search:
                cur.execute(
                    f'''SELECT id, name, emoji, coins, gems, xp, wins, games_played,
                        ya_id, anon_id, friend_code, created_at, updated_at, banned_until
                        FROM {SCHEMA}.players
                        WHERE LOWER(name) LIKE LOWER(%s) OR ya_id LIKE %s OR friend_code LIKE %s
                        ORDER BY xp DESC LIMIT %s OFFSET %s''',
                    (f'%{search}%', f'%{search}%', f'%{search}%', limit, offset)
                )
            else:
                cur.execute(
                    f'''SELECT id, name, emoji, coins, gems, xp, wins, games_played,
                        ya_id, anon_id, friend_code, created_at, updated_at, banned_until
                        FROM {SCHEMA}.players
                        ORDER BY xp DESC LIMIT %s OFFSET %s''',
                    (limit, offset)
                )
            rows = cur.fetchall()

            cur.execute(f'SELECT COUNT(*) FROM {SCHEMA}.players')
            total = cur.fetchone()[0]

            players = []
            for r in rows:
                players.append({
                    'id': r[0], 'name': r[1], 'emoji': r[2],
                    'coins': r[3], 'gems': r[4], 'xp': r[5],
                    'wins': r[6], 'gamesPlayed': r[7],
                    'yaId': r[8], 'anonId': r[9], 'friendCode': r[10],
                    'createdAt': str(r[11]) if r[11] else None,
                    'updatedAt': str(r[12]) if r[12] else None,
                    'bannedUntil': str(r[13]) if r[13] else None,
                })
            return {'success': True, 'players': players, 'total': total}

        elif action == 'get':
            player_id = body.get('playerId')
            if not player_id:
                raise HTTPException(400, 'Нет playerId')
            cur.execute(
                f'''SELECT id, name, emoji, coins, gems, xp, wins, games_played,
                    ya_id, anon_id, friend_code, created_at, updated_at, upgrades, extra_data
                    FROM {SCHEMA}.players WHERE id = %s''',
                (player_id,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, 'Игрок не найден')
            return {'success': True, 'player': {
                'id': row[0], 'name': row[1], 'emoji': row[2],
                'coins': row[3], 'gems': row[4], 'xp': row[5],
                'wins': row[6], 'gamesPlayed': row[7],
                'yaId': row[8], 'anonId': row[9], 'friendCode': row[10],
                'createdAt': str(row[11]) if row[11] else None,
                'updatedAt': str(row[12]) if row[12] else None,
                'upgrades': json.loads(row[13]) if row[13] else {},
                'extraData': json.loads(row[14]) if row[14] else {},
            }}

        elif action == 'update':
            player_id = body.get('playerId')
            fields = body.get('fields', {})
            if not player_id:
                raise HTTPException(400, 'Нет playerId')

            allowed = ['coins', 'gems', 'xp', 'wins', 'games_played', 'name', 'emoji']
            updates = []
            values = []
            for key, val in fields.items():
                if key in allowed:
                    updates.append(f'{key} = %s')
                    values.append(val)

            if not updates:
                raise HTTPException(400, 'Нет допустимых полей для обновления')

            values.append(player_id)
            cur.execute(
                f'UPDATE {SCHEMA}.players SET {", ".join(updates)}, updated_at=NOW() WHERE id = %s',
                values
            )
            conn.commit()
            return {'success': True, 'updated': len(updates)}

        elif action == 'link_ya':
            player_id = body.get('playerId')
            ya_id = (body.get('yaId') or '').strip()
            if not player_id:
                raise HTTPException(400, 'Нет playerId')
            if not ya_id:
                raise HTTPException(400, 'Нет yaId')

            # Проверяем: нет ли уже такого ya_id у другого игрока
            cur.execute(f'SELECT id, name FROM {SCHEMA}.players WHERE ya_id = %s AND id != %s LIMIT 1', (ya_id, player_id))
            conflict = cur.fetchone()
            if conflict:
                # Сливаем: берём лучшие данные из обоих, оставляем target игрока
                cur.execute(f'SELECT coins, gems, xp, wins, games_played, best_position FROM {SCHEMA}.players WHERE id = %s', (player_id,))
                target = cur.fetchone()
                cur.execute(f'SELECT coins, gems, xp, wins, games_played, best_position FROM {SCHEMA}.players WHERE id = %s', (conflict[0],))
                src = cur.fetchone()
                cur.execute(
                    f'''UPDATE {SCHEMA}.players SET
                        ya_id=%s,
                        coins=GREATEST(coins,%s), gems=GREATEST(gems,%s),
                        xp=GREATEST(xp,%s), wins=GREATEST(wins,%s),
                        games_played=GREATEST(games_played,%s),
                        best_position=LEAST(best_position,%s),
                        updated_at=NOW()
                        WHERE id=%s''',
                    (ya_id, src[0], src[1], src[2], src[3], src[4], src[5], player_id)
                )
                cur.execute(f'DELETE FROM {SCHEMA}.friends WHERE player_id=%s OR friend_id=%s', (conflict[0], conflict[0]))
                cur.execute(f'DELETE FROM {SCHEMA}.players WHERE id=%s', (conflict[0],))
            else:
                cur.execute(f'UPDATE {SCHEMA}.players SET ya_id=%s, updated_at=NOW() WHERE id=%s', (ya_id, player_id))

            conn.commit()
            return {'success': True, 'merged': conflict is not None, 'mergedName': conflict[1] if conflict else None}

        elif action == 'ban':
            player_id = body.get('playerId')
            duration = body.get('duration', 24)  # часы
            if not player_id:
                raise HTTPException(400, 'Нет playerId')
            cur.execute(
                f"UPDATE {SCHEMA}.players SET banned_until = NOW() + (%s || ' hours')::interval, updated_at=NOW() WHERE id = %s",
                (str(int(duration)), player_id)
            )
            conn.commit()
            cur.execute(f"SELECT banned_until FROM {SCHEMA}.players WHERE id = %s", (player_id,))
            row = cur.fetchone()
            return {'success': True, 'bannedUntil': str(row[0]) if row else None}

        elif action == 'unban':
            player_id = body.get('playerId')
            if not player_id:
                raise HTTPException(400, 'Нет playerId')
            cur.execute(
                f"UPDATE {SCHEMA}.players SET banned_until = NULL, updated_at=NOW() WHERE id = %s",
                (player_id,)
            )
            conn.commit()
            return {'success': True}

        elif action == 'delete':
            player_id = body.get('playerId')
            if not player_id:
                raise HTTPException(400, 'Нет playerId')
            cur.execute(f'DELETE FROM {SCHEMA}.friends WHERE player_id = %s OR friend_id = %s', (player_id, player_id))
            cur.execute(f'DELETE FROM {SCHEMA}.players WHERE id = %s', (player_id,))
            conn.commit()
            return {'success': True}

        elif action == 'gift':
            coins = int(body.get('coins', 0))
            gems = int(body.get('gems', 0))
            target = body.get('target', 'all')
            comment = (body.get('comment') or '').strip()[:120]

            if coins == 0 and gems == 0:
                raise HTTPException(400, 'Укажи монеты или гемы')

            if target == 'all':
                cur.execute(
                    f'UPDATE {SCHEMA}.players SET coins=coins+%s, gems=gems+%s, updated_at=NOW()',
                    (coins, gems)
                )
            elif target == 'ya':
                cur.execute(
                    f'UPDATE {SCHEMA}.players SET coins=coins+%s, gems=gems+%s, updated_at=NOW() WHERE ya_id IS NOT NULL',
                    (coins, gems)
                )
            elif target == 'active_week':
                cur.execute(
                    f"UPDATE {SCHEMA}.players SET coins=coins+%s, gems=gems+%s, updated_at=NOW() WHERE updated_at > NOW() - INTERVAL '7 days'",
                    (coins, gems)
                )
            elif target == 'active_day':
                cur.execute(
                    f"UPDATE {SCHEMA}.players SET coins=coins+%s, gems=gems+%s, updated_at=NOW() WHERE updated_at > NOW() - INTERVAL '24 hours'",
                    (coins, gems)
                )
            else:
                raise HTTPException(400, 'Неверный target')

            affected = cur.rowcount
            cur.execute(
                f'''INSERT INTO {SCHEMA}.admin_gifts_log (coins, gems, target, affected, comment)
                    VALUES (%s, %s, %s, %s, %s)''',
                (coins, gems, target, affected, comment)
            )
            conn.commit()
            return {'success': True, 'affected': affected}

        elif action == 'gifts_log':
            limit = min(int(body.get('limit', 30)), 100)
            cur.execute(
                f'''SELECT id, coins, gems, target, affected, comment, created_at
                    FROM {SCHEMA}.admin_gifts_log
                    ORDER BY created_at DESC LIMIT %s''',
                (limit,)
            )
            rows = cur.fetchall()
            return {'success': True, 'log': [
                {
                    'id': r[0], 'coins': r[1], 'gems': r[2],
                    'target': r[3], 'affected': r[4],
                    'comment': r[5] or '',
                    'createdAt': str(r[6]) if r[6] else None,
                }
                for r in rows
            ]}

        elif action == 'stats':
            cur.execute(f'SELECT COUNT(*) FROM {SCHEMA}.players')
            total = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.players WHERE ya_id IS NOT NULL")
            ya_count = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.players WHERE updated_at > NOW() - INTERVAL '24 hours'")
            active_day = cur.fetchone()[0]
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.players WHERE updated_at > NOW() - INTERVAL '7 days'")
            active_week = cur.fetchone()[0]
            cur.execute(f'SELECT SUM(coins), SUM(gems), MAX(xp), MAX(wins) FROM {SCHEMA}.players')
            agg = cur.fetchone()
            return {
                'success': True,
                'stats': {
                    'totalPlayers': total,
                    'yaPlayers': ya_count,
                    'activeDay': active_day,
                    'activeWeek': active_week,
                    'totalCoins': agg[0] or 0,
                    'totalGems': agg[1] or 0,
                    'maxXp': agg[2] or 0,
                    'maxWins': agg[3] or 0,
                }
            }

        else:
            raise HTTPException(400, f'Неизвестный action: {action}')

    finally:
        cur.close()
        conn.close()