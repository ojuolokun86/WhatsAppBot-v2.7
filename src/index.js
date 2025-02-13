const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
dotenv.config();
const { formatMessage, setStyle, listStyles, resetStyle } = require('./utils/logger');
const { handleIncomingMessages, handleGroupParticipantsUpdate } = require('./services/messageService');

const prefix = process.env.PREFIX;
let warnings = {};
let manualWarnings = {};
let polls = {};
let groupRules = {};
let tournamentRules = {};
let announcementInterval = null;
let announcementMessage = '';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const botNumber = process.env.BOT_NUMBER; // Your bot's number

function resetWarnings() {
    warnings = {};
    console.log('🔄 Warnings reset.');
}

setInterval(resetWarnings, 24 * 60 * 60 * 1000);

async function startBot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState("auth_info");
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true
        });

        sock.ev.on("creds.update", saveCreds);
        sock.ev.on("connection.update", (update) => handleConnectionUpdate(sock, update));
        sock.ev.on("qr", handleQRCode);
        sock.ev.on("messages.upsert", (m) => handleIncomingMessages(sock, m));
        sock.ev.on("group-participants.update", (update) => handleGroupParticipantsUpdate(sock, update));

        console.log("🤖 WhatsAppBot v2.7 started, waiting for connection...");
    } catch (err) {
        console.error("Error starting bot:", err);
        setTimeout(() => startBot(), 5000);
    }
}

function handleConnectionUpdate(sock, update) {
    const { connection, lastDisconnect } = update;
    if (connection === "open") {
        console.log("✅ Bot Connected to WhatsApp!");
    } else if (connection === "close") {
        console.log("❌ Connection closed, restarting...");
        const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
            setTimeout(() => startBot(), 5000);
        }
    }
}

function handleQRCode(qr) {
    qrcode.generate(qr, { small: true });
}

startBot();