module.exports = {
  name: 'nuke',
  description: 'Nuke the current channel (delete+recreate). Requires Manage Channels.',
  async execute(message) {
    if (!message.member.permissions.has(require('discord.js').PermissionsBitField.Flags.ManageChannels)) return message.reply('You need Manage Channels permission.');
    const ch = message.channel;
    await ch.clone().then(c => ch.delete().catch(() => {})).catch(err => message.reply('Failed to nuke channel: ' + err.message));
    return; 
  }
};
