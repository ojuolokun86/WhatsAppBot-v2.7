# WhatsAppBot v2.7

## Overview
WhatsAppBot v2.7 is a feature-rich bot designed to assist with group management, messaging, and more on WhatsApp. It includes functionalities such as anti-link, anti-sales, user statistics, scheduled messages, announcements, and various commands for both general users and admins.

## Features
- Anti-Link Detection
- Anti-Sales Detection
- User Statistics
- Scheduled Messages
- Announcements
- Group Participant Updates
- Various Commands for General Users and Admins

## Commands
### General Commands
- `.ping`: Check if the bot is active.
- `.menu`: Show the help menu with a list of commands.
- `.joke`: Get a random joke.
- `.quote`: Get a random quote.
- `.weather <city>`: Get weather information for a specified city.
- `.translate <text>`: Translate text (implementation needed).
- `.admin`: List group admins.
- `.info`: Show group information.
- `.rules`: Show group rules.
- `.clear`: Clear chat (restricted to admins in groups and you in private chats).

### Admin Commands (Group Chat Only)
- `.ban @user`: Ban a user from the group.
- `.tagall <message>`: Tag all members in the group with a message.
- `.mute`: Mute the group (restrict chat to admins only).
- `.unmute`: Unmute the group (allow all members to chat).
- `.announce <message>`: Make an announcement.
- `.stopannounce`: Stop announcements.
- `.schedule <time> <message>`: Schedule a message to be sent at a specific time.
- `.listscheduled`: List all scheduled messages.
- `.stats`: Show user statistics.
- `.setstyle <style>`: Set message style.
- `.stylelist`: List available styles.
- `.styledefault`: Reset to default style.
- `.showstats`: Show all group member stats.
- `.startwelcome`: Start sending welcome messages (restricted to bot owner).
- `.stopwelcome`: Stop sending welcome messages (restricted to bot owner).
- `.savelink <name> <url>`: Save a link (restricted to bot owner).
- `.deletelink <name>`: Delete a saved link (restricted to bot owner).
- `.pastelink <name>`: Paste a saved link.
- `.mute`: Mute the bot in the group (bot won't respond to commands).
- `.unmute`: Unmute the bot in the group (bot will respond to commands).

## Setup
### Prerequisites
- Node.js
- npm

### Installation
1. Clone the repository:
   ```sh
   git clone https://github.com/your-username/WhatsAppBot-v2.7.git
   cd WhatsAppBot-v2.7