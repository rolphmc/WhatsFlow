import json
import logging
import subprocess
import os
from flask import render_template, request, jsonify, redirect, url_for, flash
from app import app, db
from models import WhatsAppSession, Webhook
import urllib.request
import urllib.error
import json
from datetime import datetime

logger = logging.getLogger(__name__)

# Helper function to start the Node.js bridge
def start_node_bridge(session_id):
    try:
        cmd = f"node whatsapp_bridge.js {session_id}"
        process = subprocess.Popen(cmd, shell=True)
        logger.info(f"Started WhatsApp bridge for session {session_id}, PID: {process.pid}")
        return True
    except Exception as e:
        logger.error(f"Error starting WhatsApp bridge: {str(e)}")
        return False

# Main routes
@app.route('/')
def index():
    return render_template('index.html')

# Session management routes
@app.route('/sessions')
def list_sessions():
    return render_template('sessions.html')

@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    sessions = WhatsAppSession.query.all()
    return jsonify([session.to_dict() for session in sessions])

@app.route('/api/sessions', methods=['POST'])
def create_session():
    data = request.json
    if not data or not data.get('name'):
        return jsonify({"error": "Session name is required"}), 400

    try:
        session = WhatsAppSession(
            name=data.get('name'),
            description=data.get('description', '')
        )
        db.session.add(session)
        db.session.commit()

        # Start the WhatsApp bridge for this session
        start_node_bridge(session.id)

        return jsonify(session.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating session: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/sessions/<int:session_id>', methods=['GET'])
def get_session(session_id):
    session = WhatsAppSession.query.get_or_404(session_id)
    return jsonify(session.to_dict())

@app.route('/api/sessions/<int:session_id>', methods=['PUT'])
def update_session(session_id):
    session = WhatsAppSession.query.get_or_404(session_id)
    data = request.json

    if 'name' in data:
        session.name = data['name']
    if 'description' in data:
        session.description = data['description']

    try:
        db.session.commit()
        return jsonify(session.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/sessions/<int:session_id>', methods=['DELETE'])
def delete_session(session_id):
    session = WhatsAppSession.query.get_or_404(session_id)

    try:
        db.session.delete(session)
        db.session.commit()
        return jsonify({"message": "Session deleted successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/sessions/<int:session_id>/restart', methods=['POST'])
def restart_session(session_id):
    session = WhatsAppSession.query.get_or_404(session_id)

    # Reset session status
    session.status = "disconnected"
    session.qr_code = None
    db.session.commit()

    # Start the WhatsApp bridge
    if start_node_bridge(session_id):
        return jsonify({"message": "Session restarted successfully"})
    else:
        return jsonify({"error": "Failed to restart session"}), 500

# Webhook management routes
@app.route('/webhooks')
def list_webhooks():
    sessions = WhatsAppSession.query.all()
    return render_template('webhooks.html', sessions=sessions)

@app.route('/api/webhooks', methods=['GET'])
def get_webhooks():
    webhooks = Webhook.query.all()
    return jsonify([webhook.to_dict() for webhook in webhooks])

@app.route('/api/webhooks', methods=['POST'])
def create_webhook():
    data = request.json
    if not data or not data.get('name') or not data.get('url') or not data.get('session_id'):
        return jsonify({"error": "Name, URL and session_id are required"}), 400

    try:
        webhook = Webhook(
            name=data.get('name'),
            url=data.get('url'),
            session_id=data.get('session_id'),
            is_active=data.get('is_active', True)
        )

        if 'events' in data:
            webhook.set_events(data['events'])
        else:
            webhook.set_events(['message', 'message_create', 'message_ack', 'group_join', 'group_leave'])

        if 'headers' in data:
            webhook.set_headers(data['headers'])

        db.session.add(webhook)
        db.session.commit()
        return jsonify(webhook.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/webhooks/<int:webhook_id>', methods=['GET'])
def get_webhook(webhook_id):
    webhook = Webhook.query.get_or_404(webhook_id)
    return jsonify(webhook.to_dict())

@app.route('/api/webhooks/<int:webhook_id>', methods=['PUT'])
def update_webhook(webhook_id):
    webhook = Webhook.query.get_or_404(webhook_id)
    data = request.json

    if 'name' in data:
        webhook.name = data['name']
    if 'url' in data:
        webhook.url = data['url']
    if 'session_id' in data:
        webhook.session_id = data['session_id']
    if 'is_active' in data:
        webhook.is_active = data['is_active']
    if 'events' in data:
        webhook.set_events(data['events'])
    if 'headers' in data:
        webhook.set_headers(data['headers'])

    try:
        db.session.commit()
        return jsonify(webhook.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/webhooks/<int:webhook_id>', methods=['DELETE'])
def delete_webhook(webhook_id):
    webhook = Webhook.query.get_or_404(webhook_id)

    try:
        db.session.delete(webhook)
        db.session.commit()
        return jsonify({"message": "Webhook deleted successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# Session status callback route - used by the Node.js bridge to update session status
@app.route('/api/sessions/<int:session_id>/status', methods=['POST'])
def update_session_status(session_id):
    session = WhatsAppSession.query.get_or_404(session_id)
    data = request.json

    if 'status' in data:
        session.status = data['status']
    if 'qr_code' in data:
        session.qr_code = data['qr_code']
    if 'session_data' in data:
        session.session_data = data['session_data']

    try:
        db.session.commit()
        return jsonify({"message": "Status updated successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# Send message route - allows sending WhatsApp messages via API
@app.route('/api/sessions/<int:session_id>/send-text', methods=['POST'])
def send_text_message(session_id):
    session = WhatsAppSession.query.get_or_404(session_id)

    # Verify session is connected
    if session.status != 'connected':
        return jsonify({"error": "WhatsApp session is not connected"}), 400

    # Get request data
    data = request.json
    if not data or not data.get('chatId') or not data.get('message'):
        return jsonify({"error": "chatId and message are required"}), 400

    try:
        # Determine the port for this session's WhatsApp bridge
        bridge_port = 3000 + session_id

        # Forward the request to the session's WhatsApp bridge
        import urllib.request
        import urllib.error
        import json

        req_data = json.dumps({
            "chatId": data.get('chatId'),
            "message": data.get('message')
        }).encode('utf-8')

        req = urllib.request.Request(
            f"http://localhost:{bridge_port}/api/send-text",
            data=req_data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                response_data = json.loads(response.read().decode('utf-8'))
                logger.info(f"Message sent to {data.get('chatId')} via session {session_id}")
                return jsonify({"success": True, "message": "Message sent successfully"})
        except urllib.error.HTTPError as e:
            error_message = e.read().decode('utf-8')
            logger.error(f"Error sending message: {error_message}")
            return jsonify({"error": f"Failed to send message: {error_message}"}), e.code

    except Exception as e:
        logger.error(f"Error sending message: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Marcar mensagem como vista (seen)
@app.route('/api/sessions/<int:session_id>/seen', methods=['POST'])
def mark_chat_as_seen(session_id):
    session = WhatsAppSession.query.get_or_404(session_id)

    # Verificar se a sessão está conectada
    if session.status != 'connected':
        return jsonify({"error": "WhatsApp session is not connected"}), 400

    # Obter dados da requisição
    data = request.json
    if not data or not data.get('chatId'):
        return jsonify({"error": "chatId is required"}), 400

    try:
        # Determinar a porta para o bridge do WhatsApp dessa sessão
        bridge_port = 3000 + session_id

        # Encaminhar a requisição para o bridge do WhatsApp
        import urllib.request
        import urllib.error
        import json

        req_data = json.dumps({
            "chatId": data.get('chatId')
        }).encode('utf-8')

        req = urllib.request.Request(
            f"http://localhost:{bridge_port}/api/seen",
            data=req_data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                response_data = json.loads(response.read().decode('utf-8'))
                logger.info(f"Chat {data.get('chatId')} marked as seen via session {session_id}")
                return jsonify({"success": True, "message": "Chat marked as seen"})
        except urllib.error.HTTPError as e:
            error_message = e.read().decode('utf-8')
            logger.error(f"Error marking chat as seen: {error_message}")
            return jsonify({"error": f"Failed to mark chat as seen: {error_message}"}), e.code

    except Exception as e:
        logger.error(f"Error marking chat as seen: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/sessions/<int:session_id>/typing', methods=['POST'])
def start_typing(session_id):
    session = WhatsAppSession.query.get_or_404(session_id)
    # Verificar se a sessão está conectada
    if session.status != 'connected':
        return jsonify({"error": "WhatsApp session is not connected"}), 400
    # Obter dados da requisição
    data = request.json
    if not data or not data.get('chatId'):
        return jsonify({"error": "chatId is required"}), 400
    # Obter duração opcional da digitação (padrão: 3000ms)
    duration = data.get('duration', 3000)
    try:
        # Determinar a porta para o bridge do WhatsApp dessa sessão
        bridge_port = 3000 + session_id
        # Encaminhar a requisição para o bridge do WhatsApp
        import urllib.request
        import urllib.error
        import json
        req_data = json.dumps({
            "chatId": data.get('chatId'),
            "duration": duration
        }).encode('utf-8')
        req = urllib.request.Request(
            f"http://localhost:{bridge_port}/api/typing",
            data=req_data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                response_data = json.loads(response.read().decode('utf-8'))
                logger.info(f"Started typing in chat {data.get('chatId')} via session {session_id} for {duration}ms")
                return jsonify({"success": True, "message": f"Started typing for {duration}ms"})
        except urllib.error.HTTPError as e:
            error_message = e.read().decode('utf-8')
            logger.error(f"Error starting typing: {error_message}")
            return jsonify({"error": f"Failed to start typing: {error_message}"}), e.code
    except Exception as e:
        logger.error(f"Error starting typing: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/sessions/<int:session_id>/send-image', methods=['POST'])
def send_image_message(session_id):
    session = WhatsAppSession.query.get_or_404(session_id)
    # Verificar se a sessão está conectada
    if session.status != 'connected':
        return jsonify({"error": "WhatsApp session is not connected"}), 400
    # Obter dados da requisição
    data = request.json
    if not data or not data.get('chatId'):
        return jsonify({"error": "chatId is required"}), 400
    # Verificar se há URL da imagem ou arquivo
    if not data.get('imageUrl') and not data.get('imageBase64'):
        return jsonify({"error": "imageUrl or imageBase64 is required"}), 400
    try:
        # Determinar a porta para o bridge do WhatsApp dessa sessão
        bridge_port = 3000 + session_id
        # Preparar dados para a requisição
        req_data = {
            "chatId": data.get('chatId'),
            "caption": data.get('caption', '')  # Legenda opcional
        }
        # Adicionar a URL da imagem ou base64, dependendo do que foi fornecido
        if data.get('imageUrl'):
            req_data["imageUrl"] = data.get('imageUrl')
        else:
            req_data["imageBase64"] = data.get('imageBase64')
        # Encaminhar a requisição para o bridge do WhatsApp
        import urllib.request
        import urllib.error
        import json
        import os
        # Usar o endereço interno baseado no ambiente Docker ou usar localhost como fallback
        api_host = os.environ.get('API_HOST', 'localhost')

        # Se estamos rodando no Docker e API_HOST é definido como 'web', use 127.0.0.1 para chamadas entre processos
        # Este é um caso especial para chamadas dentro do mesmo contêiner
        host_address = '127.0.0.1' if api_host == 'web' else api_host

        logger.info(f"Connecting to WhatsApp bridge at http://{host_address}:{bridge_port}/api/send-image")

        req = urllib.request.Request(
            f"http://{host_address}:{bridge_port}/api/send-image",
            data=json.dumps(req_data).encode('utf-8'),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            # Aumentar timeout para 120 segundos
            with urllib.request.urlopen(req, timeout=180) as response:
                response_data = json.loads(response.read().decode('utf-8'))
                logger.info(f"Image sent to {data.get('chatId')} via session {session_id}")
                return jsonify({"success": True, "message": "Image sent successfully", "messageId": response_data.get('messageId')})
        except urllib.error.HTTPError as e:
            error_message = e.read().decode('utf-8')
            logger.error(f"Error sending image: {error_message}")
            return jsonify({"error": f"Failed to send image: {error_message}"}), e.code
        except urllib.error.URLError as e:
            logger.error(f"Connection error: {str(e)}")
            return jsonify({"error": f"Connection error: {str(e)}"}), 500
        except TimeoutError:
            logger.error("Request timed out")
            return jsonify({"error": "Request timed out after 3 minutes. The image might still be processing."}), 504
    except Exception as e:
        logger.error(f"Error sending image: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/sessions/<int:session_id>/send-document', methods=['POST'])
def send_document_message(session_id):
    session = WhatsAppSession.query.get_or_404(session_id)
    # Verificar se a sessão está conectada
    if session.status != 'connected':
        return jsonify({"error": "WhatsApp session is not connected"}), 400
    # Obter dados da requisição
    data = request.json
    if not data or not data.get('chatId'):
        return jsonify({"error": "chatId is required"}), 400
    # Verificar se há URL do documento ou arquivo base64
    if not data.get('documentUrl') and not data.get('documentBase64'):
        return jsonify({"error": "documentUrl or documentBase64 is required"}), 400
    try:
        # Determinar a porta para o bridge do WhatsApp dessa sessão
        bridge_port = 3000 + session_id
        # Preparar dados para a requisição
        req_data = {
            "chatId": data.get('chatId'),
            "caption": data.get('caption', ''),  # Legenda opcional
            "filename": data.get('filename', '')  # Nome do arquivo opcional
        }
        # Adicionar a URL do documento ou base64, dependendo do que foi fornecido
        if data.get('documentUrl'):
            req_data["documentUrl"] = data.get('documentUrl')
        else:
            req_data["documentBase64"] = data.get('documentBase64')
        # Encaminhar a requisição para o bridge do WhatsApp
        import urllib.request
        import urllib.error
        import json
        import os
        # Usar o endereço interno baseado no ambiente Docker ou usar localhost como fallback
        api_host = os.environ.get('API_HOST', 'localhost')

        # Se estamos rodando no Docker e API_HOST é definido como 'web', use 127.0.0.1 para chamadas entre processos
        host_address = '127.0.0.1' if api_host == 'web' else api_host

        logger.info(f"Connecting to WhatsApp bridge at http://{host_address}:{bridge_port}/api/send-document")

        req = urllib.request.Request(
            f"http://{host_address}:{bridge_port}/api/send-document",
            data=json.dumps(req_data).encode('utf-8'),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            # Aumentar timeout para 180 segundos
            with urllib.request.urlopen(req, timeout=180) as response:
                response_data = json.loads(response.read().decode('utf-8'))
                logger.info(f"Document sent to {data.get('chatId')} via session {session_id}")
                return jsonify({"success": True, "message": "Document sent successfully", "messageId": response_data.get('messageId')})
        except urllib.error.HTTPError as e:
            error_message = e.read().decode('utf-8')
            logger.error(f"Error sending document: {error_message}")
            return jsonify({"error": f"Failed to send document: {error_message}"}), e.code
        except urllib.error.URLError as e:
            logger.error(f"Connection error: {str(e)}")
            return jsonify({"error": f"Connection error: {str(e)}"}), 500
        except TimeoutError:
            logger.error("Request timed out")
            return jsonify({"error": "Request timed out after 3 minutes. The document might still be processing."}), 504
    except Exception as e:
        logger.error(f"Error sending document: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/sessions/<int:session_id>/send-audio', methods=['POST'])
def send_audio_message(session_id):
    session = WhatsAppSession.query.get_or_404(session_id)
    # Verificar se a sessão está conectada
    if session.status != 'connected':
        return jsonify({"error": "WhatsApp session is not connected"}), 400
    # Obter dados da requisição
    data = request.json
    if not data or not data.get('chatId'):
        return jsonify({"error": "chatId is required"}), 400
    # Verificar se há URL do áudio ou arquivo base64
    if not data.get('audioUrl') and not data.get('audioBase64'):
        return jsonify({"error": "audioUrl or audioBase64 is required"}), 400
    try:
        # Determinar a porta para o bridge do WhatsApp dessa sessão
        bridge_port = 3000 + session_id
        # Preparar dados para a requisição
        req_data = {
            "chatId": data.get('chatId'),
            "filename": data.get('filename', ''),  # Nome do arquivo opcional
            "asVoiceMessage": data.get('asVoiceMessage', True)  # Se deve enviar como mensagem de voz
        }
        # Adicionar a URL do áudio ou base64, dependendo do que foi fornecido
        if data.get('audioUrl'):
            req_data["audioUrl"] = data.get('audioUrl')
        else:
            req_data["audioBase64"] = data.get('audioBase64')
        # Encaminhar a requisição para o bridge do WhatsApp
        import urllib.request
        import urllib.error
        import json
        import os
        # Usar o endereço interno baseado no ambiente Docker ou usar localhost como fallback
        api_host = os.environ.get('API_HOST', 'localhost')

        # Se estamos rodando no Docker e API_HOST é definido como 'web', use 127.0.0.1 para chamadas entre processos
        host_address = '127.0.0.1' if api_host == 'web' else api_host

        logger.info(f"Connecting to WhatsApp bridge at http://{host_address}:{bridge_port}/api/send-audio")

        req = urllib.request.Request(
            f"http://{host_address}:{bridge_port}/api/send-audio",
            data=json.dumps(req_data).encode('utf-8'),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            # Aumentar timeout para 180 segundos
            with urllib.request.urlopen(req, timeout=180) as response:
                response_data = json.loads(response.read().decode('utf-8'))
                logger.info(f"Audio sent to {data.get('chatId')} via session {session_id}")
                return jsonify({"success": True, "message": "Audio sent successfully", "messageId": response_data.get('messageId')})
        except urllib.error.HTTPError as e:
            error_message = e.read().decode('utf-8')
            logger.error(f"Error sending audio: {error_message}")
            return jsonify({"error": f"Failed to send audio: {error_message}"}), e.code
        except urllib.error.URLError as e:
            logger.error(f"Connection error: {str(e)}")
            return jsonify({"error": f"Connection error: {str(e)}"}), 500
        except TimeoutError:
            logger.error("Request timed out")
            return jsonify({"error": "Request timed out after 3 minutes. The audio might still be processing."}), 504
    except Exception as e:
        logger.error(f"Error sending audio: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Endpoint de teste para listar rotas
@app.route('/api/debug/routes')
def list_routes():
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append({
            "endpoint": rule.endpoint,
            "methods": [m for m in rule.methods if m not in ('HEAD', 'OPTIONS')],
            "path": str(rule)
        })
    return jsonify(routes)

# Rota para servir arquivos de mídia
@app.route('/api/files/<session_name>/<filename>')
def serve_media_file(session_name, filename):
    import os
    from flask import send_from_directory

    # Extrair o ID da sessão do nome da sessão (session_1 -> 1)
    try:
        session_id = session_name.split('_')[-1]

        # Verificar se a sessão existe
        session = WhatsAppSession.query.get(session_id)
        if not session:
            return jsonify({"error": "Session not found"}), 404

        # Caminho para o diretório de mídia
        media_dir = os.path.join('/app/media', session_name)

        # Verificar se o diretório existe
        if not os.path.exists(media_dir):
            os.makedirs(media_dir, exist_ok=True)
            return jsonify({"error": "File not found"}), 404

        # Enviar o arquivo
        return send_from_directory(media_dir, filename)
    except Exception as e:
        logger.error(f"Error serving media file: {str(e)}")
        return jsonify({"error": str(e)}), 500
