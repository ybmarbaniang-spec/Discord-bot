module.exports = {
  name: 'lock',
  description: 'Lock current channel',
  async execute(message) {
    if (!message.member.permissions.has(require('discord.js').PermissionsBitField.Flags.ManageChannels)) return message.reply('You need Manage Channels permission.');
    const ch = message.channel;
    await ch.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false }).catch(()=>{});
    return message.reply('Channel locked.');
  }
};
