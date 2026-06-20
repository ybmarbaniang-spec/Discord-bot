module.exports = {
  name: 'setprefix',
  description: 'Set server prefix: !setprefix $',
  async execute(message, args) {
    if (!message.member.permissions.has(require('discord.js').PermissionsBitField.Flags.ManageGuild)) return message.reply('You need Manage Server permission.');
    const p = args[0]; if (!p) return message.reply('Provide a prefix');
    require('../lib/db').setPrefix(message.guild.id, p);
    return message.reply(`Prefix set to ${p}`);
  }
};
