import json
import os
import uuid
import base64
import urllib.request


def handler(event: dict, context) -> dict:
    """Создание и проверка платежей ЮKassa для покупки кристаллов."""
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    shop_id = os.environ.get('YOOKASSA_SHOP_ID', '')
    secret_key = os.environ.get('YOOKASSA_SECRET_KEY', '')

    if not shop_id or not secret_key:
        return {'statusCode': 503, 'headers': cors, 'body': json.dumps({'error': 'Payment not configured'})}

    body = json.loads(event.get('body') or '{}')
    action = body.get('action', '')

    if action == 'create':
        gems = int(body.get('gems', 100))
        player_name = str(body.get('playerName', 'Игрок'))[:32]
        return_url = str(body.get('returnUrl', 'https://parking-challenge-game.poehali.dev'))

        gem_packs = {
            100: {'amount': '79.00', 'label': '100 кристаллов'},
            300: {'amount': '199.00', 'label': '300 кристаллов (+50 бонус)'},
            700: {'amount': '399.00', 'label': '700 кристаллов (+150 бонус)'},
            1500: {'amount': '799.00', 'label': '1500 кристаллов (+500 бонус)'},
        }

        pack = gem_packs.get(gems)
        if not pack:
            return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'Invalid pack'})}

        idempotence_key = str(uuid.uuid4())
        payload = {
            'amount': {'value': pack['amount'], 'currency': 'RUB'},
            'confirmation': {'type': 'redirect', 'return_url': return_url},
            'capture': True,
            'description': f'{pack["label"]} для {player_name} | Король парковки',
            'metadata': {'gems': gems, 'player_name': player_name},
        }

        auth = base64.b64encode(f'{shop_id}:{secret_key}'.encode()).decode()
        req = urllib.request.Request(
            'https://api.yookassa.ru/v3/payments',
            data=json.dumps(payload).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Basic {auth}',
                'Idempotence-Key': idempotence_key,
            },
            method='POST',
        )
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read())
        confirm_url = data.get('confirmation', {}).get('confirmation_url', '')
        payment_id = data.get('id', '')
        return {
            'statusCode': 200,
            'headers': cors,
            'body': json.dumps({'paymentId': payment_id, 'confirmationUrl': confirm_url}),
        }

    elif action == 'check':
        payment_id = str(body.get('paymentId', ''))
        if not payment_id:
            return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'No payment id'})}

        auth = base64.b64encode(f'{shop_id}:{secret_key}'.encode()).decode()
        req = urllib.request.Request(
            f'https://api.yookassa.ru/v3/payments/{payment_id}',
            headers={'Authorization': f'Basic {auth}'},
            method='GET',
        )
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read())
        status = data.get('status', '')
        gems = data.get('metadata', {}).get('gems', 0)
        return {
            'statusCode': 200,
            'headers': cors,
            'body': json.dumps({'status': status, 'gems': int(gems)}),
        }

    return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'Unknown action'})}
