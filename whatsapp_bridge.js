/**
 * WhatsApp Web.js Bridge
 * Node.js script to bridge between Python Flask backend and WhatsApp Web.js library
 * 
 * Usage: node whatsapp_bridge.js <session_id>
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Get session ID from command line arguments
const sessionId = process.argv[2];

if (!sessionId) {
    console.error('Session ID is required');
    process.exit(1);
}

console.log(`Starting WhatsApp bridge for session ${sessionId}`);

// Create session directory if it doesn't exist
const sessionDir = path.join(__dirname, '.wwebjs_auth', `session_${sessionId}`);
if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
}

// Initialize the WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: `session_${sessionId}`,
        dataPath: path.join(__dirname, '.wwebjs_auth')
    }),
    puppeteer: {
        headless: true,
        // Remova a linha executablePath para usar o Chromium instalado junto com Puppeteer
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
               '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote',
               '--single-process', '--disable-gpu', '--disable-infobars',
               '--disable-extensions', '--window-size=1280,720']
    }
 }); 

// Function to update session status
async function updateSessionStatus(status, qrCode = null, sessionData = null) {
    try {
        const data = { status };
        if (qrCode) data.qr_code = qrCode;
        if (sessionData) data.session_data = sessionData;
        
        await axios.post(`http://localhost:5000/api/sessions/${sessionId}/status`, data);
        console.log(`Session ${sessionId} status updated to ${status}`);
    } catch (error) {
        console.error('Error updating session status:', error.message);
    }
}

// Function to send webhook events
async function sendWebhookEvent(eventType, data) {
    try {
        // Fetch all webhooks for this session
        const response = await axios.get('http://localhost:5000/api/webhooks');
        const webhooks = response.data.filter(webhook => 
            webhook.session_id == sessionId && 
            webhook.is_active && 
            webhook.events.includes(eventType)
        );
        
        if (webhooks.length === 0) {
            return;
        }
        
        // Send the event to each webhook with processed data for each webhook's settings
        console.log(`Sending ${eventType} event to ${webhooks.length} webhooks`);
        
        for (const webhook of webhooks) {
            try {
                // Propriedades básicas que sempre devem estar presentes
                let basicData = {};
                
                // Se for um dos eventos de mensagem, incluir apenas os campos selecionados
                if (eventType === 'message' || eventType === 'message_create' || eventType === 'message_ack') {
                    // Check if the original message object is available in the context
                    const messageObj = data._messageObj || data.message || data;
                    
                    // Process additional message properties based on webhook configuration
                    if (messageObj && typeof messageObj === 'object') {
                        console.log(`Processing additional message properties for webhook ${webhook.id}`);
                        
                        // Map of msg_ prefixed event names to actual Message object properties
                        const propMapping = {
                            'msg_id': 'id',
                            'msg_body': 'body',
                            'msg_type': 'type',
                            'msg_timestamp': 'timestamp',
                            'msg_from': 'from',
                            'msg_to': 'to',
                            'msg_author': 'author',
                            'msg_fromMe': 'fromMe',
                            'msg_hasMedia': 'hasMedia',
                            'msg_isForwarded': 'isForwarded',
                            'msg_isStatus': 'isStatus',
                            'msg_isStarred': 'isStarred',
                            'msg_broadcast': 'broadcast',
                            'msg_mentionedIds': 'mentionedIds',
                            'msg_vCards': 'vCards',
                            'msg_location': 'location',
                            'msg_hasQuotedMsg': 'hasQuotedMsg',
                            'msg_duration': 'duration',
                            'msg_mimetype': 'mimetype',
                            'msg_caption': 'caption',
                            'msg_filename': 'filename',
                            'msg_links': 'links'
                        };
                        
                        // Add only selected properties to the processed data
                        for (const [eventProp, msgProp] of Object.entries(propMapping)) {
                            if (webhook.events.includes(eventProp) && messageObj[msgProp] !== undefined) {
                                basicData[msgProp] = messageObj[msgProp];
                            }
                        }
                    }
                } else {
                    // Para outros tipos de eventos, manter o payload original
                    basicData = {...data};
                }
                
                // Prepare the event payload with processed data
                const payload = {
                    event: eventType,
                    sessionId: parseInt(sessionId),
                    timestamp: new Date().toISOString(),
                    data: basicData
                };
                
                // Adicionar cabeçalhos da requisição apenas se a opção estiver selecionada
                if (webhook.events.includes('include_headers')) {
                    // Os headers devem ser incluídos como uma propriedade dentro do objeto data
                    payload.data.headers = {
                        'host': webhook.url.split('/')[2],
                        'user-agent': 'axios/1.9.0',
                        'content-type': 'application/json',
                        'accept': 'application/json, text/plain, */*'
                    };
                }
                
                const headers = webhook.headers || {};
                const response = await axios.post(webhook.url, payload, { headers });

                await axios.post(webhook.url, payload, { headers });
                console.log(`Event ${eventType} sent to webhook ${webhook.id} (${webhook.name}) - Response: ${response.status}`);
            } catch (webhookError) {
                console.error(`Error sending to webhook ${webhook.id}:`, webhookError.message);
                // Adicione mais detalhes do erro
                if (webhookError.response) {
                    console.error(`Status: ${webhookError.response.status}, Data:`, webhookError.response.data);
                }
        }
    } catch (error) {
        console.error('Error fetching webhooks or sending event:', error.message);
    }
}

// Update status to connecting
updateSessionStatus('connecting');

// QR code event
client.on('qr', async (qr) => {
    try {
        // Convert QR to data URL
        const qrDataURL = await qrcode.toDataURL(qr);
        console.log('QR code generated');
        
        // Update session status with QR code
        await updateSessionStatus('qr_code_ready', qrDataURL);
        
        // Send webhook event
        await sendWebhookEvent('qr', { qr: qr });
    } catch (error) {
        console.error('Error generating QR code:', error);
    }
});

// Authentication event
client.on('authenticated', () => {
    console.log('WhatsApp authenticated');
    updateSessionStatus('authenticated');
});

// Auth failure event
client.on('auth_failure', (msg) => {
    console.error('Authentication failure:', msg);
    updateSessionStatus('auth_failed');
});

// Ready event
client.on('ready', () => {
    console.log('WhatsApp client is ready');
    // Atualizar o status e limpar o QR code quando conectado
    updateSessionStatus('connected', null, 'connected'); // null para o QR code e 'connected' para os dados de sessão
});

// Disconnected event
client.on('disconnected', (reason) => {
    console.log('WhatsApp client disconnected:', reason);
    updateSessionStatus('disconnected');
});

// Message event
client.on('message', async (message) => {
    console.log(`New message received: ${message.body}`);
    
    // Format basic message data for webhook
    const messageData = {
        id: message.id.id,
        body: message.body,
        from: message.from,
        to: message.to,
        fromMe: message.fromMe,
        hasMedia: message.hasMedia,
        timestamp: message.timestamp,
        // Store the original message object to extract additional properties if needed
        _messageObj: message
    };
    
    // If it has mentions, include them
    if (message.mentionedIds && message.mentionedIds.length > 0) {
        messageData.mentionedIds = message.mentionedIds;
    }
    
    // Send webhook event with the complete message object for property extraction
    await sendWebhookEvent('message', messageData);
});

// Message create event
client.on('message_create', async (message) => {
    if (message.fromMe) {
        console.log(`New message sent: ${message.body}`);
        
        // Format message data for webhook
        const messageData = {
            id: message.id.id,
            body: message.body,
            from: message.from,
            to: message.to,
            fromMe: message.fromMe,
            timestamp: message.timestamp,
            // Store the original message object to extract additional properties if needed
            _messageObj: message
        };
        
        // Send webhook event
        await sendWebhookEvent('message_create', messageData);
    }
});

// Message ACK event
client.on('message_ack', async (message, ack) => {
    // Map ACK values to descriptive strings
    const ackMap = {
        0: 'ERROR',
        1: 'PENDING',
        2: 'RECEIVED',
        3: 'READ',
        4: 'PLAYED'
    };
    
    console.log(`Message ACK update: ${message.body} => ${ackMap[ack]}`);
    
    // Format ACK data for webhook
    const ackData = {
        id: message.id.id,
        ack: ack,
        ackName: ackMap[ack],
        body: message.body,
        timestamp: new Date().toISOString()
    };
    
    // Send webhook event
    await sendWebhookEvent('message_ack', ackData);
});

// Group join event
client.on('group_join', async (notification) => {
    console.log(`User ${notification.recipientIds[0]} joined group ${notification.chatId}`);
    
    // Format join data for webhook
    const joinData = {
        groupId: notification.chatId,
        joinedUsers: notification.recipientIds,
        authorId: notification.author,
        timestamp: notification.timestamp
    };
    
    // Send webhook event
    await sendWebhookEvent('group_join', joinData);
});

// Group leave event
client.on('group_leave', async (notification) => {
    console.log(`User ${notification.recipientIds[0]} left group ${notification.chatId}`);
    
    // Format leave data for webhook
    const leaveData = {
        groupId: notification.chatId,
        leftUsers: notification.recipientIds,
        authorId: notification.author,
        timestamp: notification.timestamp
    };
    
    // Send webhook event
    await sendWebhookEvent('group_leave', leaveData);
});

// Typing event (when contact starts typing)
client.on('typing', async (chatId, typing) => {
    console.log(`Typing status update: ${chatId} is ${typing ? 'typing' : 'not typing'}`);
    
    if (typing) {
        // Format typing data for webhook
        const typingData = {
            chatId: chatId,
            isTyping: typing,
            timestamp: new Date().toISOString()
        };
        
        // Send webhook event
        await sendWebhookEvent('typing', typingData);
        
        // Also send to waha.devlike.pro if configured with a webhook for this event
        try {
            // Get webhook configured for waha
            const response = await axios.get('http://localhost:5000/api/webhooks');
            const wahaWebhooks = response.data.filter(webhook => 
                webhook.session_id == sessionId && 
                webhook.is_active && 
                webhook.url.includes('waha.devlike.pro') &&
                webhook.events.includes('typing')
            );
            
            if (wahaWebhooks.length > 0) {
                for (const webhook of wahaWebhooks) {
                    const wahaPayload = {
                        event: 'typing',
                        sessionId: parseInt(sessionId),
                        data: typingData,
                        timestamp: new Date().toISOString()
                    };
                    
                    await axios.post(webhook.url, wahaPayload, { headers: webhook.headers || {} });
                    console.log(`Typing event sent to waha.devlike.pro webhook ${webhook.id}`);
                }
            }
        } catch (error) {
            console.error('Error sending typing event to waha.devlike.pro:', error.message);
        }
    }
});

// Message seen event
client.on('message_revoke_everyone', async (message, revoked) => {
    console.log(`Message was revoked: ${message.body}`);
    
    // Format seen data for webhook
    const revokeData = {
        id: message.id,
        from: message.from,
        to: message.to,
        body: message.body,
        revokedMessage: revoked ? revoked.body : null,
        timestamp: new Date().toISOString()
    };
    
    // Send webhook event
    await sendWebhookEvent('revoke', revokeData);
});

// Chat seen event (when user reads messages in a chat)
client.on('chat_update', async (chat) => {
    if (chat.unreadCount === 0 && chat.lastMessage) {
        console.log(`Chat ${chat.id._serialized} was seen`);
        
        // Format seen data for webhook
        const seenData = {
            chatId: chat.id._serialized,
            timestamp: new Date().toISOString()
        };
        
        // Send webhook event
        await sendWebhookEvent('seen', seenData);
        
        // Also send to waha.devlike.pro if configured with a webhook for this event
        try {
            // Get webhook configured for waha
            const response = await axios.get('http://localhost:5000/api/webhooks');
            const wahaWebhooks = response.data.filter(webhook => 
                webhook.session_id == sessionId && 
                webhook.is_active && 
                webhook.url.includes('waha.devlike.pro') &&
                webhook.events.includes('seen')
            );
            
            if (wahaWebhooks.length > 0) {
                for (const webhook of wahaWebhooks) {
                    const wahaPayload = {
                        event: 'seen',
                        sessionId: parseInt(sessionId),
                        data: seenData,
                        timestamp: new Date().toISOString()
                    };
                    
                    await axios.post(webhook.url, wahaPayload, { headers: webhook.headers || {} });
                    console.log(`Seen event sent to waha.devlike.pro webhook ${webhook.id}`);
                }
            }
        } catch (error) {
            console.error('Error sending seen event to waha.devlike.pro:', error.message);
        }
    }
});

// Initialize the client
client.initialize().catch(err => {
    console.error('Error initializing WhatsApp client:', err);
    updateSessionStatus('error');
});

// Handle process termination signals
process.on('SIGINT', async () => {
    console.log('Bridge terminating, destroying WhatsApp client...');
    await client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Bridge terminating, destroying WhatsApp client...');
    await client.destroy();
    process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Create Express app to handle API requests
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = 3000 + parseInt(sessionId); // Use dynamic port based on session ID

// CORS middleware - Allow requests from any origin (including n8n)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    
    // Handle preflight requests (OPTIONS)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
});

// Parse JSON request body
app.use(bodyParser.json());

// API endpoint to send text message
app.post('/api/send-text', async (req, res) => {
    try {
        const { chatId, message } = req.body;
        
        if (!chatId || !message) {
            return res.status(400).json({ success: false, error: 'chatId and message are required' });
        }
        
        if (!client || client.info === undefined) {
            return res.status(500).json({ success: false, error: 'WhatsApp client not ready' });
        }
        
        const result = await client.sendMessage(chatId, message);
        console.log(`Message sent to ${chatId}: ${message}`);
        
        // Send webhook event for sent message
        await sendWebhookEvent('send_text', { 
            chatId, 
            message, 
            messageId: result.id._serialized,
            timestamp: new Date().toISOString()
        });
        
        return res.status(200).json({ 
            success: true, 
            messageId: result.id._serialized,
            message: 'Message sent successfully' 
        });
    } catch (error) {
        console.error('Error sending message:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// API endpoint to mark messages as seen
app.post('/api/seen', async (req, res) => {
    try {
        const { chatId } = req.body;
        
        if (!chatId) {
            return res.status(400).json({ success: false, error: 'chatId is required' });
        }
        
        if (!client || client.info === undefined) {
            return res.status(500).json({ success: false, error: 'WhatsApp client not ready' });
        }
        
        const chat = await client.getChatById(chatId);
        await chat.sendSeen();
        console.log(`Marked chat ${chatId} as seen`);
        
        // Send webhook event for seen status
        await sendWebhookEvent('seen', { 
            chatId, 
            timestamp: new Date().toISOString()
        });
        
        return res.status(200).json({ 
            success: true, 
            message: 'Chat marked as seen' 
        });
    } catch (error) {
        console.error('Error marking chat as seen:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// API endpoint to start typing
app.post('/api/typing', async (req, res) => {
    try {
        const { chatId, duration = 3000 } = req.body;
        
        if (!chatId) {
            return res.status(400).json({ success: false, error: 'chatId is required' });
        }
        
        if (!client || client.info === undefined) {
            return res.status(500).json({ success: false, error: 'WhatsApp client not ready' });
        }
        
        const chat = await client.getChatById(chatId);
        await chat.sendStateTyping();
        console.log(`Started typing in chat ${chatId} for ${duration}ms`);
        
        // Send webhook event for typing status
        await sendWebhookEvent('typing', { 
            chatId, 
            duration,
            timestamp: new Date().toISOString()
        });
        
        // Stop typing after duration
        setTimeout(async () => {
            await chat.clearState();
            console.log(`Stopped typing in chat ${chatId}`);
        }, duration);
        
        return res.status(200).json({ 
            success: true, 
            message: `Started typing for ${duration}ms` 
        });
    } catch (error) {
        console.error('Error setting typing state:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// Integration with waha.devlike.pro
app.post('/api/waha-webhook', async (req, res) => {
    try {
        const wahaEvent = req.body;
        
        if (!wahaEvent || !wahaEvent.event) {
            return res.status(400).json({ success: false, error: 'Invalid event format' });
        }
        
        // Process event based on type
        switch (wahaEvent.event) {
            case 'send_text':
                if (wahaEvent.data && wahaEvent.data.chatId && wahaEvent.data.message) {
                    const result = await client.sendMessage(wahaEvent.data.chatId, wahaEvent.data.message);
                    return res.status(200).json({ 
                        success: true, 
                        messageId: result.id._serialized,
                        message: 'Message sent successfully' 
                    });
                }
                break;
                
            case 'seen':
                if (wahaEvent.data && wahaEvent.data.chatId) {
                    const chat = await client.getChatById(wahaEvent.data.chatId);
                    await chat.sendSeen();
                    return res.status(200).json({ 
                        success: true, 
                        message: 'Chat marked as seen' 
                    });
                }
                break;
                
            case 'typing':
                if (wahaEvent.data && wahaEvent.data.chatId) {
                    const chat = await client.getChatById(wahaEvent.data.chatId);
                    await chat.sendStateTyping();
                    const duration = wahaEvent.data.duration || 3000;
                    setTimeout(async () => {
                        await chat.clearState();
                    }, duration);
                    return res.status(200).json({ 
                        success: true, 
                        message: `Started typing for ${duration}ms` 
                    });
                }
                break;
                
            default:
                return res.status(400).json({ success: false, error: 'Unsupported event type' });
        }
        
        return res.status(400).json({ success: false, error: 'Missing required data' });
    } catch (error) {
        console.error('Error processing waha webhook:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// Start the API server
app.listen(PORT, () => {
    console.log(`API server listening on port ${PORT}`);
    console.log(`API endpoints available:`);
    console.log(`- POST http://localhost:${PORT}/api/send-text - Send a text message`);
    console.log(`- POST http://localhost:${PORT}/api/seen - Mark a chat as seen`);
    console.log(`- POST http://localhost:${PORT}/api/typing - Start typing in a chat`);
    console.log(`- POST http://localhost:${PORT}/api/waha-webhook - Webhook endpoint for waha.devlike.pro`);
});
