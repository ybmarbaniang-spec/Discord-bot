// index.js — rewritten: moderation + utility commands in a single-file bot
// Requires node 16+, discord.js v14, and setting DISCORD_TOKEN (and optional PREFIX) in environment

const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials, PermissionsBitField, EmbedBuilder } = require('discord.js');

// Configuration
const TOKEN = process.env.DISCORD_TOKEN; // set this in your environment or use a .env loader
const PREFIX = process.env.PREFIX || '!';
const DATA_DIR = path.join(__dirname, 'data');
const WARNS_FILE = path.join(DATA_DIR, 'warns.json');

if (!TOKEN) {
  console.error('ERROR: DISCORD_TOKEN environment variable not set');
  process.exit(1);
}

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(WARNS_FILE)) fs.writeFileSync(WARNS_FILE, JSON.stringify({}), 'utf8');

function loadWarns() {
  try {
    return JSON.parse(fs.readFileSync(WARNS_FILE, 'utf8'));
  } catch (err) {
    console.error('Failed to read warns.json, resetting:', err);
    fs.writeFileSync(WARNS_FILE, JSON.stringify({}), 'utf8');
    return {};
  }
}
function saveWarns(data) {
  fs.writeFileSync(WARNS_FILE, JSON.stringify(data, null, 2), 'utf8');
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

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity(`${PREFIX}help | ${client.guilds.cache.size} guild(s)`);
});

// Utility helpers
function hasPermission(member, perm) {
  return member.permissions.has(perm);
}

function formatDate(ts) {
  return new Date(ts).toLocaleString();
}

// Moderation helpers
async function ensureMutedRole(guild) {
  let role = guild.roles.cache.find(r => r.name === 'Muted');
  if (!role) {
    try {
      role = await guild.roles.create({ name: 'Muted', permissions: [] });
      // Deny SEND_MESSAGES in all text channels for the Muted role
      for (const [, channel] of guild.channels.cache) {
        try {
          if (channel.isTextBased()) {
            await channel.permissionOverwrites.edit(role, { SendMessages: false, AddReactions: false, Speak: false });
          }
        } catch (err) {
          // ignore per-channel failures
        }
      }
    } catch (err) {
      console.error('Failed to create Muted role:', err);
    }
  }
  return role;
}

// Command handling
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.guild) return; // guild-only

  const prefix = PREFIX;
  if (!message.content.startsWith(prefix)) return;
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  try {
    switch (cmd) {
      // ------------------------ Utility commands ------------------------
      case 'ping': {
        const sent = await message.channel.send('Pinging...');
        const latency = sent.createdTimestamp - message.createdTimestamp;
        const api = Math.round(client.ws.ping);
        sent.edit(`Pong! Latency: ${latency}ms. API: ${api}ms`);
        break;
      }

      case 'avatar': {
        const user = message.mentions.users.first() || message.author;
        return message.channel.send({ content: user.displayAvatarURL({ dynamic: true, size: 1024 }) });
      }

      case 'serverinfo': {
        const g = message.guild;
        const embed = new EmbedBuilder()
          .setTitle(`${g.name} — Info`)
          .setThumbnail(g.iconURL({ dynamic: true }))
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
        const user = member.user;
        const embed = new EmbedBuilder()
          .setAuthor({ name: `${user.tag}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
          .addFields(
            { name: 'ID', value: user.id, inline: true },
            { name: 'Joined', value: formatDate(member.joinedTimestamp || 0), inline: true },
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
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
          return message.reply('You do not have permission to use this command.');
        const text = args.join(' ');
        if (!text) return message.reply('Provide a message to send.');
        await message.delete().catch(() => {});
        return message.channel.send(text);
      }

      case 'embed': {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
          return message.reply('You do not have permission to use this command.');
        const text = args.join(' ');
        if (!text) return message.reply('Provide a message to send.');
        const embed = new EmbedBuilder().setDescription(text).setColor(0x00AE86);
        await message.delete().catch(() => {});
        return message.channel.send({ embeds: [embed] });
      }

      case 'poll': {
        // Usage: !poll "Question" option1 | option2 | option3
        const content = message.content.slice(prefix.length + cmd.length).trim();
        const match = content.match(/"([^"]+)"\s*(.+)/);
        if (!match) return message.reply('Usage: !poll "Question" option1 | option2 | option3');
        const question = match[1];
        const opts = match[2].split('|').map(o => o.trim()).filter(Boolean).slice(0, 10);
        if (opts.length < 2) return message.reply('Provide at least 2 options.');
        const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
        const embed = new EmbedBuilder().setTitle(question).setDescription(opts.map((o, i) => `${emojis[i]} ${o}`).join('\n'));
        const poll = await message.channel.send({ embeds: [embed] });
        for (let i = 0; i < opts.length; i++) await poll.react(emojis[i]);
        break;
      }

      case 'help': {
        const embed = new EmbedBuilder().setTitle('Help — Commands')
          .setDescription(`Prefix: ${PREFIX}`)
          .addFields(
            { name: 'Moderation', value: '`kick`, `ban`, `tempban`, `mute`, `unmute`, `clear`, `warn`, `warnings`, `clearwarns`' },
            { name: 'Utility', value: '`ping`, `avatar`, `serverinfo`, `userinfo`, `roles`, `say`, `embed`, `poll`, `help`' }
          )
          .setFooter({ text: 'Moderation commands require appropriate permissions.' });
        return message.channel.send({ embeds: [embed] });
      }

      // ------------------------ Moderation commands ------------------------
      case 'kick': {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers))
          return message.reply('You need Kick Members permission.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mention a member to kick.');
        if (!member.kickable) return message.reply('I cannot kick that user.');
        const reason = args.join(' ') || 'No reason provided';
        await member.kick(reason).catch(err => message.reply('Failed to kick: ' + err.message));
        return message.channel.send(`${member.user.tag} was kicked. Reason: ${reason}`);
      }

      case 'ban': {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
          return message.reply('You need Ban Members permission.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mention a member to ban.');
        const reason = args.join(' ') || 'No reason provided';
        await member.ban({ days: 0, reason }).catch(err => message.reply('Failed to ban: ' + err.message));
        return message.channel.send(`${member.user.tag} was banned. Reason: ${reason}`);
      }

      case 'tempban': {
        // !tempban @user 1d reason
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
          return message.reply('You need Ban Members permission.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mention a member to tempban.');
        const durationArg = args.shift();
        if (!durationArg) return message.reply('Provide a duration like 1d, 2h, 30m');
        const reason = args.join(' ') || 'No reason provided';
        const ms = parseDuration(durationArg);
        if (!ms) return message.reply('Invalid duration format. Use 1d, 2h, 30m.');
        await member.ban({ days: 0, reason }).catch(err => message.reply('Failed to ban: ' + err.message));
        message.channel.send(`${member.user.tag} was temp-banned for ${durationArg}. Reason: ${reason}`);

        // Schedule unban (in-memory). Note: will not persist through restarts.
        setTimeout(async () => {
          try {
            await message.guild.bans.remove(member.id);
            message.channel.send(`${member.user.tag} was automatically unbanned (tempban expired).`);
          } catch (err) {
            // ignore
          }
        }, ms);
        break;
      }

      case 'mute': {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers) && !message.member.permissions.has(PermissionsBitField.Flags.ManageRoles))
          return message.reply('You need Moderate Members or Manage Roles permission.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mention a member to mute.');
        const role = await ensureMutedRole(message.guild);
        if (!role) return message.reply('Could not ensure Muted role exists.');
        if (member.roles.cache.has(role.id)) return message.reply('Member is already muted.');
        await member.roles.add(role, `Muted by ${message.author.tag}`).catch(err => message.reply('Failed to add Muted role: ' + err.message));
        return message.channel.send(`${member.user.tag} has been muted.`);
      }

      case 'unmute': {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers) && !message.member.permissions.has(PermissionsBitField.Flags.ManageRoles))
          return message.reply('You need Moderate Members or Manage Roles permission.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mention a member to unmute.');
        const role = message.guild.roles.cache.find(r => r.name === 'Muted');
        if (!role) return message.reply('No Muted role found.');
        if (!member.roles.cache.has(role.id)) return message.reply('Member is not muted.');
        await member.roles.remove(role, `Unmuted by ${message.author.tag}`).catch(err => message.reply('Failed to remove Muted role: ' + err.message));
        return message.channel.send(`${member.user.tag} has been unmuted.`);
      }

      case 'clear': {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
          return message.reply('You need Manage Messages permission.');
        const count = parseInt(args[0], 10);
        if (!count || count < 1 || count > 100) return message.reply('Provide a number between 1 and 100.');
        const deleted = await message.channel.bulkDelete(count, true).catch(err => message.reply('Failed to delete messages: ' + err.message));
        return message.channel.send(`Deleted ${deleted ? deleted.size : 0} messages.`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
      }

      case 'warn': {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers) && !message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
          return message.reply('You need Kick or Ban permission to warn.');
        const member = message.mentions.users.first();
        if (!member) return message.reply('Mention a user to warn.');
        const reason = args.join(' ') || 'No reason provided';
        const warns = loadWarns();
        if (!warns[message.guild.id]) warns[message.guild.id] = {};
        if (!warns[message.guild.id][member.id]) warns[message.guild.id][member.id] = [];
        warns[message.guild.id][member.id].push({ moderator: message.author.id, reason, timestamp: Date.now() });
        saveWarns(warns);
        message.channel.send(`${member.tag} has been warned. Reason: ${reason}`);
        try { await member.send(`You were warned in ${message.guild.name}: ${reason}`); } catch (err) {}
        break;
      }

      case 'warnings': {
        const user = message.mentions.users.first() || message.author;
        const warns = loadWarns();
        const list = (warns[message.guild.id] && warns[message.guild.id][user.id]) || [];
        if (!list.length) return message.channel.send(`${user.tag} has no warnings.`);
        const out = list.map((w, i) => `${i+1}. by <@${w.moderator}> on ${formatDate(w.timestamp)} — ${w.reason}`).join('\n');
        const embed = new EmbedBuilder().setTitle(`Warnings for ${user.tag}`).setDescription(out);
        return message.channel.send({ embeds: [embed] });
      }

      case 'clearwarns': {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers) && !message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
          return message.reply('You need Kick or Ban permission.');
        const user = message.mentions.users.first();
        if (!user) return message.reply('Mention a user to clear warnings for.');
        const warns = loadWarns();
        if (warns[message.guild.id] && warns[message.guild.id][user.id]) {
          delete warns[message.guild.id][user.id];
          saveWarns(warns);
          return message.channel.send(`Cleared warnings for ${user.tag}.`);
        }
        return message.channel.send(`${user.tag} has no warnings.`);
      }

      case 'report': {
        // !report @user reason
        const reported = message.mentions.members.first();
        if (!reported) return message.reply('Mention a user to report.');
        const reason = args.join(' ') || 'No reason provided';
        // Find channel named 'mod-log' or 'reports'
        const ch = message.guild.channels.cache.find(c => ['mod-log','reports','moderation'].includes(c.name));
        const embed = new EmbedBuilder()
          .setTitle('User Report')
          .addFields(
            { name: 'Reported', value: `${reported.user.tag} (${reported.id})` },
            { name: 'Reporter', value: `${message.author.tag} (${message.author.id})` },
            { name: 'Reason', value: reason }
          )
          .setTimestamp();
        if (ch && ch.isTextBased()) {
          ch.send({ embeds: [embed] });
          message.reply('Your report was submitted to the moderation channel.');
        } else {
          // fallback: DM server owner
          try {
            await message.guild.fetchOwner().then(owner => owner.send({ embeds: [embed] }));
            message.reply('No mod channel found — report sent to server owner.');
          } catch (err) {
            message.reply('Could not send report to moderators.');
          }
        }
        break;
      }

      default:
        // Unknown command — no reply to avoid spam
        break;
    }
  } catch (err) {
    console.error('Command error:', err);
    message.reply('An error occurred while running that command.');
  }
});

// Simple duration parser: 1d 2h 30m
function parseDuration(str) {
  if (!str) return 0;
  const match = str.match(/(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?/);
  if (!match) return 0;
  const days = parseInt(match[1]||0, 10);
  const hours = parseInt(match[2]||0, 10);
  const mins = parseInt(match[3]||0, 10);
  return ((days*24 + hours)*60 + mins) * 60 * 1000;
}

client.login(TOKEN);
