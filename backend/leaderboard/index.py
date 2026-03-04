"""
Лидерборд онлайн для игры 'Король парковки'.
GET / — топ-50 игроков по XP
"""
import json
import os
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p25425030_parking_challenge_ga')

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def handler(event: dict, context) -> dict:
    """Возвращает топ-50 игроков по XP."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            f'''SELECT name, emoji, wins, xp, games_played
                FROM {SCHEMA}.players
                ORDER BY xp DESC
                LIMIT 50'''
        )
        rows = cur.fetchall()
        leaders = [
            {'rank': i + 1, 'name': r[0], 'emoji': r[1], 'wins': r[2], 'xp': r[3], 'gamesPlayed': r[4]}
            for i, r in enumerate(rows)
        ]
        return {
            'statusCode': 200,
            'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
            'body': json.dumps({'leaders': leaders})
        }
    finally:
        cur.close()
        conn.close()
