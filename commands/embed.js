const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'embed',
  description: 'Send a message inside an embed',
  async execute(message, args) {
    if (!message.member.permissions.has(require('../lib/utils').PermissionsBitField.Flags.ManageMessages))
      return message.reply('You do not have permission to use this command.');
    const text = args.join(' ');
    if (!text) return message.reply('Provide a message to send.');
    const embed = new EmbedBuilder().setDescription(text).setColor(0x00AE86);
    await message.delete().catch(() => {});
    return message.channel.send({ embeds: [embed] });
  }
};
