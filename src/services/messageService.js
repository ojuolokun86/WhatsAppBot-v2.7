const { formatMessage } = require('../utils/logger');
const { botNumber, adminNumber, prefix } = require('../config/config');
const supabase = require('../supabaseClient');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
dotenv.config();

let warnings = {};
let manualWarnings = {};
let userStats = {};
let scheduledMessages = {};
let announcementInterval = null;
let announcementMessage = '';
let savedLinks = {};
let mutedGroups = new Set(); // Store muted groups
let welcomeEnabled = new Set(); // Store groups with welcome enabled

async function handleAntiLink(sock, message, msgText, chatId, participant) {
    const linkRegex = /(https?:\/\/[^\s]+)/g;
    const whatsappChannelRegex = /https:\/\/whatsapp\.com\/channel\/[^\s]+/g;

    if (linkRegex.test(msgText) || whatsappChannelRegex.test(msgText)) {
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const isBotAdmin = groupMetadata.participants.some(p => p.id === botNumber && p.admin);
            const isAdmin = groupMetadata.participants.some(p => p.id === participant && (p.admin === 'admin' || p.admin === 'superadmin'));

            if (!isBotAdmin) {
                console.log("❌ Bot is not an admin, cannot delete messages.");
                return;
            }

            if (participant !== botNumber && !isAdmin) {
                await sock.sendMessage(chatId, { 
                    delete: { remoteJid: chatId, fromMe: false, id: message.key.id, participant: message.key.participant } 
                });

                warnings[participant] = (warnings[participant] || 0) + 1;
                await sock.sendMessage(chatId, { text: formatMessage(`⚠️ Warning ${warnings[participant]}/3: No links allowed!`) });

                if (warnings[participant] >= 3) {
                    await sock.groupParticipantsUpdate(chatId, [participant], 'remove');
                }
            }
        } catch (err) {
            console.error("Error handling anti-link:", err);
        }
    }
}

async function handleAntiSales(sock, message, msgText, chatId, sender) {
    const salesKeywords = ['sell', 'buy', 'trade', 'swap', 'exchange', 'price', 'for sale', 'available for purchase', 's3ll', 'b!uy'];
    const isAdmin = sender === adminNumber;

    const isSalesMessage = salesKeywords.some(keyword => msgText.toLowerCase().includes(keyword));

    if (isSalesMessage && sender !== botNumber && !isAdmin) {
        await sock.sendMessage(chatId, { delete: message.key });
        warnings[sender] = (warnings[sender] || 0) + 1;
        await sock.sendMessage(chatId, { text: formatMessage(`⚠️ Warning ${warnings[sender]}/2: No sales, trading, or swapping allowed! (Admins only)`), mentions: [sender] });

        if (warnings[sender] >= 2) {
            await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
        }
    }

    if (message.message.imageMessage || message.message.videoMessage) {
        const caption = message.message.imageMessage?.caption || message.message.videoMessage?.caption || '';
        const isSalesMedia = salesKeywords.some(keyword => caption.toLowerCase().includes(keyword));

        if (isSalesMedia && sender !== botNumber && !isAdmin) {
            await sock.sendMessage(chatId, { delete: message.key });
            warnings[sender] = (warnings[sender] || 0) + 1;
            await sock.sendMessage(chatId, { text: formatMessage(`⚠️ Warning ${warnings[sender]}/2: No sales, trading, or swapping allowed! (Admins DEAL only)`), mentions: [sender] });

            if (warnings[sender] >= 2) {
                await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
            }
        }
    }
}

function updateUserStats(sender, command) {
    if (!userStats[sender]) {
        userStats[sender] = { messages: 0, commands: {} };
    }
    userStats[sender].messages += 1;
    if (command) {
        if (!userStats[sender].commands[command]) {
            userStats[sender].commands[command] = 0;
        }
        userStats[sender].commands[command] += 1;
    }
}

async function sendUserStats(sock, chatId, args) {
    const userId = args[0];
    if (!userStats[userId]) {
        await sock.sendMessage(chatId, { text: formatMessage('No stats available for this user.') });
        return;
    }

    const stats = userStats[userId];
    let statsMessage = `📊 *User Stats for ${userId}:*\n\n`;
    statsMessage += `Messages: ${stats.messages}\n`;
    statsMessage += `Commands:\n`;
    for (const [command, count] of Object.entries(stats.commands)) {
        statsMessage += `- ${command}: ${count}\n`;
    }

    await sock.sendMessage(chatId, { text: formatMessage(statsMessage) });
}

async function clearChat(sock, chatId, sender, groupMetadata) {
    const isAdmin = groupMetadata.participants.some(p => p.id === sender && p.admin);
    if (!isAdmin) return await sock.sendMessage(chatId, { text: "❌ Only admins can clear the chat." });

    await sock.sendMessage(chatId, { text: "🗑️ Clearing chat..." });
    await sock.sendMessage(chatId, { delete: { remoteJid: chatId, fromMe: true } });
}

async function startWelcomeMessages(sock, chatId) {
    welcomeEnabled.add(chatId);
    await sock.sendMessage(chatId, { text: formatMessage('✅ Welcome messages have been enabled.') });
}

async function stopWelcomeMessages(sock, chatId) {
    welcomeEnabled.delete(chatId);
    await sock.sendMessage(chatId, { text: formatMessage('✅ Welcome messages have been disabled.') });
}

async function handleLockChatCommand(sock, chatId, isAdmin) {
    if (!isAdmin) {
        await sock.sendMessage(chatId, { text: formatMessage('❌ You are not an admin to use this command.') });
        return;
    }

    const groupMetadata = await sock.groupMetadata(chatId);
    const isBotAdmin = groupMetadata.participants.some(p => p.id === botNumber && p.admin);

    if (!isBotAdmin) {
        await sock.sendMessage(chatId, { text: formatMessage('❌ Bot is not an admin in this group.') });
        return;
    }

    await sock.groupSettingUpdate(chatId, 'announcement');
    mutedGroups.add(chatId);
    await sock.sendMessage(chatId, { text: formatMessage('🔒 Group has been muted. Only admins can send messages.') });
}

async function handleUnlockChatCommand(sock, chatId, isAdmin) {
    if (!isAdmin) {
        await sock.sendMessage(chatId, { text: formatMessage('❌ You are not an admin to use this command.') });
        return;
    }

    const groupMetadata = await sock.groupMetadata(chatId);
    const isBotAdmin = groupMetadata.participants.some(p => p.id === botNumber && p.admin);

    if (!isBotAdmin) {
        await sock.sendMessage(chatId, { text: formatMessage('❌ Bot is not an admin in this group.') });
        return;
    }

    await sock.groupSettingUpdate(chatId, 'not_announcement');
    mutedGroups.delete(chatId);
    await sock.sendMessage(chatId, { text: formatMessage('🔓 Group has been unmuted. All members can send messages.') });
}

async function handleIncomingMessages(sock, m) {
    try {
        const message = m.messages[0];
        if (!message.message) return;

        const msgText = message.message.conversation || message.message.extendedTextMessage?.text || '';
        const chatId = message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;

        console.log(`📩 Message received from ${sender}: ${msgText}`);

        const isGroup = chatId.endsWith('@g.us') || chatId.endsWith('@broadcast');

        if (!isGroup && msgText.trim() !== '.bot' && sender !== botNumber) {
            return;
        }

        if (!msgText.startsWith(prefix)) {
            await handleAntiLink(sock, message, msgText, chatId, sender);
            await handleAntiSales(sock, message, msgText, chatId, sender);
            updateUserStats(sender); // Update user statistics for messages
            return;
        }

        const args = msgText.trim().split(/ +/);
        const command = args.shift().slice(prefix.length).toLowerCase();
        console.log(`🔹 Command detected: ${command}`);

        let isAdmin = false;
        let isBotAdmin = false;
        if (isGroup) {
            try {
                const groupMetadata = await sock.groupMetadata(chatId);
                isAdmin = groupMetadata.participants.some(p =>
                    p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
                );
                isBotAdmin = groupMetadata.participants.some(p =>
                    p.id === botNumber && (p.admin === 'admin' || p.admin === 'superadmin')
                );
            } catch (e) {
                console.error("Error fetching group metadata:", e);
            }
        }

        switch (command) {
            case 'ping':
                await sock.sendMessage(chatId, { text: formatMessage('🏓 Pong! Bot is active.') });
                break;
            case 'menu':
                await sendHelpMenu(sock, chatId, isGroup, isAdmin);
                break;
            case 'joke':
                await sendJoke(sock, chatId);
                break;
            case 'quote':
                await sendQuote(sock, chatId);
                break;
            case 'weather':
                await sendWeather(sock, chatId, args);
                break;
            case 'translate':
                await translateText(sock, chatId, args);
                break;
            case 'admin':
                await listAdmins(sock, chatId);
                break;
            case 'info':
                await sendGroupInfo(sock, chatId);
                break;
            case 'rules':
                await sendGroupRules(sock, chatId);
                break;
            case 'clear':
                await clearChat(sock, chatId, isAdmin);
                break;
            case 'ban':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: formatMessage('This command is available only in group chats.') });
                    return;
                }
                if (!isAdmin) {
                    await sock.sendMessage(chatId, { text: formatMessage('❌ You are not an admin to use this command.') });
                    return;
                }
                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, { text: formatMessage('❌ Bot is not an admin in this group.') });
                    return;
                }
                if (args.length === 0) {
                    await sock.sendMessage(chatId, { text: formatMessage('Usage: .ban @user') });
                    return;
                }
                const userToBan = args[0].replace('@', '') + "@s.whatsapp.net";
                await sock.groupParticipantsUpdate(chatId, [userToBan], 'remove');
                await sock.sendMessage(chatId, { text: formatMessage(`🚫 User ${args[0]} has been banned.`) });
                break;
            case 'tagall':
                await tagAll(sock, chatId, args.join(' '), sender);
                break;
            case 'mute':
                await handleLockChatCommand(sock, chatId, isAdmin);
                break;
            case 'unmute':
                await handleUnlockChatCommand(sock, chatId, isAdmin);
                break;
            case 'announce':
                await startAnnouncement(sock, chatId, args.join(' '));
                break;
            case 'stopannounce':
                await stopAnnouncement(sock, chatId);
                break;
            case 'schedule':
                await scheduleMessage(sock, chatId, args);
                break;
            case 'listscheduled':
                await listScheduledMessages(sock, chatId);
                break;
            case 'stats':
                await sendUserStats(sock, chatId, args);
                break;
            case 'setstyle':
                await setStyle(sock, chatId, args);
                break;
            case 'stylelist':
                await listStyles(sock, chatId);
                break;
            case 'styledefault':
                await resetStyle(sock, chatId);
                break;
            case 'showstats':
                await showAllGroupStats(sock, chatId);
                break;
            case 'startwelcome':
                await startWelcomeMessages(sock, chatId);
                break;
            case 'stopwelcome':
                await stopWelcomeMessages(sock, chatId);
                break;
            case 'savelink':
                await saveLink(sock, chatId, args);
                break;
            case 'deletelink':
                await deleteLink(sock, chatId, args);
                break;
            case 'pastelink':
                await pasteLink(sock, chatId, args);
                break;
            default:
                await sock.sendMessage(chatId, { text: formatMessage('❌ Unknown command! Use .menu for commands list.') });
        }

        updateUserStats(sender, command);
    } catch (error) {
        console.error("❌ Error handling incoming message:", error);
    }
}

module.exports = {
    handleIncomingMessages,
    handleGroupParticipantsUpdate
};