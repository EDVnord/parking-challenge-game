import os
import base64
import boto3

def handler(event: dict, context) -> dict:
    """Принимает zip-файл билда (base64) и загружает в S3. Возвращает публичную ссылку для скачивания."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Upload-Token'}, 'body': ''}

    upload_token = os.environ.get('UPLOAD_BUILD_TOKEN', '')
    token = (event.get('headers') or {}).get('X-Upload-Token', '')
    if not token or token != upload_token:
        return {'statusCode': 401, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': 'Unauthorized'}

    body = event.get('body', '')
    if event.get('isBase64Encoded'):
        data = base64.b64decode(body)
    else:
        data = base64.b64decode(body)

    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )
    s3.put_object(
        Bucket='files',
        Key='builds/yandex_games_build.zip',
        Body=data,
        ContentType='application/zip',
    )

    cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/builds/yandex_games_build.zip"
    return {
        'statusCode': 200,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': f'{{"ok": true, "url": "{cdn_url}"}}',
    }
