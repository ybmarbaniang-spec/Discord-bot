const { PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'unmute',
  description: 'Remove Muted role from a member',
  async execute(message) {
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
};
