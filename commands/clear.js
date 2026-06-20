module.exports = {
  name: 'clear',
  description: 'Bulk delete messages',
  async execute(message, args) {
    if (!message.member.permissions.has(require('../lib/utils').PermissionsBitField.Flags.ManageMessages))
      return message.reply('You need Manage Messages permission.');
    const count = parseInt(args[0], 10);
    if (!count || count < 1 || count > 100) return message.reply('Provide a number between 1 and 100.');
    const deleted = await message.channel.bulkDelete(count, true).catch(err => message.reply('Failed to delete messages: ' + err.message));
    return message.channel.send(`Deleted ${deleted ? deleted.size : 0} messages.`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
  }
};
