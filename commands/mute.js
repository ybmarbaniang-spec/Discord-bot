const { PermissionsBitField } = require('discord.js');
const { ensureMutedRole } = require('../lib/utils');

module.exports = {
  name: 'mute',
  description: 'Mute a member by applying the Muted role',
  async execute(message) {
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
};
