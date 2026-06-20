// index.js — modular bot loader with sqlite persistence and scheduler
// Requires node 16+, discord.js v14

const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials, PermissionsBitField, EmbedBuilder } = require('discord.js');

const logger = require('./lib/logger');
const db = require('./lib/db');
const warns = require('./lib/warns');

// Configuration
const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = process.env.PREFIX || '!';
const GUILD_ID = process.env.GUILD_ID || null;

if (!TOKEN) {
  logger.error('ERROR: DISCORD_TOKEN environment variable not set');
  process.exit(1);
}

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

// In-memory map of scheduled timeouts for temp actions
const scheduled = new Map();

// start DB and schedule pending temp actions
function schedulePending() {
  const pending = db.getPendingTempActions();
  const now = Date.now();
  for (const p of pending) {
    const remaining = p.expires_at - now;
    if (remaining <= 0) {
      // due immediately
      processDueAction(p).catch(err => logger.error('processDueAction error:', err));
    } else {
      const t = setTimeout(() => processDueAction(p).catch(err => logger.error('processDueAction error:', err)), remaining);
      scheduled.set(p.id, t);
    }
  }
}

async function processDueAction(p) {
  try {
    const guild = await client.guilds.fetch(p.guild_id).catch(() => null);
    if (!guild) {
      db.removeTempAction(p.id);
      scheduled.delete(p.id);
      return;
    }
    if (p.action === 'tempban') {
      await guild.members.unban(p.user_id).catch(() => {});
      logger.info(`Auto-unbanned ${p.user_id} in ${guild.id}`);
    } else if (p.action === 'tempmute') {
      const role = guild.roles.cache.find(r => r.name === 'Muted');
      if (role) {
        const member = await guild.members.fetch(p.user_id).catch(() => null);
        if (member && member.roles.cache.has(role.id)) {
          await member.roles.remove(role, 'Auto-unmute (tempmute expired)').catch(() => {});
          logger.info(`Auto-unmuted ${p.user_id} in ${guild.id}`);
        }
      }
    }
  } finally {
    db.removeTempAction(p.id);
    if (scheduled.has(p.id)) {
      clearTimeout(scheduled.get(p.id));
      scheduled.delete(p.id);
    }
  }
}

client.once('ready', async () => {
  logger.info(`Logged in as ${client.user.tag}`);
  client.user.setActivity(`${PREFIX}help | ${client.guilds.cache.size} guild(s)`);
  try {
    db.init();
    schedulePending();
  } catch (err) {
    logger.error('DB init failed:', err);
  }
});

function hasPermission(member, perm) {
  return member && member.permissions && member.permissions.has(perm);
}

function formatDate(ts) { return ts ? new Date(ts).toLocaleString() : 'Unknown'; }

async function ensureMutedRole(guild) {
  let role = guild.roles.cache.find(r => r.name === 'Muted');
  if (!role) {
    try {
      role = await guild.roles.create({ name: 'Muted', permissions: [], reason: 'Auto-created Muted role' });
      for (const channel of guild.channels.cache.values()) {
        try {
          if (channel && typeof channel.isTextBased === 'function' && channel.isTextBased()) {
            await channel.permissionOverwrites.edit(role, { SendMessages: false, AddReactions: false, Speak: false }).catch(() => {});
          }
        } catch (err) {}
      }
    } catch (err) {
      logger.error('Failed to create Muted role:', err);
    }
  }
  return role;
}

client.on('messageCreate', async message => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content || !message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    switch (cmd) {
      case 'ping': {
        const sent = await message.channel.send('Pinging...');
        const latency = sent.createdTimestamp - message.createdTimestamp;
        const api = Math.round(client.ws.ping);
        sent.edit(`Pong! Latency: ${latency}ms. API: ${api}ms`);
        break;
      }
      case 'help': {
        const embed = new EmbedBuilder().setTitle('Help — Commands')
          .setDescription(`Prefix: ${PREFIX}`)
          .addFields(
            { name: 'Moderation', value: '`kick`, `ban`, `tempban`, `mutetemp`, `mute`, `unmute`, `clear`, `warn`, `warnings`, `clearwarns`' },
            { name: 'Utility', value: '`ping`, `avatar`, `serverinfo`, `userinfo`, `roles`, `say`, `embed`, `poll`, `help`' }
          )
          .setFooter({ text: 'Moderation commands require appropriate permissions.' });
        return message.channel.send({ embeds: [embed] });
      }

      case 'avatar': {
        const user = message.mentions.users.first() || message.author;
        const url = user.displayAvatarURL({ dynamic: true, size: 1024 });
        return message.channel.send({ embeds: [new EmbedBuilder().setTitle(`${user.tag}'s Avatar`).setImage(url)] });
      }

      case 'serverinfo': {
        const g = message.guild;
        const embed = new EmbedBuilder()
          .setTitle(`${g.name} — Info`)
          .setThumbnail(g.iconURL ? g.iconURL({ dynamic: true }) : null)
          .addFields(
            { name: 'ID', value: g.id, inline: true },
            { name: 'Members', value: `${g.memberCount}`, inline: true },
            { name: 'Created', value: formatDate(g.createdTimestamp), inline: true }
          )
          .setFooter({ text: `Region: ${g.preferredLocale || 'unknown'}` });
        return message.channel.send({ embeds: [embed] });
      }

      case 'userinfo': {
        const member = message.mentions.members.first() || message.member;
        if (!member) return message.channel.send('Member not found.');
        const user = member.user;
        const embed = new EmbedBuilder()
          .setAuthor({ name: `${user.tag}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
          .addFields(
            { name: 'ID', value: user.id, inline: true },
            { name: 'Joined', value: formatDate(member.joinedTimestamp), inline: true },
            { name: 'Created', value: formatDate(user.createdTimestamp), inline: true }
          );
        return message.channel.send({ embeds: [embed] });
      }

      case 'roles': {
        const roles = message.guild.roles.cache
          .filter(r => r.id !== message.guild.id)
          .sort((a, b) => b.position - a.position)
          .map(r => r.name)
          .slice(0, 20);
        return message.channel.send(`Roles (${roles.length} shown): ${roles.join(', ')}`);
      }

      case 'say': {
        if (!hasPermission(message.member, PermissionsBitField.Flags.ManageMessages))
          return message.reply('You do not have permission to use this command.');
        const text = args.join(' ');
        if (!text) return message.reply('Provide a message to send.');
        await message.delete().catch(() => {});
        return message.channel.send(text);
      }

      case 'embed': {
        if (!hasPermission(message.member, PermissionsBitField.Flags.ManageMessages))
          return message.reply('You do not have permission to use this command.');
        const text = args.join(' ');
        if (!text) return message.reply('Provide a message to send.');
        const embed = new EmbedBuilder().setDescription(text).setColor(0x00AE86);
        await message.delete().catch(() => {});
        return message.channel.send({ embeds: [embed] });
      }

      case 'poll': {
        const content = message.content.slice(PREFIX.length + cmd.length).trim();
        const match = content.match(/"([^\"]+)"\s*(.+)/);
        if (!match) return message.reply('Usage: !poll "Question" option1 | option2 | option3');
        const question = match[1];
        const opts = match[2].split('|').map(o => o.trim()).filter(Boolean).slice(0, 10);
        if (opts.length < 2) return message.reply('Provide at least 2 options.');
        const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
        const embed = new EmbedBuilder().setTitle(question).setDescription(opts.map((o, i) => `${emojis[i]} ${o}`).join('\n'));
        const poll = await message.channel.send({ embeds: [embed] });
        for (let i = 0; i < opts.length; i++) await poll.react(emojis[i]).catch(() => {});
        break;
      }

      // Moderation
      case 'kick': {
        if (!hasPermission(message.member, PermissionsBitField.Flags.KickMembers))
          return message.reply('You need Kick Members permission.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mention a member to kick.');
        if (!member.kickable) return message.reply('I cannot kick that user.');
        const reason = args.join(' ') || 'No reason provided';
        await member.kick(reason).catch(err => message.reply('Failed to kick: ' + err.message));
        return message.channel.send(`${member.user.tag} was kicked. Reason: ${reason}`);
      }

      case 'ban': {
        if (!hasPermission(message.member, PermissionsBitField.Flags.BanMembers))
          return message.reply('You need Ban Members permission.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mention a member to ban.');
        const reason = args.join(' ') || 'No reason provided';
        await member.ban({ deleteMessageDays: 0, reason }).catch(err => message.reply('Failed to ban: ' + err.message));
        return message.channel.send(`${member.user.tag} was banned. Reason: ${reason}`);
      }

      case 'tempban': {
        if (!hasPermission(message.member, PermissionsBitField.Flags.BanMembers))
          return message.reply('You need Ban Members permission.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mention a member to tempban.');
        const durationArg = args.shift();
        if (!durationArg) return message.reply('Provide a duration like 1d, 2h, 30m');
        const reason = args.join(' ') || 'No reason provided';
        const ms = parseDuration(durationArg);
        if (!ms) return message.reply('Invalid duration format. Use 1d, 2h, 30m.');
        await member.ban({ deleteMessageDays: 0, reason }).catch(err => message.reply('Failed to ban: ' + err.message));
        const expires = Date.now() + ms;
        const id = db.addTempAction(message.guild.id, member.id, 'tempban', expires, reason);
        // schedule
        const t = setTimeout(() => processDueAction({ id, guild_id: message.guild.id, user_id: member.id, action: 'tempban', expires_at: expires }), ms);
        scheduled.set(id, t);
        message.channel.send(`${member.user.tag} was temp-banned for ${durationArg}. Reason: ${reason}`);
        break;
      }

      case 'mute': {
        if (!hasPermission(message.member, PermissionsBitField.Flags.ModerateMembers) && !hasPermission(message.member, PermissionsBitField.Flags.ManageRoles))
          return message.reply('You need Moderate Members or Manage Roles permission.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mention a member to mute.');
        const role = await ensureMutedRole(message.guild);
        if (!role) return message.reply('Could not ensure Muted role exists.');
        if (member.roles.cache.has(role.id)) return message.reply('Member is already muted.');
        await member.roles.add(role, `Muted by ${message.author.tag}`).catch(err => message.reply('Failed to add Muted role: ' + err.message));
        return message.channel.send(`${member.user.tag} has been muted.`);
      }

      case 'tempmute': {
        if (!hasPermission(message.member, PermissionsBitField.Flags.ManageRoles) && !hasPermission(message.member, PermissionsBitField.Flags.ModerateMembers))
          return message.reply('You need Manage Roles or Moderate Members permission.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mention a member to tempmute.');
        const durationArg = args.shift();
        if (!durationArg) return message.reply('Provide a duration like 1d, 2h, 30m');
        const ms = parseDuration(durationArg);
        if (!ms) return message.reply('Invalid duration format.');
        const role = await ensureMutedRole(message.guild);
        if (!role) return message.reply('Could not ensure Muted role exists.');
        await member.roles.add(role, `Temporarily muted by ${message.author.tag}`).catch(err => message.reply('Failed to add Muted role: ' + err.message));
        const expires = Date.now() + ms;
        const id = db.addTempAction(message.guild.id, member.id, 'tempmute', expires, 'tempmute');
        const t = setTimeout(() => processDueAction({ id, guild_id: message.guild.id, user_id: member.id, action: 'tempmute', expires_at: expires }), ms);
        scheduled.set(id, t);
        return message.channel.send(`${member.user.tag} has been temp-muted for ${durationArg}.`);
      }

      case 'unmute': {
        if (!hasPermission(message.member, PermissionsBitField.Flags.ManageRoles) && !hasPermission(message.member, PermissionsBitField.Flags.ModerateMembers))
          return message.reply('You need Manage Roles or Moderate Members permission.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mention a member to unmute.');
        const role = message.guild.roles.cache.find(r => r.name === 'Muted');
        if (!role) return message.reply('No Muted role found.');
        if (!member.roles.cache.has(role.id)) return message.reply('Member is not muted.');
        await member.roles.remove(role, `Unmuted by ${message.author.tag}`).catch(err => message.reply('Failed to remove Muted role: ' + err.message));
        return message.channel.send(`${member.user.tag} has been unmuted.`);
      }

      case 'clear': {
        if (!hasPermission(message.member, PermissionsBitField.Flags.ManageMessages))
          return message.reply('You need Manage Messages permission.');
        const count = parseInt(args[0], 10);
        if (!count || count < 1 || count > 100) return message.reply('Provide a number between 1 and 100.');
        const deleted = await message.channel.bulkDelete(count, true).catch(err => { message.reply('Failed to delete messages: ' + err.message); return null; });
        return message.channel.send(`Deleted ${deleted ? deleted.size : 0} messages.`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
      }

      case 'warn': {
        if (!hasPermission(message.member, PermissionsBitField.Flags.KickMembers) && !hasPermission(message.member, PermissionsBitField.Flags.BanMembers))
          return message.reply('You need Kick or Ban permission to warn.');
        const user = message.mentions.users.first();
        if (!user) return message.reply('Mention a user to warn.');
        const reason = args.join(' ') || 'No reason provided';
        db.init();
        db.addWarn(message.guild.id, user.id, message.author.id, reason, Date.now());
        message.channel.send(`${user.tag} has been warned. Reason: ${reason}`);
        try { await user.send(`You were warned in ${message.guild.name}: ${reason}`); } catch (err) {}
        break;
      }

      case 'warnings': {
        const user = message.mentions.users.first() || message.author;
        db.init();
        const list = db.getWarns(message.guild.id, user.id) || [];
        if (!list.length) return message.channel.send(`${user.tag} has no warnings.`);
        const out = list.map((w, i) => `${i+1}. by <@${w.moderator}> on ${formatDate(w.timestamp)} — ${w.reason}`).join('\n');
        const embed = new EmbedBuilder().setTitle(`Warnings for ${user.tag}`).setDescription(out);
        return message.channel.send({ embeds: [embed] });
      }

      case 'clearwarns': {
        if (!hasPermission(message.member, PermissionsBitField.Flags.KickMembers) && !hasPermission(message.member, PermissionsBitField.Flags.BanMembers))
          return message.reply('You need Kick or Ban permission.');
        const user = message.mentions.users.first();
        if (!user) return message.reply('Mention a user to clear warnings for.');
        db.init();
        db.clearWarns(message.guild.id, user.id);
        return message.channel.send(`Cleared warnings for ${user.tag}.`);
      }

      case 'report': {
        const reported = message.mentions.members.first();
        if (!reported) return message.reply('Mention a user to report.');
        const reason = args.join(' ') || 'No reason provided';
        const ch = message.guild.channels.cache.find(c => ['mod-log','reports','moderation'].includes(c.name));
        const embed = new EmbedBuilder()
          .setTitle('User Report')
          .addFields(
            { name: 'Reported', value: `${reported.user.tag} (${reported.id})` },
            { name: 'Reporter', value: `${message.author.tag} (${message.author.id})` },
            { name: 'Reason', value: reason }
          )
          .setTimestamp();
        if (ch && typeof ch.isTextBased === 'function' && ch.isTextBased()) {
          ch.send({ embeds: [embed] }).catch(() => {});
          message.reply('Your report was submitted to the moderation channel.');
        } else {
          try {
            await message.guild.fetchOwner().then(owner => owner.send({ embeds: [embed] }).catch(() => {}));
            message.reply('No mod channel found — report sent to server owner.');
          } catch (err) {
            message.reply('Could not send report to moderators.');
          }
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    logger.error('Command error:', err);
    try { message.reply('An error occurred while running that command.'); } catch (e) { logger.error('Failed to send error reply:', e); }
  }
});

function parseDuration(str) {
  if (!str) return 0;
  const match = str.match(/^\s*(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*$/i);
  if (!match) return 0;
  const days = parseInt(match[1]||0, 10);
  const hours = parseInt(match[2]||0, 10);
  const mins = parseInt(match[3]||0, 10);
  return ((days*24 + hours)*60 + mins) * 60 * 1000;
}

client.login(TOKEN).catch(err => { logger.error('Failed to login:', err); process.exit(1); });
