// index.js — modular bot loader
// Requires node 16+, discord.js v14

const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials } = require('discord.js');

// Configuration
const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = process.env.PREFIX || '!';
const DATA_DIR = path.join(__dirname, 'data');

if (!TOKEN) {
  console.error('ERROR: DISCORD_TOKEN environment variable not set');
  process.exit(1);
}

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// libs
const utils = require('./lib/utils');
const warns = require('./lib/warns');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Load commands
const commands = new Map();
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
    try {
      const cmd = require(path.join(commandsPath, file));
      if (cmd && cmd.name) commands.set(cmd.name, cmd);
    } catch (err) {
      console.error('Failed to load command', file, err);
    }
  }
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity(`${PREFIX}help | ${client.guilds.cache.size} guild(s)`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.guild) return; // guild-only

  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmdName = args.shift().toLowerCase();
  const command = commands.get(cmdName);
  if (!command) return; // unknown

  try {
    await command.execute(message, args, client, { utils, warns, commands, PREFIX });
  } catch (err) {
    console.error('Command error:', err);
    message.reply('An error occurred while running that command.');
  }
});

// expose some internals for commands
module.exports = { client, commands };

client.login(TOKEN);
