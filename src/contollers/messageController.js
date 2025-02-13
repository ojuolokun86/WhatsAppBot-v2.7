const { handleAutoReplies, handleAntiLink, handleAntiSales, updateUserStats, sendHelpMenu, sendJoke, sendQuote, sendWeather, listAdmins, sendGroupInfo, sendGroupRules, clearChat, tagAll, startAnnouncement, stopAnnouncement, scheduleMessage, listScheduledMessages, addAutoReply, removeAutoReply, listAutoReplies, sendUserStats, setLanguage, pinMessage, unpinMessage, setGroupRules, setTournamentRules, setStyle, listStyles, resetStyle, showAllGroupStats } = require('../services/messageService');
const { formatMessage } = require('../utils/logger');
const { prefix, botNumber, adminNumber } = require('../config/config');

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
            await handleAutoReplies(sock, chatId, msgText, sender);
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

        const adminCommands = new Set(['ban', 'tagall', 'mute', 'unmute', 'announce', 'stopannounce', 'schedule', 'addreply', 'removereply', 'listreplies', 'stats', 'setlanguage', 'pin', 'unpin', 'clear', 'setgrouprules', 'settournamentrules', 'promote', 'demote', 'delete', 'warn', 'savelink', 'deletelink', 'pastelink', 'startwelcome', 'stopwelcome', 'showstats']);

        if (adminCommands.has(command)) {
            if (!isGroup) {
                await sock.sendMessage(chatId, { text: formatMessage('This command is available only in group chats.') });
                return;
            }
            if (!isAdmin && sender !== botNumber) {
                await sock.sendMessage(chatId, { text: formatMessage('❌ You are not an admin to use this command.') });
                return;
            }
            if (!isBotAdmin) {
                await sock.sendMessage(chatId, { text: formatMessage('❌ Bot is not an admin in this group.') });
                return;
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
                await clearChat(sock, chatId);
                break;
            case 'ban':
                if (args.length > 0) {
                    const userToBan = args[0].replace('@', '') + "@s.whatsapp.net";
                    await sock.groupParticipantsUpdate(chatId, [userToBan], 'remove');
                    await sock.sendMessage(chatId, { text: formatMessage(`🚫 User ${args[0]} has been banned.`) });
                } else {
                    await sock.sendMessage(chatId, { text: formatMessage('Usage: .ban @user') });
                }
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
            case 'addreply':
                await addAutoReply(sock, chatId, args);
                break;
            case 'removereply':
                await removeAutoReply(sock, chatId, args);
                break;
            case 'listreplies':
                await listAutoReplies(sock, chatId);
                break;
            case 'stats':
                await sendUserStats(sock, chatId, args);
                break;
            case 'setlanguage':
                await setLanguage(sock, chatId, args);
                break;
            case 'pin':
                await pinMessage(sock, chatId, args);
                break;
            case 'unpin':
                await unpinMessage(sock, chatId);
                break;
            case 'setgrouprules':
                await setGroupRules(sock, chatId, args.join(' '));
                break;
            case 'settournamentrules':
                await setTournamentRules(sock, chatId, args.join(' '));
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
            default:
                await sock.sendMessage(chatId, { text: formatMessage('❌ Unknown command! Use .menu for commands list.') });
        }

        await handleAntiSales(sock, message, msgText, chatId, sender);
        updateUserStats(sender, command);
    } catch (error) {
        console.error("❌ Error handling incoming message:", error);
    }
}

module.exports = {
    handleIncomingMessages,
    handleGroupParticipantsUpdate
};