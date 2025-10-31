import json
import base64
import requests
import os
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Распознавание текста с изображений через OCR.space API
    Args: event - dict с httpMethod и body (base64 изображение)
          context - object с атрибутами request_id, function_name
    Returns: HTTP response dict с распознанным текстом
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    body_data = json.loads(event.get('body', '{}'))
    image_base64 = body_data.get('image', '')
    
    if not image_base64:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Image is required'})
        }
    
    api_key = os.environ.get('OCR_SPACE_API_KEY')
    if not api_key:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'OCR API key not configured'})
        }
    
    payload = {
        'base64Image': image_base64,
        'language': 'rus',
        'isOverlayRequired': False,
        'detectOrientation': True,
        'scale': True,
        'OCREngine': 2
    }
    
    response = requests.post(
        'https://api.ocr.space/parse/image',
        data=payload,
        headers={'apikey': api_key}
    )
    
    result = response.json()
    
    if result.get('IsErroredOnProcessing'):
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'isBase64Encoded': False,
            'body': json.dumps({
                'error': 'OCR processing failed',
                'details': result.get('ErrorMessage', [])
            })
        }
    
    parsed_results = result.get('ParsedResults', [])
    text = parsed_results[0].get('ParsedText', '') if parsed_results else ''
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'isBase64Encoded': False,
        'body': json.dumps({
            'text': text.strip(),
            'requestId': context.request_id
        })
    }
