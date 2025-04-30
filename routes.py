import json
import logging
import subprocess
import os
from flask import render_template, request, jsonify, redirect, url_for, flash
from app import app, db
from models import WhatsAppSession, Webhook

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
