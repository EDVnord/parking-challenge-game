from fastapi import APIRouter
from database import get_conn
from config import SCHEMA

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("")
def get_leaderboard(name: str = ''):
    conn = get_conn()
    cur = conn.cursor()
    try:
        # Топ-10 — порядковый номер 1..10
        cur.execute(
            f'''SELECT name, emoji, wins, xp, games_played
                FROM {SCHEMA}.players
                ORDER BY xp DESC
                LIMIT 10'''
        )
        rows = cur.fetchall()
        leaders = [
            {'rank': i + 1, 'name': r[0], 'emoji': r[1], 'wins': r[2], 'xp': r[3], 'gamesPlayed': r[4]}
            for i, r in enumerate(rows)
        ]

        my_rank = None
        if name:
            cur.execute(
                f'''SELECT real_rank FROM (
                    SELECT name, ROW_NUMBER() OVER (ORDER BY xp DESC) AS real_rank
                    FROM {SCHEMA}.players
                ) ranked WHERE LOWER(name) = LOWER(%s) LIMIT 1''',
                (name,)
            )
            row = cur.fetchone()
            if row:
                my_rank = row[0]

        return {'leaders': leaders, 'myRank': my_rank}
    finally:
        cur.close()
        conn.close()