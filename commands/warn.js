const { loadWarns, saveWarns } = require('../lib/warns');

module.exports = {
  name: 'warn',
  description: 'Warn a user',
  async execute(message, args) {
    if (!message.member.permissions.has(require('../lib/utils').PermissionsBitField.Flags.KickMembers) && !message.member.permissions.has(require('../lib/utils').PermissionsBitField.Flags.BanMembers))
      return message.reply('You need Kick or Ban permission to warn.');
    const member = message.mentions.users.first();
    if (!member) return message.reply('Mention a user to warn.');
    const reason = args.join(' ') || 'No reason provided';
    const warns = loadWarns();
    if (!warns[message.guild.id]) warns[message.guild.id] = {};
    if (!warns[message.guild.id][member.id]) warns[message.guild.id][member.id] = [];
    warns[message.guild.id][member.id].push({ moderator: message.author.id, reason, timestamp: Date.now() });
    saveWarns(warns);
    message.channel.send(`${member.tag} has been warned. Reason: ${reason}`);
    try { await member.send(`You were warned in ${message.guild.name}: ${reason}`); } catch (err) {}
  }
};
