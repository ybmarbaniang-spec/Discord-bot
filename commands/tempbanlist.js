module.exports = {
  name: 'tempbanlist',
  description: 'List active tempbans in this guild',
  async execute(message) {
    const rows = require('../lib/db').getPendingTempActions();
    const list = rows.filter(r => r.guild_id === message.guild.id && r.action==='tempban');
    if (!list.length) return message.reply('No active tempbans.');
    return message.channel.send(list.map(l=>`<@${l.user_id}> — unban at ${new Date(l.expires_at).toLocaleString()}`).join('\n'));
  }
};
