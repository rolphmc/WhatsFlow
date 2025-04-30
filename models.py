from app import db
from datetime import datetime
import json

class WhatsAppSession(db.Model):
    """Model for WhatsApp Web sessions"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.String(255))
    status = db.Column(db.String(50), default="disconnected")
    qr_code = db.Column(db.Text)
    session_data = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    webhooks = db.relationship('Webhook', backref='session', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'status': self.status,
            'qr_code': self.qr_code,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class Webhook(db.Model):
    """Model for Webhooks related to WhatsApp sessions"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    url = db.Column(db.String(255), nullable=False)
    session_id = db.Column(db.Integer, db.ForeignKey('whats_app_session.id'), nullable=False)
    events = db.Column(db.Text)  # JSON array of event names
    headers = db.Column(db.Text)  # JSON object of custom headers
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def get_events(self):
        if not self.events:
            return []
        return json.loads(self.events)
    
    def set_events(self, events_list):
        self.events = json.dumps(events_list)
    
    def get_headers(self):
        if not self.headers:
            return {}
        return json.loads(self.headers)
    
    def set_headers(self, headers_dict):
        self.headers = json.dumps(headers_dict)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'url': self.url,
            'session_id': self.session_id,
            'events': self.get_events(),
            'headers': self.get_headers(),
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
