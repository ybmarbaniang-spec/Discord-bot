# Discord Bot

This repository contains a single-file Discord bot (index.js) that implements a large set of moderation and utility commands available as both slash commands and prefix commands.

Features
- Slash + prefix commands for most actions
- Per-server configurable prefix (persisted in SQLite)
- Persistence for warns, tempbans, and tempmutes using SQLite (data/bot.db)
- Warn policy system with auto-actions (mute/tempmute/kick/ban/tempban)
- /setmodlog to configure a moderation log channel
- Many utility and fun commands (ping, uptime, roll, 8ball, etc.)

Quick start
1. Install dependencies:

   npm install

2. Create a `.env` with:

   DISCORD_TOKEN=your_bot_token
   GUILD_ID=your_test_guild_id
   PREFIX=!

3. Invite the bot with appropriate permissions and enable "Message Content Intent" if you want prefix commands.

4. Start the bot:

   npm run start

Notes
- `better-sqlite3` may require native build tools (Python, make, C/C++). On Linux you may need `build-essential` and `python`.
- Slash commands are registered guild-scoped for the test guild defined by `GUILD_ID` for instant availability. You can remove guild-scoped registration to make them global (may take up to an hour to propagate).
- The bot must have a role high enough to manage roles for moderation actions.

Configuration
- Per-server prefixes and mod-log channel are stored in `data/bot.db` (SQLite). Use `/setprefix` and `/setmodlog` to configure.

Contributing
- Consider splitting commands into separate modules for maintainability.
