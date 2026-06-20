module.exports = {
  name: 'setmodlog',
  description: 'Set the mod-log channel: !setmodlog #channel',
  async execute(message, args) {
    if (!message.member.permissions.has(require('discord.js').PermissionsBitField.Flags.ManageGuild)) return message.reply('You need Manage Server permission.');
    const ch = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
    if (!ch) return message.reply('Provide a channel');
    require('../lib/db').setModLog(message.guild.id, ch.id);
    return message.reply(`Mod-log set to ${ch}`);
  }
};
