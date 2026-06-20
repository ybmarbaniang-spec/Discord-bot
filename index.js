// index.js — Slash & prefix commands, SQLite persistence, warn auto-actions and modlog command
// Requires Node 16+, discord.js v14, better-sqlite3, and dotenv for local development

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  EmbedBuilder,
  Collection
} = require('discord.js');
const Database = require('better-sqlite3');

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID || '1506638044361658508'; // provided test guild
let PREFIX = process.env.PREFIX || '!';
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = process.env.DATABASE_FILE || path.join(DATA_DIR, 'bot.db');

if (!TOKEN) {
  console.error('ERROR: DISCORD_TOKEN environment variable not set');
  process.exit(1);
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Init DB
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

db.prepare(`CREATE TABLE IF NOT EXISTS warns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT,
  userId TEXT,
  moderatorId TEXT,
  reason TEXT,
  timestamp INTEGER
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS tempbans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT,
  userId TEXT,
  unbanAt INTEGER
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS tempmutes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT,
  userId TEXT,
  unmuteAt INTEGER
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS settings (
  guildId TEXT PRIMARY KEY,
  prefix TEXT,
  modlogChannelId TEXT
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS warn_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT,
  threshold INTEGER,
  action TEXT,
  duration INTEGER
)`).run();

// Load prefix from DB if exists
function loadPrefix(guildId) {
  const row = db.prepare('SELECT prefix FROM settings WHERE guildId = ?').get(guildId);
  return row ? row.prefix : PREFIX;
}

function savePrefix(guildId, prefix) {
  db.prepare('INSERT INTO settings (guildId, prefix) VALUES (?, ?) ON CONFLICT(guildId) DO UPDATE SET prefix = excluded.prefix').run(guildId, prefix);
}

function setModLogChannel(guildId, channelId) {
  db.prepare('INSERT INTO settings (guildId, modlogChannelId) VALUES (?, ?) ON CONFLICT(guildId) DO UPDATE SET modlogChannelId = excluded.modlogChannelId').run(guildId, channelId);
}

function getModLogChannelId(guildId) {
  const row = db.prepare('SELECT modlogChannelId FROM settings WHERE guildId = ?').get(guildId);
  return row ? row.modlogChannelId : null;
}

// Warn action management
function addWarnAction(guildId, threshold, action, duration) {
  db.prepare('INSERT INTO warn_actions (guildId, threshold, action, duration) VALUES (?, ?, ?, ?)').run(guildId, threshold, action, duration || null);
}
function listWarnActions(guildId) {
  return db.prepare('SELECT threshold, action, duration FROM warn_actions WHERE guildId = ? ORDER BY threshold ASC').all(guildId);
}
function removeWarnAction(guildId, threshold) {
  db.prepare('DELETE FROM warn_actions WHERE guildId = ? AND threshold = ?').run(guildId, threshold);
}

// Scheduling unbans and unmutes
const scheduledUnbans = new Map();
const scheduledUnmutes = new Map();

function scheduleUnban(guild, userId, unbanAt) {
  const key = `${guild.id}:${userId}`;
  const ms = unbanAt - Date.now();
  if (ms <= 0) return doUnban(guild, userId);
  if (scheduledUnbans.has(key)) clearTimeout(scheduledUnbans.get(key));
  const t = setTimeout(() => doUnban(guild, userId).catch(() => {}), ms);
  scheduledUnbans.set(key, t);
}

async function doUnban(guild, userId) {
  try { await guild.bans.remove(userId); } catch (err) {}
  db.prepare('DELETE FROM tempbans WHERE guildId = ? AND userId = ?').run(guild.id, userId);
  const key = `${guild.id}:${userId}`;
  if (scheduledUnbans.has(key)) { clearTimeout(scheduledUnbans.get(key)); scheduledUnbans.delete(key); }
  // announce to modlog
  const chId = getModLogChannelId(guild.id);
  try {
    const ch = chId ? guild.channels.cache.get(chId) : (guild.systemChannel || guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(guild.members.me).has(PermissionsBitField.Flags.SendMessages)));
    if (ch && ch.isTextBased()) ch.send(`User <@${userId}> has been unbanned (tempban expired).`).catch(() => {});
  } catch (err) {}
}

function scheduleUnmute(guild, userId, unmuteAt) {
  const key = `${guild.id}:${userId}`;
  const ms = unmuteAt - Date.now();
  if (ms <= 0) return doUnmute(guild, userId);
  if (scheduledUnmutes.has(key)) clearTimeout(scheduledUnmutes.get(key));
  const t = setTimeout(() => doUnmute(guild, userId).catch(() => {}), ms);
  scheduledUnmutes.set(key, t);
}

async function doUnmute(guild, userId) {
  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) {
      const role = guild.roles.cache.find(r => r.name === 'Muted');
      if (role && member.roles.cache.has(role.id)) await member.roles.remove(role, 'Auto unmute (tempmute expired)').catch(() => {});
    }
  } catch (err) {}
  db.prepare('DELETE FROM tempmutes WHERE guildId = ? AND userId = ?').run(guild.id, userId);
  const key = `${guild.id}:${userId}`;
  if (scheduledUnmutes.has(key)) { clearTimeout(scheduledUnmutes.get(key)); scheduledUnmutes.delete(key); }
  const chId = getModLogChannelId(guild.id);
  try {
    const ch = chId ? guild.channels.cache.get(chId) : (guild.systemChannel || guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(guild.members.me).has(PermissionsBitField.Flags.SendMessages)));
    if (ch && ch.isTextBased()) ch.send(`User <@${userId}> has been unmuted (tempmute expired).`).catch(() => {});
  } catch (err) {}
}

async function ensureMutedRole(guild) {
  let role = guild.roles.cache.find(r => r.name === 'Muted');
  if (!role) {
    try {
      role = await guild.roles.create({ name: 'Muted', permissions: [] });
      for (const [, channel] of guild.channels.cache) {
        try {
          if (channel.isTextBased()) await channel.permissionOverwrites.edit(role, { SendMessages: false, AddReactions: false, Speak: false });
        } catch (err) {}
      }
    } catch (err) { console.error('Failed to create Muted role:', err); }
  }
  return role;
}

// Parse durations like 1d2h30m
function parseDuration(str) {
  if (!str) return 0;
  const regex = /(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/;
  const match = str.match(regex);
  if (!match) return 0;
  const days = parseInt(match[1] || 0, 10);
  const hours = parseInt(match[2] || 0, 10);
  const mins = parseInt(match[3] || 0, 10);
  const secs = parseInt(match[4] || 0, 10);
  return ((days * 24 + hours) * 60 + mins) * 60 * 1000 + secs * 1000;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.commands = new Collection();

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity(`${PREFIX}help | ${client.guilds.cache.size} guild(s)`);

  // Register guild-scoped slash commands for instant updates
  try {
    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (guild) {
      const commands = [
        { name: 'ping', description: 'Check bot latency' },
        { name: 'avatar', description: 'Get user avatar', options: [{ name: 'user', type: 6, description: 'User', required: false }] },
        { name: 'serverinfo', description: 'Show server info' },
        { name: 'userinfo', description: 'Show user info', options: [{ name: 'user', type: 6, description: 'User', required: false }] },
        { name: 'roles', description: 'List top roles' },
        { name: 'say', description: 'Bot says something', options: [{ name: 'text', type: 3, description: 'Text', required: true }] },
        { name: 'embed', description: 'Send an embed', options: [{ name: 'text', type: 3, description: 'Text', required: true }] },
        { name: 'kick', description: 'Kick a member', options: [{ name: 'user', type: 6, required: true }, { name: 'reason', type: 3, required: false }] },
        { name: 'ban', description: 'Ban a member', options: [{ name: 'user', type: 6, required: true }, { name: 'reason', type: 3, required: false }] },
        { name: 'tempban', description: 'Tempban a member', options: [{ name: 'user', type: 6, required: true }, { name: 'duration', type: 3, required: true }, { name: 'reason', type: 3, required: false }] },
        { name: 'mute', description: 'Mute a member', options: [{ name: 'user', type: 6, required: true }] },
        { name: 'unmute', description: 'Unmute a member', options: [{ name: 'user', type: 6, required: true }] },
        { name: 'tempmute', description: 'Tempmute a member', options: [{ name: 'user', type: 6, required: true }, { name: 'duration', type: 3, required: true }] },
        { name: 'clear', description: 'Bulk delete messages', options: [{ name: 'count', type: 4, required: true }] },
        { name: 'warn', description: 'Warn a user', options: [{ name: 'user', type: 6, required: true }, { name: 'reason', type: 3, required: false }] },
        { name: 'warnings', description: 'Show warnings', options: [{ name: 'user', type: 6, required: false }] },
        { name: 'clearwarns', description: 'Clear warnings', options: [{ name: 'user', type: 6, required: true }] },
        { name: 'report', description: 'Report a user', options: [{ name: 'user', type: 6, required: true }, { name: 'reason', type: 3, required: false }] },
        { name: 'tempbanlist', description: 'List active tempbans' },
        { name: 'setprefix', description: 'Set command prefix', options: [{ name: 'prefix', type: 3, required: true }] },
        { name: 'setmodlog', description: 'Set mod-log channel', options: [{ name: 'channel', type: 7, description: 'Channel', required: true }] },
        { name: 'warnpolicy', description: 'Manage warn auto-actions', options: [
            { name: 'add', type: 1, description: 'Add a warn action', options: [{ name: 'threshold', type: 4, required: true }, { name: 'action', type: 3, required: true, description: 'mute, tempmute, kick, ban, tempban' }, { name: 'duration', type: 3, required: false, description: 'For temp actions, duration like 1d2h' }] },
            { name: 'list', type: 1, description: 'List warn actions' },
            { name: 'remove', type: 1, description: 'Remove a warn action', options: [{ name: 'threshold', type: 4, required: true }] }
        ] }
      ];
      await guild.commands.set(commands);
      console.log('Registered guild commands to', GUILD_ID);
    } else {
      console.warn('Test guild not found — skipping guild command registration');
    }
  } catch (err) {
    console.error('Failed to register commands:', err);
  }

  // Resume tempbans
  const rows = db.prepare('SELECT guildId, userId, unbanAt FROM tempbans').all();
  for (const r of rows) {
    try {
      const guild = client.guilds.cache.get(r.guildId) || await client.guilds.fetch(r.guildId).catch(() => null);
      if (!guild) continue;
      scheduleUnban(guild, r.userId, r.unbanAt);
    } catch (err) {}
  }

  // Resume tempmutes
  const mrows = db.prepare('SELECT guildId, userId, unmuteAt FROM tempmutes').all();
  for (const r of mrows) {
    try {
      const guild = client.guilds.cache.get(r.guildId) || await client.guilds.fetch(r.guildId).catch(() => null);
      if (!guild) continue;
      scheduleUnmute(guild, r.userId, r.unmuteAt);
    } catch (err) {}
  }
});

// Shared command handlers
async function handleCommandRun(context) {
  // context: { type: 'msg'|'interaction', message, interaction, commandName, args, options }
  const { type, message, interaction, commandName, args, options } = context;
  const respond = async (content) => {
    if (type === 'msg') return message.channel.send(content);
    return interaction.reply({ ...content, ephemeral: content && content.ephemeral ? true : false });
  };

  try {
    switch (commandName) {
      case 'ping': {
        if (type === 'msg') {
          const sent = await message.channel.send('Pinging...');
          const latency = sent.createdTimestamp - message.createdTimestamp;
          const api = Math.round(client.ws.ping);
          return sent.edit(`Pong! Latency: ${latency}ms. API: ${api}ms`);
        } else {
          return interaction.reply(`Pong! API: ${Math.round(client.ws.ping)}ms`);
        }
      }

      case 'avatar': {
        const user = (type === 'msg' ? (message.mentions.users.first() || message.author) : (options.getUser('user') || interaction.user));
        return respond({ content: user.displayAvatarURL({ dynamic: true, size: 1024 }) });
      }

      case 'serverinfo': {
        const g = type === 'msg' ? message.guild : interaction.guild;
        const embed = new EmbedBuilder().setTitle(`${g.name} — Info`).setThumbnail(g.iconURL({ dynamic: true }))
          .addFields({ name: 'ID', value: g.id, inline: true }, { name: 'Members', value: `${g.memberCount}`, inline: true }, { name: 'Created', value: new Date(g.createdTimestamp).toLocaleString(), inline: true })
          .setFooter({ text: `Locale: ${g.preferredLocale || 'unknown'}` });
        return respond({ embeds: [embed] });
      }

      case 'userinfo': {
        const member = type === 'msg' ? (message.mentions.members.first() || message.member) : (options.getMember('user') || interaction.member);
        const user = member.user;
        const embed = new EmbedBuilder().setAuthor({ name: `${user.tag}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
          .addFields({ name: 'ID', value: user.id, inline: true }, { name: 'Joined', value: member.joinedAt ? member.joinedAt.toLocaleString() : 'unknown', inline: true }, { name: 'Created', value: user.createdAt.toLocaleString(), inline: true });
        return respond({ embeds: [embed] });
      }

      case 'roles': {
        const g = type === 'msg' ? message.guild : interaction.guild;
        const roles = g.roles.cache.filter(r => r.id !== g.id).sort((a, b) => b.position - a.position).map(r => r.name).slice(0, 30);
        return respond({ content: `Roles (${roles.length} shown): ${roles.join(', ')}` });
      }

      case 'say': {
        const text = type === 'msg' ? args.join(' ') : options.getString('text');
        const member = type === 'msg' ? message.member : interaction.member;
        if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return respond({ content: 'You do not have permission to use this command.', ephemeral: true });
        if (type === 'msg') await message.delete().catch(() => {});
        return respond({ content: text });
      }

      case 'embed': {
        const text = type === 'msg' ? args.join(' ') : options.getString('text');
        const member = type === 'msg' ? message.member : interaction.member;
        if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return respond({ content: 'You do not have permission to use this command.', ephemeral: true });
        if (type === 'msg') await message.delete().catch(() => {});
        return respond({ embeds: [new EmbedBuilder().setDescription(text).setColor(0x00AE86)] });
      }

      case 'kick': {
        const member = type === 'msg' ? (message.mentions.members.first()) : options.getMember('user');
        const reason = type === 'msg' ? args.slice(1).join(' ') || 'No reason provided' : (options.getString('reason') || 'No reason provided');
        const executor = type === 'msg' ? message.member : interaction.member;
        if (!executor.permissions.has(PermissionsBitField.Flags.KickMembers)) return respond({ content: 'You need Kick Members permission.', ephemeral: true });
        if (!member) return respond({ content: 'Member not found.', ephemeral: true });
        if (!member.kickable) return respond({ content: 'I cannot kick that user.', ephemeral: true });
        await member.kick(reason);
        // log
        logToMod(guildOf(type, message, interaction), `${member.user.tag} was kicked by ${executor.user.tag}. Reason: ${reason}`);
        return respond({ content: `${member.user.tag} was kicked. Reason: ${reason}` });
      }

      case 'ban': {
        const member = type === 'msg' ? (message.mentions.members.first()) : options.getMember('user');
        const reason = type === 'msg' ? args.slice(1).join(' ') || 'No reason provided' : (options.getString('reason') || 'No reason provided');
        const executor = type === 'msg' ? message.member : interaction.member;
        if (!executor.permissions.has(PermissionsBitField.Flags.BanMembers)) return respond({ content: 'You need Ban Members permission.', ephemeral: true });
        if (!member) return respond({ content: 'Member not found.', ephemeral: true });
        await member.ban({ days: 0, reason });
        logToMod(guildOf(type, message, interaction), `${member.user.tag} was banned by ${executor.user.tag}. Reason: ${reason}`);
        return respond({ content: `${member.user.tag} was banned. Reason: ${reason}` });
      }

      case 'tempban': {
        const member = type === 'msg' ? (message.mentions.members.first()) : options.getMember('user');
        const durationArg = type === 'msg' ? args[1] : options.getString('duration');
        const reason = type === 'msg' ? args.slice(2).join(' ') || 'No reason provided' : (options.getString('reason') || 'No reason provided');
        const executor = type === 'msg' ? message.member : interaction.member;
        if (!executor.permissions.has(PermissionsBitField.Flags.BanMembers)) return respond({ content: 'You need Ban Members permission.', ephemeral: true });
        if (!member) return respond({ content: 'Member not found.', ephemeral: true });
        const ms = parseDuration(durationArg);
        if (!ms) return respond({ content: 'Invalid duration format. Use 1d2h30m', ephemeral: true });
        const unbanAt = Date.now() + ms;
        await member.ban({ days: 0, reason });
        db.prepare('INSERT INTO tempbans (guildId, userId, unbanAt) VALUES (?, ?, ?)').run((type === 'msg' ? message.guild.id : interaction.guild.id), member.user.id, unbanAt);
        scheduleUnban(type === 'msg' ? message.guild : interaction.guild, member.user.id, unbanAt);
        logToMod(guildOf(type, message, interaction), `${member.user.tag} was temp-banned by ${executor.user.tag} until ${new Date(unbanAt).toLocaleString()}. Reason: ${reason}`);
        return respond({ content: `${member.user.tag} was temp-banned for ${durationArg}. Reason: ${reason}` });
      }

      case 'mute': {
        const member = type === 'msg' ? (message.mentions.members.first()) : options.getMember('user');
        const executor = type === 'msg' ? message.member : interaction.member;
        if (!executor.permissions.has(PermissionsBitField.Flags.ModerateMembers) && !executor.permissions.has(PermissionsBitField.Flags.ManageRoles)) return respond({ content: 'You need Moderate Members or Manage Roles permission.', ephemeral: true });
        if (!member) return respond({ content: 'Member not found.', ephemeral: true });
        const role = await ensureMutedRole(type === 'msg' ? message.guild : interaction.guild);
        if (!role) return respond({ content: 'Failed to ensure Muted role exists.', ephemeral: true });
        if (member.roles.cache.has(role.id)) return respond({ content: 'Member is already muted.', ephemeral: true });
        await member.roles.add(role, `Muted by ${executor.user.tag}`);
        logToMod(guildOf(type, message, interaction), `${member.user.tag} was muted by ${executor.user.tag}.`);
        return respond({ content: `${member.user.tag} has been muted.` });
      }

      case 'unmute': {
        const member = type === 'msg' ? (message.mentions.members.first()) : options.getMember('user');
        const executor = type === 'msg' ? message.member : interaction.member;
        if (!executor.permissions.has(PermissionsBitField.Flags.ModerateMembers) && !executor.permissions.has(PermissionsBitField.Flags.ManageRoles)) return respond({ content: 'You need Moderate Members or Manage Roles permission.', ephemeral: true });
        if (!member) return respond({ content: 'Member not found.', ephemeral: true });
        const role = (type === 'msg' ? message.guild : interaction.guild).roles.cache.find(r => r.name === 'Muted');
        if (!role) return respond({ content: 'No Muted role found.', ephemeral: true });
        if (!member.roles.cache.has(role.id)) return respond({ content: 'Member is not muted.', ephemeral: true });
        await member.roles.remove(role, `Unmuted by ${executor.user.tag}`);
        logToMod(guildOf(type, message, interaction), `${member.user.tag} was unmuted by ${executor.user.tag}.`);
        return respond({ content: `${member.user.tag} has been unmuted.` });
      }

      case 'tempmute': {
        const member = type === 'msg' ? (message.mentions.members.first()) : options.getMember('user');
        const durationArg = type === 'msg' ? args[1] : options.getString('duration');
        const executor = type === 'msg' ? message.member : interaction.member;
        if (!executor.permissions.has(PermissionsBitField.Flags.ModerateMembers) && !executor.permissions.has(PermissionsBitField.Flags.ManageRoles)) return respond({ content: 'You need Moderate Members or Manage Roles permission.', ephemeral: true });
        if (!member) return respond({ content: 'Member not found.', ephemeral: true });
        const ms = parseDuration(durationArg);
        if (!ms) return respond({ content: 'Invalid duration.', ephemeral: true });
        const role = await ensureMutedRole(type === 'msg' ? message.guild : interaction.guild);
        await member.roles.add(role, `Tempmuted by ${executor.user.tag} for ${durationArg}`);
        const unmuteAt = Date.now() + ms;
        db.prepare('INSERT INTO tempmutes (guildId, userId, unmuteAt) VALUES (?, ?, ?)').run((type === 'msg' ? message.guild.id : interaction.guild.id), member.user.id, unmuteAt);
        scheduleUnmute(type === 'msg' ? message.guild : interaction.guild, member.user.id, unmuteAt);
        logToMod(guildOf(type, message, interaction), `${member.user.tag} was tempmuted by ${executor.user.tag} until ${new Date(unmuteAt).toLocaleString()}.`);
        return respond({ content: `${member.user.tag} was tempmuted for ${durationArg}.` });
      }

      case 'clear': {
        const count = type === 'msg' ? parseInt(args[0], 10) : options.getInteger('count');
        const executor = type === 'msg' ? message.member : interaction.member;
        if (!executor.permissions.has(PermissionsBitField.Flags.ManageMessages)) return respond({ content: 'You need Manage Messages permission.', ephemeral: true });
        if (!count || count < 1 || count > 100) return respond({ content: 'Provide a number between 1 and 100.', ephemeral: true });
        const deleted = await (type === 'msg' ? message.channel.bulkDelete(count, true) : interaction.channel.bulkDelete(count, true));
        return respond({ content: `Deleted ${deleted.size || 0} messages.` });
      }

      case 'warn': {
        const user = type === 'msg' ? (message.mentions.users.first()) : options.getUser('user');
        const reason = type === 'msg' ? args.slice(1).join(' ') || 'No reason provided' : (options.getString('reason') || 'No reason provided');
        const executor = type === 'msg' ? message.member : interaction.member;
        if (!executor.permissions.has(PermissionsBitField.Flags.KickMembers) && !executor.permissions.has(PermissionsBitField.Flags.BanMembers)) return respond({ content: 'You need Kick or Ban permission to warn.', ephemeral: true });
        if (!user) return respond({ content: 'User not found.', ephemeral: true });
        const guildId = type === 'msg' ? message.guild.id : interaction.guild.id;
        db.prepare('INSERT INTO warns (guildId, userId, moderatorId, reason, timestamp) VALUES (?, ?, ?, ?, ?)').run(guildId, user.id, executor.user.id, reason, Date.now());
        try { await user.send(`You were warned in ${(type === 'msg' ? message.guild.name : interaction.guild.name)}: ${reason}`); } catch (err) {}
        // log warn
        logToMod(guildOf(type, message, interaction), `${user.tag} was warned by ${executor.user.tag}. Reason: ${reason}`);
        // check warn actions
        const countRow = db.prepare('SELECT COUNT(*) as c FROM warns WHERE guildId = ? AND userId = ?').get(guildId, user.id);
        const count = countRow ? countRow.c : 0;
        const actionRow = db.prepare('SELECT action, duration FROM warn_actions WHERE guildId = ? AND threshold = ?').get(guildId, count);
        if (actionRow) {
          // perform action
          const action = actionRow.action;
          const duration = actionRow.duration;
          await performAutoAction(guildOf(type, message, interaction), user.id, action, duration, executor.user.tag, `Auto-action for reaching ${count} warns`);
        }
        return respond({ content: `${user.tag} has been warned. Reason: ${reason}` });
      }

      case 'warnings': {
        const user = type === 'msg' ? (message.mentions.users.first() || message.author) : (options.getUser('user') || interaction.user);
        const guildId = type === 'msg' ? message.guild.id : interaction.guild.id;
        const rows = db.prepare('SELECT moderatorId, reason, timestamp FROM warns WHERE guildId = ? AND userId = ? ORDER BY timestamp DESC').all(guildId, user.id);
        if (!rows.length) return respond({ content: `${user.tag} has no warnings.` });
        const out = rows.map((w, i) => `${i+1}. by <@${w.moderatorId}> on ${new Date(w.timestamp).toLocaleString()} — ${w.reason}`).join('\n');
        return respond({ embeds: [new EmbedBuilder().setTitle(`Warnings for ${user.tag}`).setDescription(out)] });
      }

      case 'clearwarns': {
        const user = type === 'msg' ? (message.mentions.users.first()) : options.getUser('user');
        const executor = type === 'msg' ? message.member : interaction.member;
        if (!executor.permissions.has(PermissionsBitField.Flags.KickMembers) && !executor.permissions.has(PermissionsBitField.Flags.BanMembers)) return respond({ content: 'You need Kick or Ban permission.', ephemeral: true });
        if (!user) return respond({ content: 'User not found.', ephemeral: true });
        const guildId = type === 'msg' ? message.guild.id : interaction.guild.id;
        const info = db.prepare('SELECT COUNT(*) AS c FROM warns WHERE guildId = ? AND userId = ?').get(guildId, user.id);
        if (!info.c) return respond({ content: `${user.tag} has no warnings.` });
        db.prepare('DELETE FROM warns WHERE guildId = ? AND userId = ?').run(guildId, user.id);
        logToMod(guildOf(type, message, interaction), `${user.tag}'s warnings were cleared by ${executor.user.tag}. Count: ${info.c}`);
        return respond({ content: `Cleared ${info.c} warnings for ${user.tag}.` });
      }

      case 'report': {
        const member = type === 'msg' ? message.mentions.members.first() : options.getMember('user');
        const reason = type === 'msg' ? args.slice(1).join(' ') || 'No reason provided' : (options.getString('reason') || 'No reason provided');
        if (!member) return respond({ content: 'Member not found.', ephemeral: true });
        const guild = type === 'msg' ? message.guild : interaction.guild;
        const chId = getModLogChannelId(guild.id);
        const embed = new EmbedBuilder().setTitle('User Report').addFields({ name: 'Reported', value: `${member.user.tag} (${member.id})` }, { name: 'Reporter', value: `${type === 'msg' ? message.author.tag : interaction.user.tag} (${type === 'msg' ? message.author.id : interaction.user.id})` }, { name: 'Reason', value: reason }).setTimestamp();
        if (chId) {
          const ch = guild.channels.cache.get(chId);
          if (ch && ch.isTextBased()) { ch.send({ embeds: [embed] }); return respond({ content: 'Your report was submitted to the moderation channel.' }); }
        }
        const ch = guild.channels.cache.find(c => ['mod-log','reports','moderation'].includes(c.name));
        if (ch && ch.isTextBased()) { ch.send({ embeds: [embed] }); return respond({ content: 'Your report was submitted to the moderation channel.' }); }
        try { await guild.fetchOwner().then(o => o.send({ embeds: [embed] })); return respond({ content: 'No mod channel found — report sent to server owner.' }); } catch (err) { return respond({ content: 'Could not send report to moderators.' }); }
      }

      case 'tempbanlist': {
        const guildId = type === 'msg' ? message.guild.id : interaction.guild.id;
        const rows = db.prepare('SELECT userId, unbanAt FROM tempbans WHERE guildId = ? ORDER BY unbanAt ASC').all(guildId);
        if (!rows.length) return respond({ content: 'No active tempbans.' });
        const out = rows.map(r => `<@${r.userId}> — unban at ${new Date(r.unbanAt).toLocaleString()}`).join('\n');
        return respond({ content: out });
      }

      case 'setprefix': {
        const prefix = type === 'msg' ? args[0] : options.getString('prefix');
        const member = type === 'msg' ? message.member : interaction.member;
        if (!member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return respond({ content: 'You need Manage Server permission.', ephemeral: true });
        if (!prefix) return respond({ content: 'Provide a prefix.', ephemeral: true });
        savePrefix(type === 'msg' ? message.guild.id : interaction.guild.id, prefix);
        PREFIX = prefix;
        return respond({ content: `Prefix set to \`${prefix}\`.` });
      }

      case 'setmodlog': {
        // only slash supports channel option in our registration; for prefix commands expect mention or id
        const member = type === 'msg' ? message.member : interaction.member;
        if (!member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return respond({ content: 'You need Manage Server permission.', ephemeral: true });
        let channelId;
        if (type === 'msg') {
          const ch = message.mentions.channels.first() || (message.guild.channels.cache.get(args[0]));
          if (!ch) return respond({ content: 'Provide a channel mention or ID.', ephemeral: true });
          channelId = ch.id;
        } else {
          const ch = options.getChannel('channel');
          channelId = ch.id;
        }
        setModLogChannel(type === 'msg' ? message.guild.id : interaction.guild.id, channelId);
        return respond({ content: `Mod-log channel set to <#${channelId}>.` });
      }

      case 'warnpolicy': {
        // Only available as slash (subcommands) — prefix handling could parse "warnpolicy add 3 mute 1d"
        if (type === 'msg') return respond({ content: 'Please use slash command /warnpolicy for managing warn policies.', ephemeral: true });
        const sub = options.getSubcommand();
        const guildId = interaction.guild.id;
        if (sub === 'add') {
          const threshold = options.getInteger('threshold');
          const action = options.getString('action');
          const durationStr = options.getString('duration');
          const duration = durationStr ? parseDuration(durationStr) : null;
          addWarnAction(guildId, threshold, action, duration);
          return respond({ content: `Added warn action: ${threshold} => ${action}${duration ? ` for ${durationStr}` : ''}` });
        } else if (sub === 'list') {
          const rows = listWarnActions(guildId);
          if (!rows.length) return respond({ content: 'No warn actions configured.' });
          const out = rows.map(r => `${r.threshold} => ${r.action}${r.duration ? ` (duration ${Math.round(r.duration/1000)}s)` : ''}`).join('\n');
          return respond({ content: out });
        } else if (sub === 'remove') {
          const threshold = options.getInteger('threshold');
          removeWarnAction(guildId, threshold);
          return respond({ content: `Removed warn action for threshold ${threshold}.` });
        }
        return respond({ content: 'Unknown subcommand.', ephemeral: true });
      }

      default:
        break;
    }
  } catch (err) {
    console.error('Command error:', err);
    if (type === 'msg') message.channel.send('An error occurred while running that command.').catch(() => {});
    else interaction.reply({ content: 'An error occurred while running that command.', ephemeral: true }).catch(() => {});
  }
}

function guildOf(type, message, interaction) {
  return type === 'msg' ? message.guild : interaction.guild;
}

async function logToMod(guild, text) {
  if (!guild) return;
  const chId = getModLogChannelId(guild.id);
  try {
    const ch = chId ? guild.channels.cache.get(chId) : (guild.systemChannel || guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(guild.members.me).has(PermissionsBitField.Flags.SendMessages)));
    if (ch && ch.isTextBased()) ch.send(text).catch(() => {});
  } catch (err) {}
}

async function performAutoAction(guild, userId, action, duration, moderatorTag, reason) {
  // guild may be a Guild object or null
  if (!guild) return;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (action === 'mute') {
    const role = await ensureMutedRole(guild);
    if (member && role) await member.roles.add(role, `Auto action: ${reason}`).catch(() => {});
    logToMod(guild, `<@${userId}> has been muted automatically. Reason: ${reason}`);
  } else if (action === 'tempmute') {
    const ms = duration || 0;
    const role = await ensureMutedRole(guild);
    if (member && role) await member.roles.add(role, `Auto action: ${reason}`).catch(() => {});
    const unmuteAt = Date.now() + ms;
    db.prepare('INSERT INTO tempmutes (guildId, userId, unmuteAt) VALUES (?, ?, ?)').run(guild.id, userId, unmuteAt);
    scheduleUnmute(guild, userId, unmuteAt);
    logToMod(guild, `<@${userId}> has been tempmuted automatically until ${new Date(unmuteAt).toLocaleString()}. Reason: ${reason}`);
  } else if (action === 'kick') {
    if (member) await member.kick(reason).catch(() => {});
    logToMod(guild, `<@${userId}> has been kicked automatically. Reason: ${reason}`);
  } else if (action === 'ban') {
    if (member) await member.ban({ reason }).catch(() => {});
    logToMod(guild, `<@${userId}> has been banned automatically. Reason: ${reason}`);
  } else if (action === 'tempban') {
    const ms = duration || 0;
    if (member) await member.ban({ reason }).catch(() => {});
    const unbanAt = Date.now() + ms;
    db.prepare('INSERT INTO tempbans (guildId, userId, unbanAt) VALUES (?, ?, ?)').run(guild.id, userId, unbanAt);
    scheduleUnban(guild, userId, unbanAt);
    logToMod(guild, `<@${userId}> has been tempbanned automatically until ${new Date(unbanAt).toLocaleString()}. Reason: ${reason}`);
  }
}

// Interaction handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  const commandName = interaction.commandName;
  const options = interaction.options;
  // handle warnpolicy as special: subcommands
  if (commandName === 'warnpolicy') {
    await handleCommandRun({ type: 'interaction', interaction, commandName, options });
    return;
  }
  await handleCommandRun({ type: 'interaction', interaction, commandName, options });
});

// Prefix-based commands for compatibility
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.guild) return;
  const guildPrefix = loadPrefix(message.guild.id) || PREFIX;
  if (!message.content.startsWith(guildPrefix)) return;
  const args = message.content.slice(guildPrefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  await handleCommandRun({ type: 'msg', message, commandName: cmd, args });
});

client.login(TOKEN);
