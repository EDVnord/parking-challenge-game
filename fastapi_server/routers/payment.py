import uuid
import base64
import json
import urllib.request
from fastapi import APIRouter, HTTPException
from config import YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY

router = APIRouter(prefix="/payment", tags=["payment"])

GEM_PACKS = {
    100: {'amount': '79.00', 'label': '100 кристаллов'},
    300: {'amount': '199.00', 'label': '300 кристаллов (+50 бонус)'},
    700: {'amount': '399.00', 'label': '700 кристаллов (+150 бонус)'},
    1500: {'amount': '799.00', 'label': '1500 кристаллов (+500 бонус)'},
}


@router.post("/")
def payment_handler(body: dict):
    if not YOOKASSA_SHOP_ID or not YOOKASSA_SECRET_KEY:
        raise HTTPException(503, 'Платежи не настроены')

    action = body.get('action', '')
    auth = base64.b64encode(f'{YOOKASSA_SHOP_ID}:{YOOKASSA_SECRET_KEY}'.encode()).decode()

    if action == 'create':
        gems = int(body.get('gems', 100))
        player_name = str(body.get('playerName', 'Игрок'))[:32]
        return_url = str(body.get('returnUrl', 'https://parking-challenge-game.poehali.dev'))

        pack = GEM_PACKS.get(gems)
        if not pack:
            raise HTTPException(400, 'Неверный пакет кристаллов')

        idempotence_key = str(uuid.uuid4())
        payload = {
            'amount': {'value': pack['amount'], 'currency': 'RUB'},
            'confirmation': {'type': 'redirect', 'return_url': return_url},
            'capture': True,
            'description': f'{pack["label"]} для {player_name} | Король парковки',
            'metadata': {'gems': gems, 'player_name': player_name},
        }

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
        return {
            'paymentId': data.get('id', ''),
            'confirmationUrl': data.get('confirmation', {}).get('confirmation_url', ''),
        }

    elif action == 'check':
        payment_id = str(body.get('paymentId', ''))
        if not payment_id:
            raise HTTPException(400, 'Нет paymentId')

        req = urllib.request.Request(
            f'https://api.yookassa.ru/v3/payments/{payment_id}',
            headers={'Authorization': f'Basic {auth}'},
            method='GET',
        )
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read())
        return {
            'status': data.get('status', ''),
            'gems': int(data.get('metadata', {}).get('gems', 0)),
        }

    else:
        raise HTTPException(400, f'Неизвестный action: {action}')
