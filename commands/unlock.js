module.exports = {
  name: 'unlock',
  description: 'Unlock current channel',
  async execute(message) {
    if (!message.member.permissions.has(require('discord.js').PermissionsBitField.Flags.ManageChannels)) return message.reply('You need Manage Channels permission.');
    const ch = message.channel;
    await ch.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null }).catch(()=>{});
    return message.reply('Channel unlocked.');
  }
};
