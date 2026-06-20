// scripts/register-commands.js
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID; // set your bot client id

if (!TOKEN || !GUILD_ID || !CLIENT_ID) {
  console.error('Set DISCORD_TOKEN, CLIENT_ID and GUILD_ID in .env');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, '..', 'commands');
if (fs.existsSync(commandsPath)) {
  for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
    try {
      const cmd = require(path.join(commandsPath, file));
      if (cmd && cmd.name && cmd.slash) commands.push(cmd.slash);
    } catch (err) {
      console.error('Failed to load command', file, err);
    }
  }
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log(`Registering ${commands.length} commands to guild ${GUILD_ID}`);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('Commands registered.');
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
})();
