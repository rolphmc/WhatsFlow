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
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--disable-gpu']
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
        
        // Prepare the event payload
        const payload = {
            event: eventType,
            sessionId: parseInt(sessionId),
            timestamp: new Date().toISOString(),
            data
        };
        
        // Send the event to each webhook
        console.log(`Sending ${eventType} event to ${webhooks.length} webhooks`);
        
        for (const webhook of webhooks) {
            try {
                const headers = webhook.headers || {};
                await axios.post(webhook.url, payload, { headers });
                console.log(`Event ${eventType} sent to webhook ${webhook.id} (${webhook.name})`);
            } catch (webhookError) {
                console.error(`Error sending to webhook ${webhook.id}:`, webhookError.message);
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
    updateSessionStatus('connected');
});

// Disconnected event
client.on('disconnected', (reason) => {
    console.log('WhatsApp client disconnected:', reason);
    updateSessionStatus('disconnected');
});

// Message event
client.on('message', async (message) => {
    console.log(`New message received: ${message.body}`);
    
    // Format message data for webhook
    const messageData = {
        id: message.id.id,
        body: message.body,
        from: message.from,
        to: message.to,
        fromMe: message.fromMe,
        hasMedia: message.hasMedia,
        timestamp: message.timestamp
    };
    
    // If it has mentions, include them
    if (message.mentionedIds && message.mentionedIds.length > 0) {
        messageData.mentionedIds = message.mentionedIds;
    }
    
    // Send webhook event
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
            timestamp: message.timestamp
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
