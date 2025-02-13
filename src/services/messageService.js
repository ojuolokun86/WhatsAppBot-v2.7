const { formatMessage } = require('../utils/logger');
const { botNumber, adminNumber, prefix } = require('../config/config');

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
    const userId = args[0]?.replace('@', '') + "@s.whatsapp.net";
    if (!userId || !userStats[userId]) {
        await sock.sendMessage(chatId, { text: formatMessage('❌ No statistics available for this user.') });
        return;
    }

    const stats = userStats[userId];
    let statsMessage = `📊 *User Statistics for @${userId.split('@')[0]}:*\n\n`;
    statsMessage += `📩 *Messages Sent:* ${stats.messages}\n`;
    statsMessage += `🔹 *Commands Used:*\n`;
    for (const [command, count] of Object.entries(stats.commands)) {
        statsMessage += `- ${command}: ${count}\n`;
    }

    await sock.sendMessage(chatId, { text: formatMessage(statsMessage), mentions: [userId] });
}

async function showAllGroupStats(sock, chatId) {
    let statsMessage = `📊 *Group Member Statistics:*\n\n`;
    for (const [userId, stats] of Object.entries(userStats)) {
        statsMessage += `👤 @${userId.split('@')[0]}:\n`;
        statsMessage += `📩 *Messages Sent:* ${stats.messages}\n`;
        statsMessage += `🔹 *Commands Used:*\n`;
        for (const [command, count] of Object.entries(stats.commands)) {
            statsMessage += `  - ${command}: ${count}\n`;
        }
        statsMessage += '\n';
    }

    await sock.sendMessage(chatId, { text: formatMessage(statsMessage), mentions: Object.keys(userStats) });
}

async function scheduleMessage(sock, chatId, args) {
    if (args.length < 2) {
        await sock.sendMessage(chatId, { text: formatMessage('❌ Usage: .schedule <time> <message>') });
        return;
    }

    const time = args.shift();
    const message = args.join(' ');

    // Parse the time (format: HH:MM)
    const [hours, minutes] = time.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        await sock.sendMessage(chatId, { text: formatMessage('❌ Invalid time format. Use HH:MM (24-hour format).') });
        return;
    }

    const now = new Date();
    const scheduledTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);

    // If the scheduled time is in the past, schedule it for the next day
    if (scheduledTime < now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const delay = scheduledTime - now;

    // Schedule the message
    const timeoutId = setTimeout(async () => {
        await sock.sendMessage(chatId, { text: formatMessage(message) });
        delete scheduledMessages[timeoutId];
    }, delay);

    // Store the scheduled message
    scheduledMessages[timeoutId] = { chatId, message, scheduledTime };

    await sock.sendMessage(chatId, { text: formatMessage(`✅ Message scheduled for ${scheduledTime.toLocaleTimeString()}.`) });
}

async function listScheduledMessages(sock, chatId) {
    if (Object.keys(scheduledMessages).length === 0) {
        await sock.sendMessage(chatId, { text: formatMessage('📋 No scheduled messages.') });
        return;
    }

    let messageList = '📋 *Scheduled Messages:*\n\n';
    for (const [id, { message, scheduledTime }] of Object.entries(scheduledMessages)) {
        messageList += `- ${message} (at ${scheduledTime.toLocaleString()})\n`;
    }

    await sock.sendMessage(chatId, { text: formatMessage(messageList) });
}

async function startAnnouncement(sock, chatId, message) {
    try {
        if (announcementInterval) {
            clearInterval(announcementInterval);
        }

        announcementMessage = message;
        announcementInterval = setInterval(async () => {
            try {
                await sock.sendMessage(chatId, { text: formatMessage(announcementMessage) });
            } catch (error) {
                console.error("Error sending announcement:", error);
            }
        }, 3600000); // Every hour
        await sock.sendMessage(chatId, { text: formatMessage('✅ Announcement started.') });
    } catch (error) {
        console.error("Error starting announcement:", error);
    }
}

async function stopAnnouncement(sock, chatId) {
    try {
        if (announcementInterval) {
            clearInterval(announcementInterval);
            announcementInterval = null;
            announcementMessage = '';
            await sock.sendMessage(chatId, { text: formatMessage('✅ Announcement stopped.') });
        } else {
            await sock.sendMessage(chatId, { text: formatMessage('❌ No active announcement to stop.') });
        }
    } catch (error) {
        console.error("Error stopping announcement:", error);
    }
}

async function handleGroupParticipantsUpdate(sock, update) {
    const { id, participants, action } = update;
    if (action === 'add' && welcomeEnabled.has(id)) {
        for (const participant of participants) {
            await sock.sendMessage(id, {
                text: formatMessage(`Welcome to the Efootball Dynasty family @${participant.split('@')[0]}, where legends are made! 🎉⚽ We’re beyond pumped to have you here! Brace yourself for non-stop fun, legendary tournaments, and fierce competition! 🏆💥 Let’s create unforgettable moments and take this Dynasty to the next level! 🔥👑`),
                mentions: [participant]
            });
        }
    }
}

async function tagAll(sock, chatId, message, sender) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        const members = groupMetadata.participants.map(m => m.id);
        const groupName = groupMetadata.subject;
        const senderName = sender.split('@')[0];

        let tagMessage = `📢 *${groupName} Announcement:*\n\n${message}\n\n`;
        tagMessage += members.map(m => `@${m.split('@')[0]}`).join(' ');

        await sock.sendMessage(chatId, { text: formatMessage(tagMessage), mentions: members });
    } catch (error) {
        console.error("Error tagging all members:", error);
    }
}

async function pasteLink(sock, chatId, args) {
    if (args.length < 1) {
        await sock.sendMessage(chatId, { text: formatMessage('❌ Usage: .pastelink <name>') });
        return;
    }

    const name = args[0];

    if (!savedLinks[name]) {
        await sock.sendMessage(chatId, { text: formatMessage('❌ No link found with that name.') });
        return;
    }

    await sock.sendMessage(chatId, { text: formatMessage(savedLinks[name]) });
}

async function saveLink(sock, chatId, args) {
    if (args.length < 2) {
        await sock.sendMessage(chatId, { text: formatMessage('❌ Usage: .savelink <name> <url>') });
        return;
    }

    const name = args[0];
    const url = args[1];

    savedLinks[name] = url;
    await sock.sendMessage(chatId, { text: formatMessage(`✅ Link saved as ${name}.`) });
}

async function deleteLink(sock, chatId, args) {
    if (args.length < 1) {
        await sock.sendMessage(chatId, { text: formatMessage('❌ Usage: .deletelink <name>') });
        return;
    }

    const name = args[0];

    if (!savedLinks[name]) {
        await sock.sendMessage(chatId, { text: formatMessage('❌ No link found with that name.') });
        return;
    }

    delete savedLinks[name];
    await sock.sendMessage(chatId, { text: formatMessage(`✅ Link ${name} deleted.`) });
}

async function sendHelpMenu(sock, chatId, isGroup, isAdmin) {
    let helpMessage = `📋 *Help Menu:*\n\n`;
    helpMessage += `🔹 *General Commands:*\n`;
    helpMessage += `- .ping: Check if the bot is active.\n`;
    helpMessage += `- .menu: Show the help menu with a list of commands.\n`;
    helpMessage += `- .joke: Get a random joke.\n`;
    helpMessage += `- .quote: Get a random quote.\n`;
    helpMessage += `- .weather <city>: Get weather information for a specified city.\n`;
    helpMessage += `- .translate <text>: Translate text (implementation needed).\n`;
    helpMessage += `- .admin: List group admins.\n`;
    helpMessage += `- .info: Show group information.\n`;
    helpMessage += `- .rules: Show group rules.\n`;
    helpMessage += `- .clear: Clear chat (restricted to admins in groups and you in private chats).\n\n`;

    if (isGroup && isAdmin) {
        helpMessage += `🔹 *Admin Commands (Group Chat Only):*\n`;
        helpMessage += `- .ban @user: Ban a user from the group.\n`;
        helpMessage += `- .tagall <message>: Tag all members in the group with a message.\n`;
        helpMessage += `- .mute: Mute the group (restrict chat to admins only).\n`;
        helpMessage += `- .unmute: Unmute the group (allow all members to chat).\n`;
        helpMessage += `- .announce <message>: Make an announcement.\n`;
        helpMessage += `- .stopannounce: Stop announcements.\n`;
        helpMessage += `- .schedule <time> <message>: Schedule a message to be sent at a specific time.\n`;
        helpMessage += `- .listscheduled: List all scheduled messages.\n`;
        helpMessage += `- .stats: Show user statistics.\n`;
        helpMessage += `- .setstyle <style>: Set message style.\n`;
        helpMessage += `- .stylelist: List available styles.\n`;
        helpMessage += `- .styledefault: Reset to default style.\n`;
        helpMessage += `- .showstats: Show all group member stats.\n`;
        helpMessage += `- .startwelcome: Start sending welcome messages (restricted to bot owner).\n`;
        helpMessage += `- .stopwelcome: Stop sending welcome messages (restricted to bot owner).\n`;
        helpMessage += `- .savelink <name> <url>: Save a link (restricted to bot owner).\n`;
        helpMessage += `- .deletelink <name>: Delete a saved link (restricted to bot owner).\n`;
        helpMessage += `- .pastelink <name>: Paste a saved link.\n`;
        helpMessage += `- .promote @user: Promote a user to admin.\n`;
        helpMessage += `- .demote @user: Demote an admin to user.\n`;
    }

    await sock.sendMessage(chatId, { text: formatMessage(helpMessage) });
}

async function sendJoke(sock, chatId) {
    const jokes = [
        "Why don't scientists trust atoms? Because they make up everything!",
        "Why did the scarecrow win an award? Because he was outstanding in his field!",
        "Why don't skeletons fight each other? They don't have the guts."
    ];
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    await sock.sendMessage(chatId, { text: formatMessage(joke) });
}

async function sendQuote(sock, chatId) {
    const quotes = [
        "The best way to predict the future is to invent it. - Alan Kay",
        "Life is 10% what happens to us and 90% how we react to it. - Charles R. Swindoll",
        "The only way to do great work is to love what you do. - Steve Jobs"
    ];
    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    await sock.sendMessage(chatId, { text: formatMessage(quote) });
}

async function sendWeather(sock, chatId, args) {
    if (args.length < 1) {
        await sock.sendMessage(chatId, { text: formatMessage('❌ Usage: .weather <city>') });
        return;
    }

    const city = args.join(' ');
    // Implement weather API call here
    const weatherInfo = `Weather information for ${city} (implementation needed).`;
    await sock.sendMessage(chatId, { text: formatMessage(weatherInfo) });
}

async function translateText(sock, chatId, args) {
    if (args.length < 1) {
        await sock.sendMessage(chatId, { text: formatMessage('❌ Usage: .translate <text>') });
        return;
    }

    const text = args.join(' ');
    // Implement translation API call here
    const translatedText = `Translated text (implementation needed): ${text}`;
    await sock.sendMessage(chatId, { text: formatMessage(translatedText) });
}

async function listAdmins(sock, chatId) {
    const groupMetadata = await sock.groupMetadata(chatId);
    const admins = groupMetadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
    const adminList = admins.map(a => `@${a.id.split('@')[0]}`).join('\n');
    await sock.sendMessage(chatId, { text: formatMessage(`👥 *Group Admins:*\n\n${adminList}`), mentions: admins.map(a => a.id) });
}

async function sendGroupInfo(sock, chatId) {
    const groupMetadata = await sock.groupMetadata(chatId);
    const groupInfo = `📋 *Group Information:*\n\n`;
    groupInfo += `- *Group Name:* ${groupMetadata.subject}\n`;
    groupInfo += `- *Group Description:* ${groupMetadata.desc}\n`;
    groupInfo += `- *Group Created At:* ${new Date(groupMetadata.creation * 1000).toLocaleString()}\n`;
    groupInfo += `- *Group Owner:* @${groupMetadata.owner.split('@')[0]}\n`;
    groupInfo += `- *Total Members:* ${groupMetadata.participants.length}\n`;

    await sock.sendMessage(chatId, { text: formatMessage(groupInfo), mentions: [groupMetadata.owner] });
}

async function sendGroupRules(sock, chatId) {
    const rules = "1. Be respectful.\n2. No spamming.\n3. Follow the group topic.";
    await sock.sendMessage(chatId, { text: formatMessage(`📋 *Group Rules:*\n\n${rules}`) });
}

async function clearChat(sock, chatId, isAdmin) {
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

    const messages = await sock.loadMessages(chatId, 100);
    const messageKeys = messages.messages.map(m => m.key);

    for (const key of messageKeys) {
        await sock.sendMessage(chatId, { delete: key });
    }

    await sock.sendMessage(chatId, { text: formatMessage('✅ Chat cleared.') });
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