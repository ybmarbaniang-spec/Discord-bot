const { PermissionsBitField } = require('discord.js');

function formatDate(ts) {
  return new Date(ts).toLocaleString();
}

function parseDuration(str) {
  if (!str) return 0;
  const match = str.match(/(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?/);
  if (!match) return 0;
  const days = parseInt(match[1]||0, 10);
  const hours = parseInt(match[2]||0, 10);
  const mins = parseInt(match[3]||0, 10);
  return ((days*24 + hours)*60 + mins) * 60 * 1000;
}

async function ensureMutedRole(guild) {
  let role = guild.roles.cache.find(r => r.name === 'Muted');
  if (!role) {
    try {
      role = await guild.roles.create({ name: 'Muted', permissions: [] });
      for (const [, channel] of guild.channels.cache) {
        try {
          if (channel.isTextBased && channel.isTextBased()) {
            await channel.permissionOverwrites.edit(role, { SendMessages: false, AddReactions: false, Speak: false });
          }
        } catch (err) {}
      }
    } catch (err) {
      console.error('Failed to create Muted role:', err);
    }
  }
  return role;
}

module.exports = { formatDate, parseDuration, ensureMutedRole, PermissionsBitField };
