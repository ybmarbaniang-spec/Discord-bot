const { PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'ban',
  description: 'Ban a member',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return message.reply('You need Ban Members permission.');
    const member = message.mentions.members.first();
    if (!member) return message.reply('Mention a member to ban.');
    const reason = args.join(' ') || 'No reason provided';
    await member.ban({ days: 0, reason }).catch(err => message.reply('Failed to ban: ' + err.message));
    return message.channel.send(`${member.user.tag} was banned. Reason: ${reason}`);
  }
};
