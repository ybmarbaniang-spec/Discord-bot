module.exports = {
  name: 'tempmutelist',
  description: 'List active tempmutes in this guild',
  async execute(message) {
    const rows = require('../lib/db').getPendingTempActions();
    const list = rows.filter(r => r.guild_id === message.guild.id && r.action==='tempmute');
    if (!list.length) return message.reply('No active tempmutes.');
    return message.channel.send(list.map(l=>`<@${l.user_id}> — unmute at ${new Date(l.expires_at).toLocaleString()}`).join('\n'));
  }
};
