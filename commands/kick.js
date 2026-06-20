const { PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'kick',
  description: 'Kick a member',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers))
      return message.reply('You need Kick Members permission.');
    const member = message.mentions.members.first();
    if (!member) return message.reply('Mention a member to kick.');
    if (!member.kickable) return message.reply('I cannot kick that user.');
    const reason = args.join(' ') || 'No reason provided';
    await member.kick(reason).catch(err => message.reply('Failed to kick: ' + err.message));
    return message.channel.send(`${member.user.tag} was kicked. Reason: ${reason}`);
  }
};
