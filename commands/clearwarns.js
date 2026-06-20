const { loadWarns, saveWarns } = require('../lib/warns');

module.exports = {
  name: 'clearwarns',
  description: 'Clear warnings for a user',
  async execute(message) {
    if (!message.member.permissions.has(require('../lib/utils').PermissionsBitField.Flags.KickMembers) && !message.member.permissions.has(require('../lib/utils').PermissionsBitField.Flags.BanMembers))
      return message.reply('You need Kick or Ban permission.');
    const user = message.mentions.users.first();
    if (!user) return message.reply('Mention a user to clear warnings for.');
    const warns = loadWarns();
    if (warns[message.guild.id] && warns[message.guild.id][user.id]) {
      delete warns[message.guild.id][user.id];
      saveWarns(warns);
      return message.channel.send(`Cleared warnings for ${user.tag}.`);
    }
    return message.channel.send(`${user.tag} has no warnings.`);
  }
};
