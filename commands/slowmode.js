module.exports = {
  name: 'slowmode',
  description: 'Set slowmode in seconds: !slowmode 5',
  async execute(message, args) {
    if (!message.member.permissions.has(require('discord.js').PermissionsBitField.Flags.ManageChannels)) return message.reply('You need Manage Channels permission.');
    const s = parseInt(args[0],10);
    if (isNaN(s) || s<0 || s>21600) return message.reply('Seconds must be between 0 and 21600');
    await message.channel.setRateLimitPerUser(s).catch(()=>{});
    return message.reply(`Set slowmode to ${s}s`);
  }
};
