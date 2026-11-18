const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  delay,
} = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 3001;
const FASTAPI_WEBHOOK_URL = process.env.FASTAPI_WEBHOOK_URL || 'http://127.0.0.1:8000/api/v1/webhooks/simulate';

app.use(cors());
app.use(express.json());

// In-memory registry of active store sockets
// storeId -> { sock, status: 'disconnected'|'pairing'|'connected', phone, pairingCode, lastSeen }
const sessions = new Map();

const SESSIONS_DIR = path.join(__dirname, 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

/**
 * Format raw phone number into standard international digits without leading '+' or symbols
 */
function cleanPhoneNumber(phone) {
  let cleaned = String(phone).replace(/\D/g, '');
  // Default to India country code 91 if 10 digits provided
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

/**
 * Initialize or retrieve Baileys socket for a given store
 */
async function initStoreSocket(storeId, phoneToPair = null) {
  const storeSessionDir = path.join(SESSIONS_DIR, storeId);
  const { state, saveCreds } = await useMultiFileAuthState(storeSessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  });

  const sessionInfo = {
    sock,
    status: state.creds?.registered ? 'connected' : 'pairing',
    phone: phoneToPair || null,
    pairingCode: null,
    storeId,
    connectedAt: state.creds?.registered ? new Date() : null,
  };

  sessions.set(storeId, sessionInfo);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[Store ${storeId}] Connection closed. Reason code: ${statusCode}. Reconnecting: ${shouldReconnect}`);

      sessionInfo.status = 'disconnected';
      if (shouldReconnect) {
        setTimeout(() => initStoreSocket(storeId, sessionInfo.phone), 5000);
      }
    } else if (connection === 'open') {
      console.log(`[Store ${storeId}] ✅ WhatsApp connection OPEN and LIVE!`);
      sessionInfo.status = 'connected';
      sessionInfo.connectedAt = new Date();
      sessionInfo.pairingCode = null;
    }
  });

  // Listen to incoming messages from customers
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      // Ignore outgoing messages sent by the shopkeeper themselves
      if (msg.key.fromMe) continue;

      const remoteJid = msg.key.remoteJid || '';
      // Ignore status updates or group messages (unless broadcast)
      if (remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') continue;

      const senderPhone = '+' + remoteJid.replace('@s.whatsapp.net', '');
      const senderName = msg.pushName || 'Customer';

      // Extract message text from text, extended text, or caption
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        '';

      if (!text.trim()) continue;

      console.log(`[Store ${storeId}] Inbound message from ${senderName} (${senderPhone}): "${text}"`);

      // Forward to FastAPI AI parser & retail order pipeline
      try {
        const payload = {
          store_id: storeId,
          shopkeeper_phone: sessionInfo.phone || undefined,
          sender_phone: senderPhone,
          sender_name: senderName,
          message_text: text,
          message_id: msg.key.id,
        };

        const response = await fetch(FASTAPI_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`[Store ${storeId}] Order parsed and synced to dashboard:`, result?.simulated_message_id || 'OK');
        } else {
          console.error(`[Store ${storeId}] FastAPI webhook error:`, response.status, await response.text());
        }
      } catch (err) {
        console.error(`[Store ${storeId}] Failed to forward message to FastAPI backend:`, err.message);
      }
    }
  });

  // If phone provided and not yet registered, request the 8-digit pairing code
  if (phoneToPair && !state.creds?.registered) {
    try {
      await delay(2000); // Wait for socket handshake
      const cleanPhone = cleanPhoneNumber(phoneToPair);
      console.log(`[Store ${storeId}] Requesting 8-digit pairing code for phone: ${cleanPhone}...`);
      const code = await sock.requestPairingCode(cleanPhone);
      // Format code as ABCD-1234 if 8 characters
      const formattedCode = code?.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
      sessionInfo.pairingCode = formattedCode;
      sessionInfo.phone = cleanPhone;
      console.log(`[Store ${storeId}] 🔑 Pairing Code Generated: ${formattedCode}`);
    } catch (err) {
      console.error(`[Store ${storeId}] Pairing code request error:`, err);
      sessionInfo.status = 'error';
      sessionInfo.error = err.message;
    }
  }

  return sessionInfo;
}

// ----------------- API Endpoints -----------------

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', active_sessions: sessions.size, port: PORT });
});

// Request 8-digit pairing code for shopkeeper's phone
app.post('/api/pair', async (req, res) => {
  const { store_id, phone_number } = req.body;

  if (!store_id || !phone_number) {
    return res.status(400).json({ error: 'store_id and phone_number are required' });
  }

  try {
    const sessionInfo = await initStoreSocket(store_id, phone_number);

    // Return the pairing code once ready
    let attempts = 0;
    while (!sessionInfo.pairingCode && attempts < 10) {
      await delay(500);
      attempts++;
    }

    if (sessionInfo.pairingCode) {
      return res.json({
        success: true,
        store_id,
        phone_number: cleanPhoneNumber(phone_number),
        pairing_code: sessionInfo.pairingCode,
        message: 'Enter this 8-digit code in WhatsApp > Linked Devices > Link with phone number',
      });
    } else {
      return res.status(500).json({
        success: false,
        error: sessionInfo.error || 'Failed to generate pairing code. Please retry in a few seconds.',
      });
    }
  } catch (err) {
    console.error('Pairing error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Check WhatsApp connection status for a store
app.get('/api/status/:store_id', (req, res) => {
  const { store_id } = req.params;
  const session = sessions.get(store_id);

  if (!session) {
    // Check if session files exist on disk
    const storeSessionDir = path.join(SESSIONS_DIR, store_id);
    const hasCreds = fs.existsSync(path.join(storeSessionDir, 'creds.json'));
    return res.json({
      store_id,
      status: hasCreds ? 'saved_offline' : 'disconnected',
      phone: null,
      pairing_code: null,
    });
  }

  res.json({
    store_id,
    status: session.status,
    phone: session.phone,
    pairing_code: session.pairingCode,
    connected_at: session.connectedAt,
  });
});

// Send outgoing WhatsApp message to customer (e.g. Bill summary, Confirmation, Pickup QR)
app.post('/api/send', async (req, res) => {
  const { store_id, recipient_phone, message_text } = req.body;

  if (!store_id || !recipient_phone || !message_text) {
    return res.status(400).json({ error: 'store_id, recipient_phone, and message_text are required' });
  }

  const session = sessions.get(store_id);
  if (!session || session.status !== 'connected' || !session.sock) {
    return res.status(400).json({
      success: false,
      error: `WhatsApp is not connected for store ${store_id}. Please link phone first.`,
    });
  }

  try {
    const cleanRecipient = cleanPhoneNumber(recipient_phone);
    const jid = `${cleanRecipient}@s.whatsapp.net`;

    await session.sock.sendMessage(jid, { text: message_text });
    console.log(`[Store ${store_id}] Sent message to ${recipient_phone}: "${message_text.slice(0, 40)}..."`);

    res.json({ success: true, recipient: cleanRecipient });
  } catch (err) {
    console.error(`[Store ${store_id}] Send message error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Auto-restore any existing saved sessions on startup
fs.readdir(SESSIONS_DIR, (err, dirs) => {
  if (!err && dirs) {
    for (const dir of dirs) {
      const credsPath = path.join(SESSIONS_DIR, dir, 'creds.json');
      if (fs.existsSync(credsPath)) {
        console.log(`Restoring saved session for store ${dir}...`);
        initStoreSocket(dir).catch((e) => console.error(`Restore error for ${dir}:`, e.message));
      }
    }
  }
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  WhatsApp Pairing Gateway running on http://127.0.0.1:${PORT}`);
  console.log(`  Supports 8-digit Pairing Code (No Laptop / No QR needed)`);
  console.log(`=======================================================`);
});
