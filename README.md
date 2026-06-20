# Discord Bot — Moderation & Utilities

This branch adds a full moderation system with both slash and prefix commands, SQLite persistence, and per-server configurable warn policies.

Highlights
- Slash commands registered to the test guild (guild ID in .env or GUILD_ID env var).
- Keeps prefix commands for backward compatibility.
- SQLite DB: data/bot.db (tables: warns, tempbans, tempmutes, settings, warn_actions).
- Per-server editable warn policies via the /warnpolicy slash command (add/list/remove).
- Persisted tempbans and tempmutes; the bot resumes scheduled unbans/unmutes on startup.
- /setmodlog to set a per-guild moderation log channel.

Quick setup
1. Install dependencies:
   npm install
   (or: npm install discord.js better-sqlite3 dotenv)

2. Create a .env file from .env.example and fill in your bot token and test guild ID.

3. Ensure the bot has the necessary intents and permissions:
   - Enable "Message Content Intent" in the Discord Developer Portal if you want prefix commands.
   - Invite the bot with permissions: Send Messages, Manage Roles, Kick Members, Ban Members, Manage Messages, etc.

4. Start the bot:
   npm run start
   or for development with auto-reload:
   npm run dev

Using warn policies (per-server editable)
- Add a policy (slash):
  /warnpolicy add threshold:3 action:tempmute duration:1d
  This will tempmute a user for 1 day when they reach 3 warns.

- List policies:
  /warnpolicy list

- Remove a policy:
  /warnpolicy remove threshold:3

Notes
- Actions supported: mute, tempmute, kick, ban, tempban. For temporaries use the duration field (e.g., 1d2h).
- Warns, tempbans, tempmutes and settings are stored per-guild in the SQLite database.

Files changed on branch feat/moderation-slash-commands
- index.js (major rewrite)
- package.json (added better-sqlite3, dotenv, dev script)
- data/ (created at runtime; contains bot.db)
- README.md (this file)
- .env.example

Opening a PR
I can open a PR for this branch if you want. I currently have committed the changes to feat/moderation-slash-commands. To open a PR you can:
- Use the GitHub UI: go to the repo, switch to the branch `feat/moderation-slash-commands` and click "Compare & pull request".
- Or use the GitHub CLI:
  gh pr create --fill --base main --head feat/moderation-slash-commands

If you want I can prepare the PR title/body for you to paste. Reply with "open PR" and I will draft the title and body text for the PR comment.
