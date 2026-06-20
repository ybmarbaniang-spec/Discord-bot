module.exports = {
  name: 'say',
  description: 'Make the bot say something',
  async execute(message, args) {
    if (!message.member.permissions.has(require('../lib/utils').PermissionsBitField.Flags.ManageMessages))
      return message.reply('You do not have permission to use this command.');
    const text = args.join(' ');
    if (!text) return message.reply('Provide a message to send.');
    await message.delete().catch(() => {});
    return message.channel.send(text);
  }
};
