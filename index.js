const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
dotenv.config();

const prefix = ".";
let warnings = {};
let polls = {};
let groupRules = {};
let tournamentRules = {};
let announcementInterval = null;
let announcementMessage = '';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const autoReplies = {
    "hi": "👋 Hello! How can I help you?",
    "hello": "👋 Hi there! How are you today?",
    "good morning": "🌞 Good morning! Hope you slept well.",
    "good afternoon": "☀️ Good afternoon! How is your day going?",
    "good evening": "🌆 Good evening! Hope you had a great day.",
    "how are you doing": "😊 I'm fine! How about you?",
    "how far": "👌 I'm good! What about you?",
    "what’s up": "🤙 Nothing much! How can I help?",
    "bro": "Yes, my friend! What’s up?",
    "please": "Sure! What do you need help with?",
    "who are you": "🤖 I'm *GODS GRACE BOT*, your assistant.",
    "where are you from": "🌍 I live on the internet, but I’m here to help you!",
    "what can you do": "🤖 I can help with group management, messages, and more. Type .help for commands.",
    "who created you": "👨‍💻 I was created by a developer to assist in this group.",
    "tell me a joke": "😂 Why don’t skeletons fight each other? Because they don’t have the guts! 😆",
    "i love you": "❤️ Aww! Thank you! I love helping you too. 😊",
    "i miss you": "😢 Don’t worry, I’m always here!",
    "are you single": "🤣 Haha! I’m just a bot, I don’t date.",
    "where can i get help": "📞 If you need help, ask the admin. Type .support for details.",
    "can you help me": "🤖 Of course! Just tell me what you need.",
    "how do i report someone": "⚠️ If someone is causing problems, please inform an admin.",
    "how do i join a tournament": "⚽ To join a tournament, send me a DM or message an admin.",
    "how to register": "📝 If you want to register, send a message to an admin.",
    "how can i earn points": "🏆 To know how points work, please message an admin.",
    "who is leading the league": "📊 Message me or an admin for the latest league table.",
    "when is the next match": "⏳ Match schedules are available! Message me or an admin.",
    "how do i check my ranking": "📊 To check rankings, send me a DM or ask an admin.",
    "who won the last match": "⚽ Message me or an admin for match results.",
    "who is the admin": "👑 *You are chatting with an admin!* How can I help?",
    "how do i know the admin": "🔰 Check the group members list to see the admins.",
    "how do i leave the group": "🚪 If you want to leave, click 'Exit Group' in settings.",
    "are you online": "✅ Yes, I’m here!",
    "goodbye": "👋 Goodbye! Have a great day.",
    "see you later": "👋 See you soon!",
    "do you speak english": "🇬🇧 Yes, I speak English!",
    "who are you": "🤖 I'm *GODS GRACE BOT*, your assistant in this group."
};

const botNumber = "2348026977793@s.whatsapp.net"; // Your bot's number

const styles = {
    default: (message) => `╔══════════════════╗\n║ 🚀 **TECHITOON BOT** 🚀 ║\n╚══════════════════╝\n\n${message}\n\n╭━ ⋅☆⋅ ━╮\n  🤖 **Techitoon AI**\n╰━ ⋅☆⋅ ━╯`,
    fancy: (message) => `╔══════════════════╗\n║ 🚀 **𝓣𝓔𝓒𝓗𝓘𝓣𝓞𝓞𝓝 𝓑𝓞𝓣** 🚀 ║\n╚══════════════════╝\n\n${message}\n\n╭━ ⋅☆⋅ ━╮\n  🤖 **𝓣𝓮𝓬𝓱𝓲𝓽𝓸𝓸𝓷 𝓐𝓘**\n╰━ ⋅☆⋅ ━╯`,
    stylish: (message) => `╔══════════════════╗\n║ 🚀 **𝕋𝔼ℂℍ𝕀𝕋𝕆𝕆ℕ 𝔹𝕆𝕋** 🚀 ║\n╚══════════════════╝\n\n${message}\n\n╭━ ⋅☆⋅ ━╮\n  🤖 **𝕋𝕖𝕔𝕙𝕚𝕥𝕠𝕠𝕟 𝔸𝕀**\n╰━ ⋅☆⋅ ━╯`,
    big: (message) => `╔══════════════════╗\n║ 🚀 **ＴＥＣＨＩＴＯＯＮ ＢＯＴ** 🚀 ║\n╚══════════════════╝\n\n${message}\n\n╭━ ⋅☆⋅ ━╮\n  🤖 **Ｔｅｃｈｉｔｏｏｎ ＡＩ**\n╰━ ⋅☆⋅ ━╯`
};

let currentStyle = styles.default;

function formatMessage(message) {
    return currentStyle(message);
}

async function setStyle(sock, chatId, args) {
    const styleName = args[0];
    if (styles[styleName]) {
        currentStyle = styles[styleName];
        await sock.sendMessage(chatId, { text: formatMessage(`✅ Style changed to ${styleName}.`) });
    } else {
        await sock.sendMessage(chatId, { text: formatMessage(`❌ Invalid style name. Available styles: ${Object.keys(styles).join(', ')}`) });
    }
}

async function listStyles(sock, chatId) {
    const styleList = `📋 *Available Styles:*\n\n${Object.keys(styles).map(style => `- ${style}`).join('\n')}`;
    await sock.sendMessage(chatId, { text: formatMessage(styleList) });
}

async function resetStyle(sock, chatId) {
    currentStyle = styles.default;
    await sock.sendMessage(chatId, { text: formatMessage('✅ Style reset to default.') });
}

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
    const { connection } = update;
    if (connection === "open") {
        console.log("✅ Bot Connected to WhatsApp!");
    } else if (connection === "close") {
        console.log("❌ Connection closed, restarting...");
        setTimeout(() => startBot(), 5000);
    }
}

function handleQRCode(qr) {
    qrcode.generate(qr, { small: true });
}

async function handleIncomingMessages(sock, m) {
    try {
        const message = m.messages[0];
        if (!message.message) return;

        const msgText = message.message.conversation || message.message.extendedTextMessage?.text || '';
        const chatId = message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;

        console.log(`📩 Message received from ${sender}: ${msgText}`);

        const isGroup = chatId.endsWith('@g.us');

        // In private chat, only respond if the message is ".bot" or if the sender is the bot itself
        if (!isGroup && msgText.trim() !== '.bot' && sender !== botNumber) {
            return;
        }

        if (!msgText.startsWith(prefix)) {
            await handleAutoReplies(sock, chatId, msgText, sender);
            await handleAntiLink(sock, message, msgText, chatId, sender);
            await handleAntiSales(sock, message, msgText, chatId, sender);
            return;
        }

        const args = msgText.trim().split(/ +/);
        const command = args.shift().slice(prefix.length).toLowerCase();
        console.log(`🔹 Command detected: ${command}`);

        // For group chats, check if the sender is an admin.
        let isAdmin = false;
        if (isGroup) {
            try {
                const groupMetadata = await sock.groupMetadata(chatId);
                isAdmin = groupMetadata.participants.some(p =>
                    p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
                );
            } catch (e) {
                console.error("Error fetching group metadata:", e);
            }
        }

        // Define the set of admin-only commands.
        const adminCommands = new Set(['ban', 'tagall', 'mute', 'unmute', 'announce', 'stopannounce', 'lockchat', 'unlockchat', 'schedule', 'addreply', 'removereply', 'listreplies', 'stats', 'setlanguage', 'pin', 'unpin', 'clear', 'setgrouprules', 'settournamentrules']);

        // If an admin command is used in a non-group chat or by a non-admin, block it.
        if (adminCommands.has(command)) {
            if (!isGroup) {
                await sock.sendMessage(chatId, { text: formatMessage('This command is available only in group chats.') });
                return;
            }
            if (!isAdmin && sender !== botNumber) {
                await sock.sendMessage(chatId, { text: formatMessage('❌ You are not an admin to use this command.') });
                return;
            }
        }

        // Process commands.
        switch (command) {
            // General Commands (available for everyone)
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

            // Admin Commands (group chat only)
            case 'ban':
                if (args.length > 0) {
                    // Remove the '@' if provided and construct the WhatsApp ID.
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
                // Placeholder for mute command logic
                await sock.sendMessage(chatId, { text: formatMessage('🔇 Mute command executed (placeholder).') });
                break;
            case 'unmute':
                // Placeholder for unmute command logic
                await sock.sendMessage(chatId, { text: formatMessage('🔊 Unmute command executed (placeholder).') });
                break;
            case 'announce':
                await startAnnouncement(sock, chatId, args.join(' '));
                break;
            case 'stopannounce':
                await stopAnnouncement(sock, chatId);
                break;
            case 'lockchat':
                await handleLockChatCommand(sock, chatId, isAdmin);
                break;
            case 'unlockchat':
                await handleUnlockChatCommand(sock, chatId, isAdmin);
                break;
            case 'schedule':
                await scheduleMessage(sock, chatId, args);
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
            default:
                await sock.sendMessage(chatId, { text: formatMessage('❌ Unknown command! Use .menu for commands list.') });
        }

        // Check for deals in messages and media files
        await handleAntiSales(sock, message, msgText, chatId, sender);
    } catch (error) {
        console.error("❌ Error handling incoming message:", error);
    }
}

async function translateText(sock, chatId, args) {
    // Implement translation logic here
}

async function scheduleMessage(sock, chatId, args) {
    // Implement message scheduling logic here
}

async function addAutoReply(sock, chatId, args) {
    const trigger = args[0];
    const response = args.slice(1).join(' ');
    autoReplies[trigger] = response;
    await sock.sendMessage(chatId, { text: formatMessage(`✅ Auto-reply added: "${trigger}" -> "${response}"`) });
}

async function removeAutoReply(sock, chatId, args) {
    const trigger = args[0];
    delete autoReplies[trigger];
    await sock.sendMessage(chatId, { text: formatMessage(`✅ Auto-reply removed: "${trigger}"`) });
}

async function listAutoReplies(sock, chatId) {
    let replyList = '📋 *Auto-Replies:*\n';
    for (const [trigger, response] of Object.entries(autoReplies)) {
        replyList += `- "${trigger}": "${response}"\n`;
    }
    await sock.sendMessage(chatId, { text: formatMessage(replyList) });
}

async function sendUserStats(sock, chatId, args) {
    // Implement user stats logic here
}

async function setLanguage(sock, chatId, args) {
    // Implement set language logic here
}

async function listAdmins(sock, chatId) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id.split('@')[0]);
        const adminList = admins.map(admin => `👤 @${admin}`).join('\n');
        await sock.sendMessage(chatId, { text: formatMessage(`📋 *Admins:*\n${adminList}`), mentions: admins });
    } catch (e) {
        console.error('Error in listAdmins:', e);
    }
}

async function sendGroupInfo(sock, chatId) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        const groupName = groupMetadata.subject;
        const groupDesc = groupMetadata.desc || 'No description';
        const groupOwner = groupMetadata.owner.split('@')[0];
        const groupCreation = new Date(groupMetadata.creation * 1000).toLocaleString();
        const groupInfo = `📋 *Group Info:*\n\n👥 *Name:* ${groupName}\n📝 *Description:* ${groupDesc}\n👤 *Owner:* @${groupOwner}\n📅 *Created On:* ${groupCreation}`;
        await sock.sendMessage(chatId, { text: formatMessage(groupInfo), mentions: [groupMetadata.owner] });
    } catch (e) {
        console.error('Error in sendGroupInfo:', e);
    }
}

async function sendGroupRules(sock, chatId) {
    const rules = groupRules[chatId] || "No rules set for this group.";
    await sock.sendMessage(chatId, { text: formatMessage(`📋 *Group Rules:*\n\n${rules}`) });
}

async function setGroupRules(sock, chatId, rules) {
    groupRules[chatId] = rules;
    await sock.sendMessage(chatId, { text: formatMessage("✅ Group rules have been updated.") });
}

async function setTournamentRules(sock, chatId, rules) {
    tournamentRules[chatId] = rules;
    await sock.sendMessage(chatId, { text: formatMessage("✅ Tournament rules have been updated.") });
}

async function pinMessage(sock, chatId, args) {
    const message = args.join(' ');
    await sock.sendMessage(chatId, { text: formatMessage(`📌 Pinned Message: ${message}`) });
}

async function unpinMessage(sock, chatId) {
    await sock.sendMessage(chatId, { text: formatMessage('📌 Unpinned Message.') });
}

async function sendHelpMenu(sock, chatId, isGroup, isAdmin) {
    const helpMessage = `📋 *Help Menu:*\n\nGeneral Commands:\n- .ping: Check if the bot is active\n- .menu: Show this help menu\n- .joke: Get a random joke\n- .quote: Get a random quote\n- .weather <city>: Get weather info\n- .translate <text>: Translate text\n- .admin: List group admins\n- .info: Show group info\n- .rules: Show group rules\n- .clear: Clear chat\n\nAdmin Commands:\n- .ban @user: Ban a user\n- .tagall <message>: Tag all members\n- .mute: Mute the group\n- .unmute: Unmute the group\n- .announce <message>: Make an announcement\n- .stopannounce: Stop announcements\n- .lockchat: Lock the chat\n- .unlockchat: Unlock the chat\n- .schedule <message>: Schedule a message\n- .addreply <trigger> <response>: Add an auto-reply\n- .removereply <trigger>: Remove an auto-reply\n- .listreplies: List all auto-replies\n- .stats: Show user stats\n- .setlanguage <language>: Set bot language\n- .pin <message>: Pin a message\n- .unpin: Unpin a message\n- .setgrouprules <rules>: Set group rules\n- .settournamentrules <rules>: Set tournament rules\n- .setstyle <style>: Set message style\n- .stylelist: List available styles\n- .styledefault: Reset to default style`;
    await sock.sendMessage(chatId, { text: formatMessage(helpMessage) });
}

async function sendJoke(sock, chatId) {
    const joke = "😂 Why don’t skeletons fight each other? Because they don’t have the guts! 😆";
    await sock.sendMessage(chatId, { text: formatMessage(joke) });
}

async function sendQuote(sock, chatId) {
    const quote = "🌟 The only way to do great work is to love what you do. - Steve Jobs";
    await sock.sendMessage(chatId, { text: formatMessage(quote) });
}

async function sendWeather(sock, chatId, args) {
    const city = args.join(' ');
    const weatherInfo = `🌤️ The weather in ${city} is sunny with a high of 25°C and a low of 15°C.`;
    await sock.sendMessage(chatId, { text: formatMessage(weatherInfo) });
}

async function handleLockChatCommand(sock, chatId, isAdmin) {
    if (!isAdmin) return sock.sendMessage(chatId, { text: formatMessage("⚠️ This command is for admins only!") });
    await sock.groupSettingUpdate(chatId, 'announcement');
    sock.sendMessage(chatId, { text: formatMessage('🔒 Chat is now restricted to admins only.') });
}

async function handleUnlockChatCommand(sock, chatId, isAdmin) {
    if (!isAdmin) return sock.sendMessage(chatId, { text: formatMessage("⚠️ This command is for admins only!") });
    await sock.groupSettingUpdate(chatId, 'not_announcement');
    sock.sendMessage(chatId, { text: formatMessage('✅ Chat is now open for all members.') });
}

async function handleAntiLink(sock, message, msgText, chatId, participant) {
    const linkRegex = /(https?:\/\/[^\s]+)/g;
    const whatsappChannelRegex = /https:\/\/whatsapp\.com\/channel\/[^\s]+/g;
    if (linkRegex.test(msgText) || whatsappChannelRegex.test(msgText)) {
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const isBotAdmin = groupMetadata.participants.some(p => p.id === botNumber && p.admin);

            if (!isBotAdmin) {
                console.log("❌ Bot is not an admin, cannot delete messages.");
                return;
            }

            await sock.sendMessage(chatId, { 
                delete: { remoteJid: chatId, fromMe: false, id: message.key.id, participant: message.key.participant } 
            });

            warnings[participant] = (warnings[participant] || 0) + 1;
            await sock.sendMessage(chatId, { text: formatMessage(`⚠️ 𝓦𝓪𝓻𝓷𝓲𝓷𝓰 ${warnings[participant]}/3: 𝓝𝓸 𝓵𝓲𝓷𝓴𝓼 𝓪𝓵𝓵𝓸𝔀𝓮𝓭!`) });

            if (warnings[participant] >= 3) {
                await sock.groupParticipantsUpdate(chatId, [participant], 'remove');
            }
        } catch (err) {
            console.error("Error handling anti-link:", err);
        }
    }
}

async function handleAntiSales(sock, message, msgText, chatId, sender) {
    const salesKeywords = ['sell', 'buy', 'trade', 'swap', 'exchange', 'price', 'for sale', 'available for purchase', 's3ll', 'b!uy'];
    const isSalesMessage = salesKeywords.some(keyword => msgText.toLowerCase().includes(keyword));

    if (isSalesMessage) {
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

        if (isSalesMedia) {
            await sock.sendMessage(chatId, { delete: message.key });
            warnings[sender] = (warnings[sender] || 0) + 1;
            await sock.sendMessage(chatId, { text: formatMessage(`⚠️ Warning ${warnings[sender]}/2: No sales, trading, or swapping allowed! (Admins only)`), mentions: [sender] });

            if (warnings[sender] >= 2) {
                await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
            }
        }
    }
}

async function handleAutoReplies(sock, chatId, msgText, sender) {
    const lowerCaseMsg = msgText.toLowerCase();
    const taggedBot = msgText.includes(`@${botNumber.split('@')[0]}`);

    const isGroup = chatId.endsWith('@g.us');

    if (isGroup) {
        if (taggedBot) {
            for (const [key, reply] of Object.entries(autoReplies)) {
                if (lowerCaseMsg.includes(key)) {
                    await sock.sendMessage(chatId, { text: formatMessage(reply) });
                    break;
                }
            }
        }
    } else {
        for (const [key, reply] of Object.entries(autoReplies)) {
            if (lowerCaseMsg.includes(key)) {
                await sock.sendMessage(chatId, { text: formatMessage(reply) });
                break;
            }
        }
    }
}

async function handleGroupParticipantsUpdate(sock, update) {
    const { id, participants, action } = update;
    if (action === 'add') {
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

        let tagMessage = `╔══════════════════╗\n║ 🚀 **TECHITOON BOT** 🚀 ║\n╚══════════════════╝\n\n📌 **Group:** 『 ${groupName} 』\n👤 **User:** 『 @${senderName} 』\n📝 **Message:** 『 ${message} 』\n\n╭━ ⋅☆⋅ ━╮\n  🤖 **Techitoon AI**\n╰━ ⋅☆⋅ ━╯\n\n`;

        for (const member of members) {
            tagMessage += `🎊 @${member.split('@')[0]}\n`;
        }

        await sock.sendMessage(chatId, { text: tagMessage, mentions: members });
    } catch (e) {
        console.error('Error in tagAll:', e);
    }
}

function resetWarnings() {
    warnings = {};
    console.log('🔄 Warnings reset.');
}
setInterval(resetWarnings, 24 * 60 * 60 * 1000);

startBot();